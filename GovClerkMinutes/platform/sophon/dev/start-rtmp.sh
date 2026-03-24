#!/bin/bash
# Start nginx-rtmp in Docker for local development
# Usage: ./start-rtmp.sh

cd "$(dirname "$0")"

echo "Starting nginx-rtmp server..."
echo "  RTMP: rtmp://localhost/live"
echo "  HLS:  http://localhost:8080/hls/{stream_key}.m3u8"
echo ""
echo "Make sure Sophon is running on port 3000 first!"
echo ""

docker compose up -d

echo ""
echo "To stop: docker compose down (from this directory)"
echo "To view logs: docker compose logs -f"
