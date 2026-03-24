#!/bin/bash

REPO_ROOT=$(git rev-parse --show-toplevel)
ENV_NAME=gcenv


# Check if conda environment already exists
if conda env list | grep -q "^$ENV_NAME\s"; then
  echo "Conda environment '$ENV_NAME' already exists."
  exit 0
fi

echo "Creating conda environment '$ENV_NAME'..."

# Accept conda Terms of Service for non-interactive usage
export CONDA_ACCEPT_TERMS=yes
export ANACONDA_ACCEPTS_TOS=yes
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main 2>/dev/null || true
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r 2>/dev/null || true

# Creates conda environment "gcenv" used on the server, and for IDE support
conda create -n $ENV_NAME python=3.11 -y
conda run -n $ENV_NAME pip install python-dotenv pyinstrument openai-whisper soundfile torchaudio speechbrain silero-vad
conda clean -afy
