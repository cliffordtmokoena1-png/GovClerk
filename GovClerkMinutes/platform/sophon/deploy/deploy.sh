#!/usr/bin/env bash

# deploy.sh — Build and push Sophon to the remote server via rsync.
# Usage:
#   ./deploy.sh                              # uses defaults
#   ./deploy.sh -i ~/.ssh/my_key             # specify identity key
#   HOST=sophon.example.com ./deploy.sh

set -euo pipefail

IDENTITY_KEY=""
while getopts "i:" opt; do
  case ${opt} in
    i)
      IDENTITY_KEY="${OPTARG}"
      ;;
    *)
      echo "Usage: $0 [-i identity_key]"
      exit 1
      ;;
  esac
done
shift $((OPTIND - 1))

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

HOST="${HOST:-sophon.GovClerkMinutes.com}"
REMOTE_USER="${REMOTE_USER:-ubuntu}"
STAGING_DIR="~/sophon-staging"
FINAL_DIR="/var/www/sophon"
LOG_DIR="/var/log/sophon"

# -i flag takes precedence, then SSH_OPTS env var, then default
if [[ -n "${IDENTITY_KEY}" ]]; then
  SSH_OPTS="-i ${IDENTITY_KEY}"
elif [[ -z "${SSH_OPTS:-}" ]]; then
  SSH_OPTS="-i $HOME/.ssh/id_rsa"
fi

REMOTE="${REMOTE_USER}@${HOST}"

echo "Building project..."
cd "${PROJECT_ROOT}"
npm run build

echo "Ensuring staging directory exists: ${REMOTE}:${STAGING_DIR}"
ssh ${SSH_OPTS:+${SSH_OPTS}} "${REMOTE}" "mkdir -p ${STAGING_DIR}"

echo "Syncing files to ${REMOTE}:${STAGING_DIR}"
rsync -av --no-o --no-g --progress -e "ssh ${SSH_OPTS}" \
  "${PROJECT_ROOT}/dist" \
  "${PROJECT_ROOT}/package.json" \
  "${PROJECT_ROOT}/package-lock.json" \
  "${SCRIPT_DIR}/setup.sh" \
  "${SCRIPT_DIR}/build.sh" \
  "${SCRIPT_DIR}/assets" \
  "${REMOTE}:${STAGING_DIR}/"

# Optionally sync repo .env
if [[ -f "${REPO_ROOT}/.env" ]]; then
  echo "Syncing .env to ${REMOTE}:${STAGING_DIR}/.env"
  rsync -av --no-o --no-g --progress -e "ssh ${SSH_OPTS}" \
    "${REPO_ROOT}/.env" "${REMOTE}:${STAGING_DIR}/.env"
fi

echo "Moving to ${FINAL_DIR} and setting permissions..."
ssh ${SSH_OPTS:+${SSH_OPTS}} "${REMOTE}" "
  sudo mkdir -p ${FINAL_DIR}
  sudo rsync -a --delete ${STAGING_DIR}/ ${FINAL_DIR}/
  sudo chown -R www-data:www-data ${FINAL_DIR}
  sudo chmod +x ${FINAL_DIR}/*.sh
  rm -rf ${STAGING_DIR}
  sudo ln -sfnT -sf ${FINAL_DIR} ~/sophon
  sudo ln -sfnT -sf ${LOG_DIR} ~/logs
"

echo "Deploy complete. On the remote host, you can run:"
echo "  sudo /var/www/sophon/build.sh"
