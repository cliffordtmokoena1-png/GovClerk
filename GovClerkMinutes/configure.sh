#!/usr/bin/env bash

set -euo pipefail

RIA_USER_SHELL=$(basename "$SHELL")

# Detect OS
OS_TYPE="$(uname -s)"
IS_MACOS="false"
IS_LINUX="false"

case "$OS_TYPE" in
    Darwin*) 
        IS_MACOS="true" 
        ;;
    Linux*)
        IS_LINUX="true"
        ;;
    *)
        echo "Unsupported OS: $OS_TYPE"
        exit 1
        ;;
esac

# Helper functions
install_brew_macos() {
    if ! command -v brew &>/dev/null; then
        echo "Installing Homebrew on macOS..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$HOME/.bashrc"
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$HOME/.zshrc"
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
}

install_brew_linux() {
    if ! command -v brew &>/dev/null; then
        echo "Installing Homebrew on Linux..."
        NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        echo 'eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"' >> "$HOME/.bashrc"
        echo 'eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"' >> "$HOME/.zshrc"
        eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
    fi
}

# Install Homebrew and required packages
if [ "$IS_MACOS" = "true" ]; then
    install_brew_macos
    brew update

    # Install packages via brew on macOS
    brew install gh git yasm ffmpeg rustup
    # build-essential equivalent on macOS is Xcode command line tools (should be pre-installed or user prompted)
    # runpodctl for macOS
    brew install runpod/runpodctl/runpodctl

    # Additional macOS steps
    brew tap SergioBenitez/osxct
    brew install x86_64-unknown-linux-gnu

elif [ "$IS_LINUX" = "true" ]; then
    install_brew_linux
    brew update

    # For Linux build-essential is needed
    brew install gh git build-essential yasm ffmpeg rustup

    # runpodctl on Linux
    wget -qO- cli.runpod.net | sudo bash
fi

# Rust setup
if ! command -v rustup &>/dev/null; then
    echo "Rustup not found, installing..."
    rustup-init -y
    source "$HOME/.cargo/env"
fi

rustup install stable
cargo install cargo-watch

# NVM Setup
if [ ! -d "$HOME/.nvm" ]; then
    echo "Installing nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.4/install.sh | bash

    export NVM_DIR="$HOME/.nvm"
    # shellcheck disable=SC1091
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
fi

# Load NVM if not already loaded
if ! command -v nvm &>/dev/null; then
    export NVM_DIR="$HOME/.nvm"
    # shellcheck disable=SC1091
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# Install and use Node v18.17.1 as default if no default present
DEFAULT_NODE=$(nvm alias default | awk '{print $3}' || true)
if [ -z "$DEFAULT_NODE" ] || [ "$DEFAULT_NODE" = "node" ]; then
    echo "Setting up Node v18.17.1 as default..."
    nvm install v18.17.1
    nvm alias default v18.17.1
    nvm use default
fi

# Global npm packages
npm install -g vercel

# Finally, run `npm install` in current directory if package.json exists
if [ -f package.json ]; then
    npm install
fi

# Reload shell configuration
if [ -f "$HOME/.bashrc" ]; then
    source "$HOME/.bashrc"
fi

if [ -f "$HOME/.zshrc" ]; then
    source "$HOME/.zshrc"
fi

echo "Developer environment setup complete! Please refer to the README for further instructions."
