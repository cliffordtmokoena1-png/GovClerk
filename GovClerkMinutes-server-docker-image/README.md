# GovClerk Server Docker Image

Docker image for deploying the **Rust backend server** on RunPod GPU pods.

> **Important:** This image runs **only the Rust backend on port 8000**. It does NOT include
> the Sophon Node.js server (port 3000) or the Next.js frontend. See the architecture
> overview below for details.

## Service Architecture

The GovClerk platform has multiple services. Only the Rust backend is included in this image:

| Service | Port | Technology | Included in this image? |
|---------|------|------------|------------------------|
| **Rust backend** (transcription/AI) | **8000** | Rust (Axum) | ✅ Yes |
| **Sophon** (media/crawler/HLS/WebSocket) | **3000** | Node.js (Hono) | ❌ No |
| **Next.js frontend** | 3223 (dev) / 3000 (prod) | Next.js | ❌ No (hosted on Vercel) |
| **RTMP** | **1935** | Nginx RTMP | ❌ No |

The Rust server listens on **`0.0.0.0:8000`** (all interfaces), which is correct for Docker.

## Building the Image

The `Dockerfile` is at the **repo root**. Build with:

```bash
# From the repository root:
docker build -t ghcr.io/cliffordtmokoena1-png/govclerk-server:latest .
```

Verify:
```bash
curl http://localhost:8000/api/monitor
```

## Pushing to GHCR

```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u cliffordtmokoena1-png --password-stdin
docker push ghcr.io/cliffordtmokoena1-png/govclerk-server:latest
```

## Running the Container Locally

```bash
docker run -p 8000:8000 \
  -e PUBLIC_KEY="your-ssh-public-key" \
  -e DATABASE_URL="mysql://..." \
  -e AWS_ACCESS_KEY_ID="..." \
  -e AWS_SECRET_ACCESS_KEY="..." \
  -e OPENAI_KEY="..." \
  ghcr.io/cliffordtmokoena1-png/govclerk-server:latest
```

## RunPod Deployment

1. Create a new GPU Pod on [RunPod Console](https://www.runpod.io/console/pods)
2. Set the Container Image to: `ghcr.io/cliffordtmokoena1-png/govclerk-server:latest`
3. Set **Exposed HTTP Ports** to `8000`
4. Add your SSH public key as the `PUBLIC_KEY` environment variable
5. Add all required environment variables (see below)
6. Deploy the pod

RunPod exposes HTTP ports via their proxy. SSH is available on port 22.

## Verifying the Server is Running

```bash
# Health check — should return 200 OK
curl http://localhost:8000/api/monitor

# Or from outside the container (replace with your pod IP):
curl http://<pod-ip>:8000/api/monitor
```

The container has a built-in `HEALTHCHECK` that polls this endpoint every 30 seconds.

## Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `PUBLIC_KEY` | Your SSH public key for RunPod remote access |
| `DATABASE_URL` | MySQL/PlanetScale connection string |
| `AWS_ACCESS_KEY_ID` | S3 access for audio storage |
| `AWS_SECRET_ACCESS_KEY` | S3 secret key |
| `AWS_DEFAULT_REGION` | S3 region |
| `OPENAI_KEY` | OpenAI API key (Whisper + GPT) |
| `GEMINI_PRO_15_API_KEY` | Google Gemini API key (minutes generation) |
| `UPLOAD_COMPLETE_WEBHOOK_SECRET` | Bearer token for webhook auth |
| `CLERK_SECRET_KEY` | Clerk authentication |

## Common Mistakes

### ❌ Trying `localhost:3000`
Port 3000 is the **Sophon Node.js server**, which is NOT included in this Docker image.
Accessing `localhost:3000` from inside or outside this container will always fail with
`ERR_CONNECTION_REFUSED`.

**✅ Use port 8000 instead:** `http://localhost:8000/api/monitor`

### ❌ Building from the wrong directory
The Dockerfile must be built from the **repository root** because it copies
`GovClerkMinutes-server/rust/`. See the build command above.

### ❌ Missing `-p 8000:8000` in `docker run`
Without the port mapping, the container port is not accessible from your host.
Always pass `-p 8000:8000` when running locally.

## What's Included

- **NVIDIA CUDA 12.4** runtime for GPU-accelerated ML inference
- **Miniconda** with Python 3.11 and ML dependencies (PyAnnote, Whisper, SpeechBrain)
- **Rust 1.94.0** for building the backend server
- **Pandoc** for document generation
- **ML model weights** pre-downloaded directly from HuggingFace/PyTorch Hub during build
  (no S3 dependency):
  - SpeechBrain ECAPA-TDNN speaker embeddings (`speechbrain/spkrec-ecapa-voxceleb`)
  - Silero VAD voice activity detection model
  - OpenAI Whisper large-v3 speech recognition (~3 GB)
  - PyAnnote segmentation model (`pyannote/segmentation`, saved to `/data/` for
    backward compatibility with `predict.py`)
- **FFmpeg** for audio processing
- **SSH server** for remote access via RunPod
