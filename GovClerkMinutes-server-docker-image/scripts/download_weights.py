#!/usr/bin/env python3
"""Pre-download all ML model weights for the GovClerk server Docker image.

This script is run during the Docker build to cache model weights so they
don't need to be downloaded at runtime (which would be slow and unreliable
on RunPod pods).

Models downloaded:
  1. SpeechBrain ECAPA-TDNN (speaker embeddings) → HuggingFace cache
  2. Silero VAD (voice activity detection) → PyTorch cache
  3. OpenAI Whisper large-v3 (speech recognition) → ~/.cache/whisper
  4. PyAnnote segmentation (speaker segmentation) → /data/pyannote/segmentation/

The /data/ paths provide backward compatibility with the legacy predict.py
(Cog/Replicate deployment).
"""
import os
import shutil
import sys


def download_speechbrain():
    print("=" * 60)
    print("Downloading SpeechBrain ECAPA-TDNN speaker embedding model...")
    print("=" * 60)
    from speechbrain.inference.classifiers import EncoderClassifier
    EncoderClassifier.from_hparams(
        source="speechbrain/spkrec-ecapa-voxceleb",
        run_opts={"device": "cpu"},
    )
    print("✓ SpeechBrain ECAPA-TDNN cached successfully.\n")


def download_silero_vad():
    print("=" * 60)
    print("Downloading Silero VAD model...")
    print("=" * 60)
    from silero_vad import load_silero_vad
    load_silero_vad(onnx=False)
    print("✓ Silero VAD cached successfully.\n")


def download_whisper():
    print("=" * 60)
    print("Downloading OpenAI Whisper large-v3 model...")
    print("=" * 60)
    import whisper
    whisper.load_model("large-v3", device="cpu")
    print("✓ Whisper large-v3 cached successfully.\n")


def download_pyannote_segmentation():
    print("=" * 60)
    print("Downloading PyAnnote segmentation model to /data/...")
    print("=" * 60)
    from huggingface_hub import hf_hub_download
    from huggingface_hub import constants as hf_constants

    os.makedirs("/data/pyannote/segmentation", exist_ok=True)

    # Download both model weights and config
    for filename in ("pytorch_model.bin", "config.yaml"):
        path = hf_hub_download(
            repo_id="pyannote/segmentation",
            filename=filename,
        )
        shutil.copy(path, f"/data/pyannote/segmentation/{filename}")
        print(f"✓ Saved {filename} to /data/pyannote/segmentation/\n")

    # Symlink SpeechBrain cache to /data/speechbrain for predict.py compatibility.
    # Use the HuggingFace Hub cache root so it respects HUGGINGFACE_HUB_CACHE.
    os.makedirs("/data/speechbrain", exist_ok=True)
    hub_cache = hf_constants.HF_HUB_CACHE
    cache_dir = os.path.join(hub_cache, "models--speechbrain--spkrec-ecapa-voxceleb")
    target = "/data/speechbrain/spkrec-ecapa-voxceleb"
    if os.path.exists(cache_dir) and not os.path.exists(target):
        os.symlink(cache_dir, target)
        print(f"✓ Symlinked SpeechBrain cache to {target}\n")


def main():
    steps = [
        ("SpeechBrain", download_speechbrain),
        ("Silero VAD", download_silero_vad),
        ("Whisper", download_whisper),
        ("PyAnnote Segmentation", download_pyannote_segmentation),
    ]

    failed = []
    for name, func in steps:
        try:
            func()
        except Exception as e:
            print(f"✗ Failed to download {name}: {e}", file=sys.stderr)
            failed.append(name)

    if failed:
        print(f"\n⚠ WARNING: The following models failed to download: {', '.join(failed)}")
        print("The server will attempt to download them at runtime.")
        # Don't fail the build — models can be downloaded at runtime
        # sys.exit(1)
    else:
        print("\n✓ All model weights downloaded successfully!")


if __name__ == "__main__":
    main()
