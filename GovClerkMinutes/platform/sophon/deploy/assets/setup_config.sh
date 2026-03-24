#!/usr/bin/env bash

# setup_nginx.sh — Configure Nginx for HTTP and RTMP.

set -euo pipefail

DOMAIN="${DOMAIN:-sophon.GovClerkMinutes.com}"
# Assuming the app is deployed to ~/sophon and user is ubuntu. 
# Adjust APP_DIR if deployed elsewhere.
APP_DIR="${APP_DIR:-/var/www/sophon}"
NODE_SCRIPT_PATH="${APP_DIR}/dist/index.js"
USER="www-data"

echo "Configuring Nginx for domain: ${DOMAIN}"
echo "Node script path: ${NODE_SCRIPT_PATH}"

# 1. Update & Install Dependencies
echo "Installing Nginx, RTMP module, and FFmpeg..."
sudo apt-get update
sudo apt-get install -y nginx libnginx-mod-rtmp ffmpeg

# 2. Configure HTTP (Reverse Proxy)
echo "Configuring HTTP Site..."
cat <<EOF | sudo tee /etc/nginx/sites-available/sophon
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    location /hls {
        alias /var/www/hls;
        add_header Cache-Control no-cache;
        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS';
        
        if (\$request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*';
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain charset=UTF-8';
            add_header 'Content-Length' 0;
            return 204;
        }

        types {
            application/vnd.apple.mpegurl m3u8;
            video/mp2t ts;
        }
    }
}
EOF

# Enable the site by linking it
sudo ln -sf /etc/nginx/sites-available/sophon /etc/nginx/sites-enabled/
# Remove the default "Welcome to Nginx" site
sudo rm -f /etc/nginx/sites-enabled/default

# 3. Configure RTMP
echo "Configuring RTMP..."

# Install stream wrapper script
echo "Installing stream wrapper script..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ -f "${SCRIPT_DIR}/stream_wrapper.sh" ]]; then
    sudo cp "${SCRIPT_DIR}/stream_wrapper.sh" /usr/local/bin/stream_wrapper.sh
    sudo chmod +x /usr/local/bin/stream_wrapper.sh
else
    echo "Error: stream_wrapper.sh not found in ${SCRIPT_DIR}"
    exit 1
fi

# Create the dedicated RTMP config file
cat <<EOF | sudo tee /etc/nginx/rtmp.conf
rtmp {
    server {
        listen 1935;
        chunk_size 4096;

        application live {
            live on;
            record off;

            exec_kill_signal term;

            # Stream callbacks
            on_publish http://localhost:3000/rtmp/on-publish;
            on_done http://localhost:3000/rtmp/on-done;

            # Pass the stream name (\$name) as the first argument to the script
            exec_push /usr/local/bin/stream_wrapper.sh \$name;

            # HLS Configuration
            hls on;
            hls_path /var/www/hls;
            hls_fragment 2s;
            hls_playlist_length 10s;
            hls_cleanup on;
        }
    }
}
EOF

# 4. Link RTMP Config to Main Nginx Config
# We append an 'include' line to the end of nginx.conf if it's not already there.
if ! grep -q "include /etc/nginx/rtmp.conf;" /etc/nginx/nginx.conf; then
    echo "Adding RTMP include to main nginx.conf..."
    echo -e "\ninclude /etc/nginx/rtmp.conf;" | sudo tee -a /etc/nginx/nginx.conf
fi

# 5. Configure Systemd Services
echo "Creating sophon.service..."
cat <<EOF | sudo tee /etc/systemd/system/sophon.service
[Unit]
Description=Sophon Node.js Server
After=network.target
PartOf=sophon-target.target

[Service]
User=${USER}
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/node ${NODE_SCRIPT_PATH}
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=DB_PATH=${APP_DIR}/sophon.db

[Install]
WantedBy=multi-user.target
EOF

echo "Creating sophon-target.target..."
cat <<EOF | sudo tee /etc/systemd/system/sophon-target.target
[Unit]
Description=Sophon Full Stack (Nginx + Node)
Requires=nginx.service sophon.service
After=network.target

[Install]
WantedBy=multi-user.target
EOF

echo "Linking Nginx to Sophon Target..."
sudo mkdir -p /etc/systemd/system/nginx.service.d
echo -e "[Unit]\nPartOf=sophon-target.target" | sudo tee /etc/systemd/system/nginx.service.d/sophon-override.conf

# 6. Configure Logrotate
echo "Configuring Logrotate..."
cat <<EOF | sudo tee /etc/logrotate.d/sophon
/var/log/sophon/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 www-data www-data
    copytruncate
}
EOF

# 7. Reload and Enable
echo "Reloading Systemd..."
sudo systemctl daemon-reload

echo "Enabling services..."
sudo systemctl enable sophon.service
sudo systemctl enable sophon-target.target

# 8. Start Everything
echo "Starting Stack..."
# Ensure Nginx picks up new config
if systemctl is-active --quiet nginx; then
    sudo systemctl reload nginx
else
    sudo systemctl start nginx
fi
sudo systemctl start sophon-target.target

echo "Nginx setup complete! Stream URL: rtmp://${DOMAIN}/live"
echo "Status:"
sudo systemctl status sophon-target.target
