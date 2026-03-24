#!/usr/bin/env bash

# setup.sh — One-time setup for the Sophon server.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"

# Configurable inputs
DOMAIN="${DOMAIN:-sophon.GovClerkMinutes.com}"
EMAIL_DEFAULT="cliff@govclerkminutes.com"
EMAIL="${EMAIL:-${1:-${EMAIL_DEFAULT}}}"

# Load environment variables from colocated .env if present
if [[ -f "${SCRIPT_DIR}/.env" ]]; then
	echo "Loading environment from ${SCRIPT_DIR}/.env"
	set -a
	# shellcheck disable=SC1090
	source "${SCRIPT_DIR}/.env"
	set +a
fi

echo "Setting up Sophon for domain: ${DOMAIN}"

echo "Updating apt and installing dependencies..."
sudo apt-get update -y
sudo apt-get install -y curl gnupg ca-certificates

# Install Node.js 22
echo "Installing Node.js 22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "Installing dependencies"
sudo apt-get install -y nginx certbot python3-certbot-nginx libnginx-mod-rtmp ffmpeg

# Install project dependencies
if [[ -f "${SCRIPT_DIR}/package.json" ]]; then
    echo "Installing project dependencies..."
    cd "${SCRIPT_DIR}"

    # Puppeteer uses a special cache for chrome binaries
    PUPPETEER_CACHE_PATH="${SCRIPT_DIR}/.puppeteer_cache"

    # 1. Clean up
    sudo rm -rf "${SCRIPT_DIR}/.npm"
    sudo rm -rf "${SCRIPT_DIR}/.cache"

    # 2. Ensure node_modules and Puppeteer cache directory exist
    sudo mkdir -p "${SCRIPT_DIR}/node_modules"
    sudo mkdir -p "${PUPPETEER_CACHE_PATH}"

    # 3. Set ownership
    sudo chown -R www-data:www-data "${SCRIPT_DIR}/node_modules"
    sudo chown -R www-data:www-data "${PUPPETEER_CACHE_PATH}"

    # 4. Install using the specific, custom path
    echo "Running npm install as www-data..."
    sudo -u www-data env PUPPETEER_CACHE_DIR="${PUPPETEER_CACHE_PATH}" npm install --production --no-audit --cache /tmp/sophon_npm_cache
fi

# Create log directory for Sophon
LOG_DIR="/var/log/sophon"
echo "Creating log directory: ${LOG_DIR}"
sudo mkdir -p "${LOG_DIR}"
sudo chown www-data:www-data "${LOG_DIR}"
sudo chmod 755 "${LOG_DIR}"

# Create HLS directory
HLS_DIR="/var/www/hls"
echo "Creating HLS directory: ${HLS_DIR}"
sudo mkdir -p "${HLS_DIR}"
sudo chown -R www-data:www-data "${HLS_DIR}"

# 1. Run Nginx setup FIRST to generate the HTTP config file
echo "Running Nginx setup..."
sudo chmod +x "${SCRIPT_DIR}/assets/setup_config.sh"
"${SCRIPT_DIR}/assets/setup_config.sh"

# 2. Reload Nginx so it loads the new HTTP config
# Certbot needs Nginx to be running and aware of the domain to verify it
echo "Reloading Nginx to apply HTTP config..."
sudo systemctl reload nginx

# 3. Certbot
echo "Requesting/renewing TLS certificate via certbot (email=${EMAIL})..."
sudo certbot --nginx \
  --cert-name "${DOMAIN}" \
  -d "${DOMAIN}" \
  --agree-tos \
  -m "${EMAIL}" \
  --non-interactive \
  --redirect

echo "Setup complete."
