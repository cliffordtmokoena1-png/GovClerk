#!/bin/bash

# Run this script once when setting up a new server

echo 'set -o vi' >> ~/.bashrc

bash create_conda_env.sh
bash install_pandoc.sh

# Install rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
. "$HOME/.cargo/env"

apt-get install yasm libclang-dev

. ~/.bashrc

# Add cloudflare gpg key
mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
# Add this repo to your apt repositories
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared jammy main' | tee /etc/apt/sources.list.d/cloudflared.list

# install packages 
apt-get update
apt-get install cloudflared jq texlive-latex-base texlive-latex-recommended texlive-latex-extra -y

export CF_ACCOUNT_ID=$(grep CF_ACCOUNT_ID ~/.env | cut -d '=' -f2 | tr -d '"')
export CF_API_KEY=$(grep CF_API_KEY ~/.env | cut -d '=' -f2 | tr -d '"')

# Check if server-prod tunnel is active
if [ -z "$CF_ACCOUNT_ID" ] || [ -z "$CF_API_KEY" ]; then
  echo "Error: CF_ACCOUNT_ID and CF_API_KEY environment variables must be set."
  exit 1
fi

TUNNEL_STATUS=$(curl -X GET "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/tunnels" \
     -H "Authorization: Bearer $CF_API_KEY" \
     -H "Content-Type:application/json" | \
     grep -A10 '"name":"server-prod"' | grep '"status":' | awk -F'"' '{print $4}')

if [ "$TUNNEL_STATUS" = "healthy" ]; then
  echo "Error: 'server-prod' tunnel is already active. Halting cloudflared setup."
  exit 1
fi

echo "'server-prod' tunnel is not active. Proceeding with setup."

export CF_DAEMON_KEY=$(grep CF_DAEMON_KEY ~/.env | cut -d '=' -f2 | tr -d '"')
cloudflared service install $CF_DAEMON_KEY

echo 'Cloudflared status:'
service cloudflared status