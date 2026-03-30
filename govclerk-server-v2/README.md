# GovClerk Server v2

Modern Node.js + TypeScript backend replacing the old Rust/GPU server.

## Why v2?

| Feature | Old (Rust + GPU) | New (Node.js) |
|---|---|---|
| Cost | ~$0.20-0.50/hr GPU | ~$5/month flat (Railway) |
| Transcription | Local Whisper (GPU) | AssemblyAI API |
| Diarization | Local SpeechBrain (GPU) | AssemblyAI API |
| Minutes | OpenAI API | OpenAI API (same) |
| Deployment | Docker + RunPod | Railway (push to deploy) |
| Startup time | 2-3 minutes | ~5 seconds |
| Idle cost | High (GPU always on) | $0 (Railway sleeps free tier) |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/monitor` | Health check |
| POST | `/api/get-diarization` | Transcribe + diarize audio from S3 |
| POST | `/api/create-minutes` | Generate minutes from transcript |
| POST | `/api/regenerate-minutes/:id` | Regenerate minutes with feedback |
| GET | `/api/get-pending-tasks` | List active processing jobs |
| POST | `/api/upload-complete-webhook` | Called when upload completes |

## Local Development

```bash
cd govclerk-server-v2
npm install
cp .env.example .env   # fill in your values
npm run dev
```

## Deploy to Railway

1. Go to https://railway.app
2. New Project → Deploy from GitHub repo
3. Set root directory to `govclerk-server-v2`
4. Add environment variables from `.env.example`
5. Railway auto-deploys on every push to main ✅

## Deploy to Docker (RunPod or any cloud)

```bash
cd govclerk-server-v2
docker build -t govclerk-server-v2 .
docker run -p 8000:8000 --env-file .env govclerk-server-v2
```
