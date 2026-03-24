#!/usr/bin/env bash

set -euo pipefail

# Ensure the script is run as root
if [ "$(id -u)" -ne 0 ]; then
    echo "This script must be run as root. Please use sudo."
    exit 1
fi

# Navigate to the application directory
cd /var/www/sophon

echo "Installing dependencies..."
# Install production dependencies
npm ci --omit=dev

echo "Restarting Nginx..."
systemctl restart nginx

echo "Build script completed successfully."
