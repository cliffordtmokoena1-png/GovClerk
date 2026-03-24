# Deploying GovClerk to RunPod

This guide explains how to deploy the GovClerk Rust backend server to a RunPod GPU Pod.

---

## Service Architecture

The GovClerk platform is made up of several independent services. **Only the Rust backend
is deployed via this Docker image.** The other services run separately:

| Service | Port | Technology | Where it runs |
|---------|------|------------|---------------|
| **Rust backend** (transcription/AI) | **8000** | Rust (Axum) | RunPod Docker container |
| **Sophon** (media/crawler/HLS/WebSocket) | **3000** | Node.js (Hono) | Separate server (NOT in this image) |
| **Next.js frontend** | 3223 (dev) / 3000 (prod) | Next.js | Vercel (NOT in this image) |
| **RTMP** | **1935** | Nginx RTMP | Separate server (NOT in this image) |

> ⚠️ **`localhost:3000` will NOT work inside this container.** Port 3000 belongs to the
> Sophon Node.js server, which is not included in the Docker image. Always use port 8000
> for the Rust backend.

### Network topology

```
Internet / Vercel frontend
        │
        ▼
RunPod pod (public IP)
        │  HTTP proxy on port 8000
        ▼
Docker container
        │
        ▼
Rust server on 0.0.0.0:8000   ← binds to all interfaces, correct for Docker
```

The Rust binary accepts a `--port` flag (default `8000`) and binds to `0.0.0.0`, making
it reachable from outside the container without extra configuration.

---

## Prerequisites

- A RunPod account
- An SSH key pair configured in RunPod
- GitHub Container Registry (GHCR) access to pull the Docker image
- All required environment variables (see below)

---

## Step 1: Build and Push the Docker Image

The `Dockerfile` is at the repository root. Build from the repo root with:

```bash
# From the repository root:
docker build -t ghcr.io/cliffordtmokoena1-png/govclerk-server:latest .

# Push to GHCR:
echo $GITHUB_TOKEN | docker login ghcr.io -u cliffordtmokoena1-png --password-stdin
docker push ghcr.io/cliffordtmokoena1-png/govclerk-server:latest
```

---

## Step 2: Create a RunPod GPU Pod

1. Go to [RunPod Console](https://www.runpod.io/console/pods)
2. Click **Deploy** or create a new Pod
3. Select a GPU (RTX A4000 or better recommended for ML workloads)
4. Under **Container Image**, enter:
   ```
   ghcr.io/cliffordtmokoena1-png/govclerk-server:latest
   ```
5. Set **Exposed HTTP Ports** to `8000`
6. Add your SSH public key as the `PUBLIC_KEY` environment variable
7. Add all required environment variables (see below)
8. Deploy the pod

RunPod exposes HTTP ports via their reverse proxy. SSH is available on port 22.

---

## Step 3: Verify the Deployment

Once the pod is running, confirm the Rust server is healthy:

```bash
# From inside the container (via RunPod terminal or SSH):
curl http://localhost:8000/api/monitor

# From outside (replace <pod-ip> with your RunPod pod IP):
curl http://<pod-ip>:8000/api/monitor
```

You should receive a `200 OK` response. The container also has an automatic
`HEALTHCHECK` that polls this endpoint every 30 seconds.

---

## Environment Variables

Set these in your RunPod pod configuration or in a `.env` file on the pod:

| Variable | Purpose |
|----------|---------|
| `PUBLIC_KEY` | Your SSH public key for RunPod remote access |
| `DATABASE_URL` | MySQL/PlanetScale connection string |
| `AWS_ACCESS_KEY_ID` | S3 access key for audio storage |
| `AWS_SECRET_ACCESS_KEY` | S3 secret key |
| `AWS_DEFAULT_REGION` | S3 region (e.g. `us-east-1`) |
| `OPENAI_KEY` | OpenAI API key (Whisper + GPT) |
| `GEMINI_PRO_15_API_KEY` | Google Gemini API key (minutes generation) |
| `UPLOAD_COMPLETE_WEBHOOK_SECRET` | Bearer token for webhook auth |
| `CLERK_SECRET_KEY` | Clerk authentication secret key |
| `RUNPOD_API_KEY` | RunPod API key (for the deploy script) |

The startup script in the container's `CMD` writes all environment variables to
`/app/server/.env` so the Rust binary can read them via the `dotenv` crate.

---

## Running Locally (for Testing)

```bash
docker run -p 8000:8000 \
  -e PUBLIC_KEY="your-ssh-public-key" \
  -e DATABASE_URL="mysql://..." \
  -e AWS_ACCESS_KEY_ID="..." \
  -e AWS_SECRET_ACCESS_KEY="..." \
  -e OPENAI_KEY="..." \
  ghcr.io/cliffordtmokoena1-png/govclerk-server:latest
```

Then verify: `curl http://localhost:8000/api/monitor`

---

## Troubleshooting

### `ERR_CONNECTION_REFUSED` on `localhost:3000`

**Cause:** You are trying to reach the Sophon Node.js server (port 3000), which is
**not included** in this Docker image.

**Fix:** Use port 8000 for the Rust backend:
```bash
curl http://localhost:8000/api/monitor
```

### `ERR_CONNECTION_REFUSED` on `localhost:8000`

Possible causes:
1. **Missing `-p 8000:8000`** in your `docker run` command — the port is not mapped to the host.
2. **Container is still starting** — wait for the healthcheck to pass (up to 60 seconds).
3. **Container crashed** — check logs: `docker logs <container-id>`

### Docker build fails with `COPY failed: file not found`

Make sure you are running `docker build .` from the **repository root** (the directory
that contains `Dockerfile`, `GovClerkMinutes-server/`, and `GovClerkMinutes/`).

```bash
docker build -t ghcr.io/cliffordtmokoena1-png/govclerk-server:latest .
```

### SSH not working

Make sure you passed the `PUBLIC_KEY` environment variable when creating the RunPod pod.
This is your SSH public key (the contents of `~/.ssh/id_rsa.pub` or similar).

### Checking container logs

```bash
docker logs <container-id>
# or on RunPod: use the RunPod terminal / SSH
```
