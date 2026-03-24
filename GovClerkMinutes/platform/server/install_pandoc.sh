#!/bin/bash

set -e

OS="$(uname -s)"

if [[ "$OS" == "Darwin" ]]; then
  echo "🍎 Detected macOS"
  brew update
  brew install pandoc || brew upgrade pandoc

elif [[ "$OS" == "Linux" ]]; then
  echo "🐧 Detected Linux (Ubuntu/Debian assumed)"

  # Get latest release URL for amd64 .deb
  LATEST_DEB=$(curl -s https://api.github.com/repos/jgm/pandoc/releases/latest \
    | grep "browser_download_url.*amd64.deb" \
    | cut -d '"' -f 4)

  if [[ -z "$LATEST_DEB" ]]; then
    echo "❌ Could not fetch latest Pandoc release URL"
    exit 1
  fi

  echo "⬇️ Downloading $LATEST_DEB"
  curl -LO "$LATEST_DEB"
  DEB_FILE=$(basename "$LATEST_DEB")

  echo "📦 Installing $DEB_FILE"
  dpkg -i "$DEB_FILE" || apt-get install -f -y

else
  echo "❌ Unsupported OS: $OS"
  exit 1
fi

echo "✅ Pandoc installation complete!"
pandoc --version
