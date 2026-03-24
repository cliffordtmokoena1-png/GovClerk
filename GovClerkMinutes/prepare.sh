#!/bin/bash

set -e

echo "Starting post-install script...."

echo "Installing Husky..."
husky install

if [ "$VERCEL" = "1" ]; then
  echo "Detected Vercel environment. Skipping rustup and Clippy installation."
else
  # Assume rustup is available and add Clippy
  echo "Adding Clippy via rustup..."
  rustup component add clippy
  rustup component add rustfmt

  if [ "$(uname)" == "Darwin" ]; then
    # Needed to build ffmpeg-sys-next
    if ! brew list yasm &>/dev/null; then
      echo "Installing yasm..."
      brew install yasm
    else
      echo "yasm is already installed."
    fi

    if ! brew list runpodctl &>/dev/null; then
      echo "Installing runpodctl..."
      brew install runpod/runpodctl/runpodctl
    else
      echo "runpodctl is already installed."
    fi

    # Needed for PDF export support in pandoc
    brew install --cask basictex

    # Run helper scripts as subprocesses so their `exit` won't kill this script
    bash platform/server/create_conda_env.sh
    bash platform/server/install_pandoc.sh
  else
    sudo apt-get install yasm  # Needed to build ffmpeg-sys-next
  fi
fi

echo "Post-install script completed."
