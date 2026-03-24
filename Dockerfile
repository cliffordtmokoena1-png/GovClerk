# syntax=docker/dockerfile:1
#
# GovClerk Server Docker Image for RunPod GPU Pods
#
# ╔══════════════════════════════════════════════════════════════════════╗
# ║  THIS IMAGE RUNS ONLY THE RUST BACKEND SERVER ON PORT 8000          ║
# ║  It does NOT include the Sophon Node.js server (port 3000) or       ║
# ║  the Next.js frontend.                                               ║
# ╚══════════════════════════════════════════════════════════════════════╝
#
# Service architecture (this image covers only the Rust backend):
#
#   Service                    | Port | Included here?
#   ---------------------------|------|---------------
#   Rust backend (Axum)        | 8000 | YES
#   Sophon (Node.js/Hono)      | 3000 | NO  -- do NOT try localhost:3000
#   Next.js frontend           | 3223 | NO  -- hosted on Vercel
#   RTMP (Nginx)               | 1935 | NO
#
# Build from repo root:
#   docker build -t ghcr.io/cliffordtmokoena1-png/govclerk-server:latest .
#
# Run:
#   docker run -p 8000:8000 ghcr.io/cliffordtmokoena1-png/govclerk-server:latest
#
# Verify:
#   curl http://localhost:8000/api/monitor

FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        wget \
        curl \
        git \
        openssh-server \
        build-essential \
        pkg-config \
        libssl-dev \
        ca-certificates \
        libclang-dev \
        jq \
        ffmpeg \
        && rm -rf /var/lib/apt/lists/*

# Install Miniconda
RUN wget -q https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O /tmp/miniconda.sh && \
    bash /tmp/miniconda.sh -b -p /opt/miniconda && \
    rm /tmp/miniconda.sh

ENV PATH=/opt/miniconda/bin:$PATH

# Initialize conda for bash
RUN /opt/miniconda/bin/conda init bash

# Accept conda/Anaconda Terms of Service for non-interactive builds
ENV CONDA_ACCEPT_TERMS=yes
ENV ANACONDA_ACCEPTS_TOS=yes

RUN conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main || true && \
    conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r || true

# Create the conda environment with all Python ML dependencies
RUN conda create -n gcenv python=3.11 -y && \
    conda run -n gcenv pip install --no-cache-dir \
        python-dotenv \
        pyinstrument \
        openai-whisper \
        soundfile \
        torchaudio \
        speechbrain \
        silero-vad \
        huggingface_hub && \
    conda clean -afy

# Install Rust 1.94.0
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain 1.94.0
ENV PATH="/root/.cargo/bin:$PATH"

# Copy Rust server source and build the release binary
WORKDIR /app/server
COPY GovClerkMinutes-server/rust/ ./

# Tell openssl-sys to use the system OpenSSL, not the vendored openssl-src
ENV OPENSSL_NO_VENDOR=1

RUN rm -f Cargo.lock && cargo generate-lockfile && cargo build --release

# Install Pandoc (latest release)
RUN LATEST_DEB=$(curl -s https://api.github.com/repos/jgm/pandoc/releases/latest \
        | grep "browser_download_url.*amd64.deb" \
        | cut -d '"' -f 4) && \
    wget -q "$LATEST_DEB" -O /tmp/pandoc.deb && \
    dpkg -i /tmp/pandoc.deb || apt-get install -f -y && \
    rm /tmp/pandoc.deb

# Pre-download all ML model weights during build (inlined — no external script needed).
# Models: SpeechBrain ECAPA-TDNN, Silero VAD, OpenAI Whisper large-v3,
#         PyAnnote segmentation (saved to /data/ for predict.py backward compatibility).
RUN conda run -n gcenv python3 - <<'PYEOF'
import os, shutil, sys

def download_speechbrain():
    from speechbrain.inference.classifiers import EncoderClassifier
    EncoderClassifier.from_hparams(
        source="speechbrain/spkrec-ecapa-voxceleb",
        run_opts={"device": "cpu"},
    )
    print("SpeechBrain ECAPA-TDNN cached.")

def download_silero_vad():
    from silero_vad import load_silero_vad
    load_silero_vad(onnx=False)
    print("Silero VAD cached.")

def download_whisper():
    import whisper
    whisper.load_model("large-v3", device="cpu")
    print("Whisper large-v3 cached.")

def download_pyannote():
    from huggingface_hub import hf_hub_download, constants as hf_constants
    os.makedirs("/data/pyannote/segmentation", exist_ok=True)
    for filename in ("pytorch_model.bin", "config.yaml"):
        path = hf_hub_download(repo_id="pyannote/segmentation", filename=filename)
        shutil.copy(path, f"/data/pyannote/segmentation/{filename}")
    os.makedirs("/data/speechbrain", exist_ok=True)
    hub_cache = os.path.join(hf_constants.HF_HUB_CACHE, "models--speechbrain--spkrec-ecapa-voxceleb")
    target = "/data/speechbrain/spkrec-ecapa-voxceleb"
    if os.path.exists(hub_cache) and not os.path.exists(target):
        os.symlink(hub_cache, target)
    print("PyAnnote segmentation cached.")

failed = []
for name, func in [("SpeechBrain", download_speechbrain), ("Silero VAD", download_silero_vad),
                   ("Whisper", download_whisper), ("PyAnnote", download_pyannote)]:
    try:
        func()
    except Exception as e:
        print(f"WARNING: {name} failed: {e}", file=sys.stderr)
        failed.append(name)

if failed:
    print(f"WARNING: Models not cached (will download at runtime): {', '.join(failed)}", file=sys.stderr)
PYEOF

# Copy Python ML scripts (speechbrain_model.py, whisper_model.py, decode.py, detect.py, main.py)
COPY GovClerkMinutes/platform/server/python/ /app/python/

# Configure SSH for RunPod remote access
RUN mkdir -p /var/run/sshd

# Port 8000: Rust Axum backend. Port 22: SSH for RunPod access.
ENV PORT=8000
EXPOSE 8000 22

# Health check — polls the Rust server monitor endpoint every 30 seconds
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/api/monitor || exit 1

# Start SSH (RunPod needs it) then launch the Rust server.
# env > .env writes all container env vars so the dotenv crate can read them.
CMD bash -c '\
    mkdir -p ~/.ssh && \
    chmod 700 ~/.ssh && \
    echo "$PUBLIC_KEY" > ~/.ssh/authorized_keys && \
    chmod 600 ~/.ssh/authorized_keys && \
    service ssh start && \
    env > /app/server/.env && \
    exec /app/server/target/release/govclerk-minutes-service'
