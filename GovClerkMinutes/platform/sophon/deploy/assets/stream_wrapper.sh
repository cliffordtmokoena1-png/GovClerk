#!/bin/bash

set -e
set -o pipefail

# 1. Variables
STREAM_KEY="$1"
LOG_DIR="/var/log/sophon"
FFMPEG_LOG="${LOG_DIR}/ffmpeg.log"
INGEST_LOG="${LOG_DIR}/rtmp-ingest.log"
INGEST_SCRIPT="/var/www/sophon/dist/rtmp-ingest.js"
DB_PATH="/var/www/sophon/sophon.db"

# 2. Log that the script started
echo "[$(date)] Starting wrapper for key: $STREAM_KEY" >> "$INGEST_LOG"

# 3. The Pipeline
# Start a new session so everything shares one PGID
exec setsid bash -c '
  trap "kill 0" EXIT
  ffmpeg -i rtmp://localhost/live/'"$STREAM_KEY"' \
    -vn -acodec pcm_s16le -ar 16000 -ac 1 -f s16le - \
    2>>"'"$FFMPEG_LOG"'" \
    | DB_PATH="/var/www/sophon/sophon.db" node "'"$INGEST_SCRIPT"'" "'"$STREAM_KEY"'" \
      >>"'"$INGEST_LOG"'" 2>&1
'
