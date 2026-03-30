# GovClerk Server v2

Modern Node.js backend for GovClerk — built with Hono, AssemblyAI, and OpenAI. No GPU required.

## Why v2?

The original backend (Rust + RunPod GPU) was expensive (~$0.40/hr) and complex to build/deploy. GovClerk Server v2 replaces it with:

- **Node.js 20 + TypeScript + Hono** — fast, lightweight, type-safe
- **AssemblyAI** — cloud-based transcription + speaker diarization (no GPU!)
- **OpenAI** — GPT-4o-based meeting minutes generation
- **Railway** — flat $5/month hosting, no per-hour GPU costs
- **PlanetScale (MySQL)** — serverless database
- **AWS S3** — audio file storage (unchanged)

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/monitor` | None | Health check — returns `{ status: "ok", version: "v2" }` |
| `GET` | `/api/get-pending-tasks` | None | List all active transcription/minutes jobs |
| `POST` | `/api/upload-complete-webhook` | Bearer token | Mark a transcript upload as complete |
| `POST` | `/api/get-diarization` | Bearer token | Start transcription + minutes generation for an uploaded audio file |
| `POST` | `/api/create-minutes` | Bearer token | Generate minutes from an already-transcribed recording |
| `POST` | `/api/regenerate-minutes/:transcript_id` | Bearer token | Regenerate minutes with user feedback |

### Authentication

All write endpoints require a `Authorization: Bearer <UPLOAD_COMPLETE_WEBHOOK_SECRET>` header.

### POST /api/get-diarization

```json
{
  "s3_audio_key": "uploads/upload_12345/audio.webm",
  "language": "en"
}
```

Returns `202 Accepted` immediately. Processing happens in background:
1. AssemblyAI transcribes audio + diarizes speakers
2. Transcript saved to database
3. OpenAI generates meeting minutes

### POST /api/create-minutes

```json
{
  "transcript_id": 12345
}
```

Generates minutes from an already-transcribed recording.

### POST /api/regenerate-minutes/:transcript_id

```json
{
  "feedback": "Please add more detail to the action items section."
}
```

Regenerates minutes incorporating user feedback. Creates a new version.

## Local Development

### Prerequisites

- Node.js 20+
- npm 9+

### Setup

```bash
cd govclerk-server-v2

# Install dependencies
npm install

# Copy env file and fill in your keys
cp .env.example .env

# Start dev server (auto-restarts on changes)
npm run dev
```

The server starts on `http://localhost:8000`.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `ASSEMBLYAI_API_KEY` | AssemblyAI API key (get at assemblyai.com) |
| `OPENAI_KEY` | OpenAI API key |
| `AWS_ACCESS_KEY_ID` | AWS access key for S3 |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key for S3 |
| `AWS_DEFAULT_REGION` | AWS region (e.g. `us-east-1`) |
| `AWS_S3_BUCKET` | S3 bucket name (default: `govclerk-uploads`) |
| `PLANETSCALE_DB_HOST` | PlanetScale MySQL host |
| `PLANETSCALE_DB_USERNAME` | PlanetScale username |
| `PLANETSCALE_DB_PASSWORD` | PlanetScale password |
| `PLANETSCALE_DB` | PlanetScale database name |
| `UPLOAD_COMPLETE_WEBHOOK_SECRET` | Shared secret for all authenticated endpoints |
| `PORT` | Server port (default: `8000`) |

## Deploy to Railway

Railway charges a flat **$5/month** with no GPU costs.

### Steps

1. Go to [railway.app](https://railway.app) and create a new project
2. Connect your GitHub repository
3. Set the root directory to `govclerk-server-v2`
4. Add all environment variables from `.env.example`
5. Railway will auto-build and deploy using the Dockerfile

The `railway.json` at the root of `govclerk-server-v2/` configures:
- Dockerfile build
- Health check at `/api/monitor`
- Auto-restart on failure (max 3 retries)

## Deploy with Docker

```bash
cd govclerk-server-v2

# Build the image
docker build -t govclerk-server-v2 .

# Run locally
docker run -p 8000:8000 --env-file .env govclerk-server-v2

# Or pass env vars directly
docker run -p 8000:8000 \
  -e ASSEMBLYAI_API_KEY=xxx \
  -e OPENAI_KEY=xxx \
  -e ... \
  govclerk-server-v2
```

## Build

```bash
npm run build   # Compiles TypeScript to dist/
npm start       # Run compiled output
```