#!/usr/bin/env bash

# deploy.sh — Push TURN management scripts to the remote server via rsync.
# Copies setup.sh, run.sh, and start.sh to the remote host.
# Usage:
#   ./deploy.sh                # uses defaults
#   HOST=turn.example.com ./deploy.sh
#   REMOTE_USER=ubuntu DEST_DIR=~/turn SSH_OPTS="-p 22" ./deploy.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

HOST="${HOST:-turn.GovClerkMinutes.com}"
REMOTE_USER="${REMOTE_USER:-ubuntu}"
DEST_DIR="${DEST_DIR:-~/turn}"
SSH_OPTS="${SSH_OPTS:--i $HOME/.ssh/id_rsa}"

REMOTE="${REMOTE_USER}@${HOST}"

echo "Ensuring remote directory exists: ${REMOTE}:${DEST_DIR}"
ssh ${SSH_OPTS:+${SSH_OPTS}} "${REMOTE}" "mkdir -p ${DEST_DIR}"

echo "Syncing scripts to ${REMOTE}:${DEST_DIR}"
# Mirror style from existing repo usage: verbose archive mode; allow SSH_OPTS.
rsync -av --no-o --no-g --progress -e "ssh ${SSH_OPTS}" \
  "${SCRIPT_DIR}/setup.sh" \
  "${SCRIPT_DIR}/run.sh" \
  "${SCRIPT_DIR}/turnserver.conf" \
  "${REMOTE}:${DEST_DIR}/"

# Optionally sync repo .env so setup.sh can read TURN_SERVER_KEY, TLS/NAT vars
if [[ -f "${REPO_ROOT}/.env" ]]; then
  echo "Syncing .env to ${REMOTE}:${DEST_DIR}/.env"
  rsync -av --no-o --no-g --progress -e "ssh ${SSH_OPTS}" \
    "${REPO_ROOT}/.env" "${REMOTE}:${DEST_DIR}/.env"
else
  echo "NOTE: .env not found at ${REPO_ROOT}/.env; skipping"
fi

# Ensure scripts are executable on remote
ssh ${SSH_OPTS:+${SSH_OPTS}} "${REMOTE}" "chmod +x ${DEST_DIR}/setup.sh ${DEST_DIR}/run.sh"

echo "Deploy complete. On the remote host, you can run:"
echo "  ${DEST_DIR}/setup.sh" 
echo "  ${DEST_DIR}/run.sh --follow"
