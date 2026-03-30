# GovClerkMinutes-server

A FastAPI service that generates meeting transcripts, speaker diarization, and meeting minutes for GovClerk using the **AssemblyAI** API.

## Overview

This service accepts a South African government meeting audio file stored in S3, submits it to AssemblyAI for a single combined transcription + speaker diarization + summarization job, writes the result back to S3, and fires a webhook callback.

## Pipeline

```
Audio file in S3
      ↓
POST /api/transcribe-segments
      ↓
Download audio from S3 → temp file
      ↓
AssemblyAI API (single call):
  - Transcription
  - Speaker diarization
  - Auto-chapters / meeting summaries
  - South African language support
      ↓
Result JSON written back to S3
      ↓
Webhook callback fired
```

## Required Environment Variables

| Variable | Purpose |
|---|---|
| `ASSEMBLYAI_API_KEY` | AssemblyAI API key for transcription + diarization + summarization |
| `HUMDINGER_KEY` | Bearer token for authenticating requests to this service |
| `AWS_ACCESS_KEY_ID` | S3 access key |
| `AWS_SECRET_ACCESS_KEY` | S3 secret key |
| `AWS_DEFAULT_REGION` | S3 region |

> **Note:** `OPENAI_KEY` is no longer required by this service.

## Supported Languages

The optional `language_code` field accepts any of the following ISO codes for South African official languages:

| Language | `language_code` |
|---|---|
| English | `en` |
| Afrikaans | `af` |
| isiZulu | `zu` |
| isiXhosa | `xh` |
| Sepedi / Northern Sotho | `nso` |
| Sesotho / Southern Sotho | `st` |
| Setswana / Tswana | `tn` |
| Xitsonga / Tsonga | `ts` |

If `language_code` is omitted, AssemblyAI's automatic language detection is used — this handles code-switching between English and a Bantu language, which is common in South African government meetings.

## API Endpoints

### `GET /api/health`

Returns `{"status": "ok"}`.

### `POST /api/transcribe-segments`

**Headers:**
- `Authorization: <HUMDINGER_KEY>`
- `Content-Type: application/json`

**Body:**
```json
{
  "transcript_id": 123,
  "audio_key": "bucket-name/path/to/audio.mp3",
  "transcript_key": "bucket-name/path/to/result.json",
  "prompt": "South African government council meeting",
  "webhook_uri": "https://your-app.com/api/webhook",
  "language_code": "zu"
}
```

`language_code` is optional. Omit it (or set to `null`) to enable automatic language detection.

**Response:**
```json
{"status": "SUCCESS"}
```

**S3 result JSON format:**
```json
{
  "segments": [
    { "speaker": "A", "start": "00:00:01.000", "stop": "00:00:05.000", "transcript": "Hello..." }
  ],
  "summary": "Bullet-point meeting summary...",
  "chapters": [
    { "headline": "...", "summary": "...", "start": 0, "end": 60000 }
  ],
  "transcript_id": 123
}
```

## Running the Server

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Example `curl`

```bash
curl -X POST "http://localhost:8000/api/transcribe-segments" \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Authorization: your-humdinger-key" \
  -d '{
    "transcript_id": 1,
    "prompt": "South African municipal council meeting",
    "audio_key": "govclerk-bucket/meetings/audio.mp3",
    "transcript_key": "govclerk-bucket/meetings/result.json",
    "webhook_uri": "https://your-app.com/api/webhook",
    "language_code": "zu"
  }'
```
