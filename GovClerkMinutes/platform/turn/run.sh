#!/usr/bin/env bash

# run.sh — Start/restart the TURN (coturn) service.
# Safe to run multiple times. Intended for ongoing operations, not initial setup.

set -euo pipefail

FOLLOW="false"
if [[ "${1:-}" == "-f" || "${1:-}" == "--follow" ]]; then
  FOLLOW="true"
fi

LOG_PATH="/var/log/turnserver.log"

echo "Preparing log file at ${LOG_PATH}..."
sudo touch "${LOG_PATH}"
sudo chmod 640 "${LOG_PATH}"
if id -u turnserver >/dev/null 2>&1; then
  sudo chown turnserver:turnserver "${LOG_PATH}" || true
elif id -u coturn >/dev/null 2>&1; then
  sudo chown coturn:coturn "${LOG_PATH}" || true
fi

echo "Enabling coturn service..."
sudo systemctl enable coturn

echo "Restarting coturn..."
sudo systemctl restart coturn

CERT_PATH="$(awk -F= '/^cert=/ {print $2}' /etc/turnserver.conf | head -n1 || true)"
PKEY_PATH="$(awk -F= '/^pkey=/ {print $2}' /etc/turnserver.conf | head -n1 || true)"
if [[ -n "${CERT_PATH}" && -n "${PKEY_PATH}" ]]; then
  if [[ ! -f "${CERT_PATH}" || ! -f "${PKEY_PATH}" ]]; then
    echo "WARNING: TLS cert or key not found (cert=${CERT_PATH} key=${PKEY_PATH}). TLS listeners may not start." >&2
    echo "         If this is first-time setup, run setup.sh to obtain certificates via certbot." >&2
  fi
fi

if [[ "${FOLLOW}" == "true" ]]; then
  echo "Following coturn logs (Ctrl+C to exit)..."
  sudo journalctl -u coturn -f
else
  echo "coturn status (truncated):"
  sudo systemctl --no-pager --full status coturn | sed -n '1,20p' || true
  echo
  echo "Recent coturn logs:"
  sudo journalctl -u coturn -n 50 --no-pager || true
  echo
  echo "Tip: pass --follow to tail logs live."
fi
