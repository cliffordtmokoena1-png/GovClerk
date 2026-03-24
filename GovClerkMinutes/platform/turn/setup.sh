#!/usr/bin/env bash

# setup.sh — One-time setup for the TURN (coturn) server on a fresh machine.
# Run this once on the target server to install coturn, obtain TLS certs,
# generate a shared secret, write /etc/turnserver.conf, and enable/start the service.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Configurable inputs
# DOMAIN defaults to the production TURN hostname. Override by exporting DOMAIN.
DOMAIN="${DOMAIN:-turn.GovClerkMinutes.com}"
# EMAIL defaults to ops email; can be overridden via env or first arg.
EMAIL_DEFAULT="cliff@govclerkminutes.com"
EMAIL="${EMAIL:-${1:-${EMAIL_DEFAULT}}}"
# TLS port for TURN over TLS (commonly 5349 or 443)
TLS_PORT="${TLS_PORT:-5349}"
# Optional NAT mapping; set EXTERNAL_IP and PRIVATE_IP, or provide EXTERNAL_IP_LINE directly
EXTERNAL_IP="${EXTERNAL_IP:-}"
PRIVATE_IP="${PRIVATE_IP:-}"
EXTERNAL_IP_LINE="${EXTERNAL_IP_LINE:-}"

# Load environment variables from colocated .env if present (for TURN_SERVER_KEY, etc.)
if [[ -f "${SCRIPT_DIR}/.env" ]]; then
	echo "Loading environment from ${SCRIPT_DIR}/.env"
	set -a
	# shellcheck disable=SC1090
	source "${SCRIPT_DIR}/.env"
	set +a
fi

echo "Setting up coturn for domain: ${DOMAIN}"

echo "Updating apt and installing dependencies..."
sudo apt-get update -y
# curl is used for metadata queries; iproute2 is typically present by default
sudo apt-get install -y coturn certbot ssl-cert curl || true

# Ensure coturn service is enabled on Debian/Ubuntu (commonly disabled by default)
if [[ -f /etc/default/coturn ]]; then
	echo "Enabling coturn in /etc/default/coturn..."
	sudo sed -i 's/^#\?TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn || true
fi

echo "Ensuring verbose mode and config path in /etc/default/coturn..."
# Ensure TURNSERVER_OPTIONS is present and correct
if grep -q '^TURNSERVER_OPTIONS=' /etc/default/coturn; then
	sudo sed -i 's|^TURNSERVER_OPTIONS=.*|TURNSERVER_OPTIONS="-v -c /etc/turnserver.conf"|' /etc/default/coturn
else
	echo 'TURNSERVER_OPTIONS="-v -c /etc/turnserver.conf"' | sudo tee -a /etc/default/coturn >/dev/null
fi

# Patch systemd unit to use /etc/default/coturn if not already
if ! systemctl cat coturn | grep -q 'EnvironmentFile=-/etc/default/coturn'; then
	echo "Adding systemd drop-in override to source /etc/default/coturn..."
	sudo mkdir -p /etc/systemd/system/coturn.service.d
	sudo bash -c 'cat > /etc/systemd/system/coturn.service.d/override.conf <<EOF
[Service]
EnvironmentFile=-/etc/default/coturn
ExecStart=
ExecStart=/usr/bin/turnserver \$TURNSERVER_OPTIONS
EOF'
	sudo systemctl daemon-reload
fi

echo "Requesting/renewing TLS certificate via certbot (email=${EMAIL})..."
# Use standalone mode (requires port 80 inbound). This is non-interactive.
sudo certbot certonly \
  --standalone \
  --cert-name "${DOMAIN}" \
  --key-type rsa \
  -d "${DOMAIN}" \
  --agree-tos \
  -m "${EMAIL}" \
  --non-interactive


echo "Granting service user access to certificates..."

# Determine service user (varies by distro)
SERVICE_USER=""
if id -u turnserver >/dev/null 2>&1; then
	SERVICE_USER="turnserver"
elif id -u coturn >/dev/null 2>&1; then
	SERVICE_USER="coturn"
fi

if [[ -n "${SERVICE_USER}" ]]; then
	echo "Adding ${SERVICE_USER} to ssl-cert group..."
	sudo usermod -aG ssl-cert "${SERVICE_USER}" || true
fi

echo "Setting group and permissions on Let's Encrypt directories..."
if [[ -d /etc/letsencrypt/live && -d /etc/letsencrypt/archive ]]; then
	sudo chgrp -R ssl-cert /etc/letsencrypt/live /etc/letsencrypt/archive || true
	sudo chmod 750 /etc/letsencrypt/live /etc/letsencrypt/archive || true
else
	echo "WARNING: /etc/letsencrypt live/archive directories not found. Skipping chgrp/chmod." >&2
fi

LE_LIVE_DIR="/etc/letsencrypt/live/${DOMAIN}"
LE_ARCHIVE_DIR="/etc/letsencrypt/archive/${DOMAIN}"
if [[ -d "${LE_LIVE_DIR}" ]]; then
	sudo chmod 640 "${LE_LIVE_DIR}/fullchain.pem" "${LE_LIVE_DIR}/privkey.pem" || true
else
	echo "WARNING: ${LE_LIVE_DIR} not found; certs may not have been issued yet." >&2
fi
if [[ -d "${LE_ARCHIVE_DIR}" ]]; then
	sudo chmod 640 ${LE_ARCHIVE_DIR}/fullchain*.pem ${LE_ARCHIVE_DIR}/privkey*.pem || true
fi

SECRET_VALUE="${TURN_SERVER_KEY:-}"
if [[ -z "${SECRET_VALUE}" ]]; then
	echo "TURN_SERVER_KEY not set, is .env there?"
  exit 1
fi

# --- Dynamic NAT mapping detection (PUBLIC/PRIVATE) ---
# If EXTERNAL_IP_LINE is not explicitly set, try to infer it when both a public and private IPv4 are available.
if [[ -z "${EXTERNAL_IP_LINE}" ]]; then
	# Only attempt detection if either EXTERNAL_IP or PRIVATE_IP is missing
	if [[ -z "${EXTERNAL_IP}" || -z "${PRIVATE_IP}" ]]; then
		echo "Attempting to detect private and public IPs for NAT mapping..."

		# Detect default interface and its IPv4 (private IP)
		if [[ -z "${PRIVATE_IP}" ]]; then
			DEFAULT_IFACE="$(ip route show default 0.0.0.0/0 | awk '{print $5}' | head -n1 || true)"
			if [[ -n "${DEFAULT_IFACE}" ]]; then
				PRIVATE_IP="$(ip -o -4 addr show dev "${DEFAULT_IFACE}" scope global | awk '{print $4}' | cut -d/ -f1 | head -n1 || true)"
			fi
		fi

		# Detect public IPv4 via cloud metadata first (link-local, no Internet egress)
		if [[ -z "${EXTERNAL_IP}" ]]; then
			# AWS EC2 metadata
			EXTERNAL_IP="$(curl -s --connect-timeout 1 --max-time 2 http://169.254.169.254/latest/meta-data/public-ipv4 || true)"
		fi
		if [[ -z "${EXTERNAL_IP}" ]]; then
			# GCP metadata
			EXTERNAL_IP="$(curl -s --connect-timeout 1 --max-time 2 -H "Metadata-Flavor: Google" \
				http://169.254.169.254/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip || true)"
		fi
		if [[ -z "${EXTERNAL_IP}" ]]; then
			# Azure metadata
			EXTERNAL_IP="$(curl -s --connect-timeout 1 --max-time 2 -H "Metadata:true" \
				"http://169.254.169.254/metadata/instance/network/interface/0/ipv4/ipAddress/0/publicIpAddress?api-version=2021-02-01&format=text" || true)"
		fi
		if [[ -z "${EXTERNAL_IP}" ]]; then
			# Last-resort public IP discovery via external resolver (may be blocked on some networks)
			EXTERNAL_IP="$(dig +short myip.opendns.com @resolver1.opendns.com 2>/dev/null | head -n1 || true)"
		fi
		if [[ -z "${EXTERNAL_IP}" ]]; then
			# Fallback to ipify if dig not available
			EXTERNAL_IP="$(curl -s --connect-timeout 2 --max-time 3 https://api.ipify.org || true)"
		fi

		echo "Detected PRIVATE_IP='${PRIVATE_IP:-}' EXTERNAL_IP='${EXTERNAL_IP:-}'"
	fi

	if [[ -n "${EXTERNAL_IP}" && -n "${PRIVATE_IP}" ]]; then
		EXTERNAL_IP_LINE="external-ip=${EXTERNAL_IP}/${PRIVATE_IP}"
	fi
fi

# Use the deployed template turnserver.conf and substitute placeholders.
TEMPLATE_PATH="${SCRIPT_DIR}/turnserver.conf"
if [[ ! -f "${TEMPLATE_PATH}" ]]; then
	echo "ERROR: Template not found: ${TEMPLATE_PATH}. Ensure deploy.sh copied it." >&2
	exit 1
fi

TURN_CONF="/etc/turnserver.conf"
if [[ -f "${TURN_CONF}" ]]; then
	echo "Backing up existing ${TURN_CONF} to ${TURN_CONF}.bak.$(date +%s)"
	sudo cp "${TURN_CONF}" "${TURN_CONF}.bak.$(date +%s)"
fi

echo "Rendering ${TURN_CONF} from template..."

# Build optional NAT mapping line (after dynamic detection above)
EXTERNAL_LINE_RENDERED="${EXTERNAL_IP_LINE}"

sudo bash -c "\
	sed \
		-e 's/{{DOMAIN}}/${DOMAIN//\//\\/}/g' \
		-e 's/{{STATIC_AUTH_SECRET}}/${SECRET_VALUE//\//\\/}/g' \
		-e 's/{{TLS_PORT}}/${TLS_PORT//\//\\/}/g' \
		-e 's/{{EXTERNAL_IP_LINE}}/${EXTERNAL_LINE_RENDERED//\//\\/}/g' \
		'${TEMPLATE_PATH}' > '${TURN_CONF}'
"

echo "Ensuring log file exists and is writable: /var/log/turnserver.log"
sudo touch /var/log/turnserver.log
sudo chmod 640 /var/log/turnserver.log
# Try to chown to the service user if it exists; ignore failures
if id -u turnserver >/dev/null 2>&1; then
	sudo chown turnserver:turnserver /var/log/turnserver.log || true
elif id -u coturn >/dev/null 2>&1; then
	sudo chown coturn:coturn /var/log/turnserver.log || true
fi

echo "Enabling and restarting coturn service..."
sudo systemctl enable coturn
sudo systemctl restart coturn

echo "coturn status (truncated):"
sudo systemctl --no-pager --full status coturn | sed -n '1,25p' || true

echo
echo "Setup complete. To follow logs, run:"
echo "  sudo journalctl -u coturn -f"
echo "  sudo tail -f /var/log/turnserver.log"
