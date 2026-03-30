from typing import Optional
from urllib.parse import urlparse
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
import asyncio
import tempfile
import json
import assemblyai as aai
from dotenv import load_dotenv
import boto3
import os
import logging
import requests

logger = logging.getLogger(__name__)

load_dotenv()

aai.settings.api_key = os.getenv("ASSEMBLYAI_API_KEY")
HUMDINGER_KEY = os.getenv("HUMDINGER_KEY")

# South African official language ISO codes supported by AssemblyAI
SUPPORTED_LANGUAGE_CODES = ["en", "af", "zu", "xh", "nso", "st", "tn", "ts"]

app = FastAPI()


class TranscribeSegmentsBody(BaseModel):
    transcript_id: int
    audio_key: str
    transcript_key: str
    prompt: str
    webhook_uri: str
    language_code: Optional[str] = None


def write_s3_file(bucket, key, filename):
    s3 = boto3.resource("s3")
    try:
        s3.meta.client.upload_file(filename, bucket, key)
        logger.info("Successfully uploaded file to s3.")
    except Exception as e:
        logger.exception(e)


def ms_to_timestamp(ms: int) -> str:
    hours = ms // 3_600_000
    ms %= 3_600_000
    minutes = ms // 60_000
    ms %= 60_000
    seconds = ms // 1_000
    millis = ms % 1_000
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{millis:03d}"


def _do_transcribe(audio_path: str, config: aai.TranscriptionConfig):
    return aai.Transcriber().transcribe(audio_path, config)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/transcribe-segments")
async def transcribe_segments(
    body: TranscribeSegmentsBody, authorization: Optional[str] = Header(None)
):
    if authorization != HUMDINGER_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")

    logger.info("got authenticated request")

    if body.language_code is not None and body.language_code not in SUPPORTED_LANGUAGE_CODES:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported language_code '{body.language_code}'. "
                   f"Supported codes: {SUPPORTED_LANGUAGE_CODES}",
        )

    # Download audio from S3 to a temporary file
    s3 = boto3.resource("s3")
    audio_bucket, audio_s3_key = body.audio_key.split("/", 1)
    with tempfile.NamedTemporaryFile(delete=False) as tmp_audio:
        tmp_audio_path = tmp_audio.name
    try:
        s3.meta.client.download_file(audio_bucket, audio_s3_key, tmp_audio_path)
        logger.info("Downloaded audio from S3.")
    except Exception as e:
        logger.exception(e)
        os.remove(tmp_audio_path)
        raise HTTPException(status_code=500, detail="Failed to download audio from S3")

    # Build AssemblyAI transcription config
    try:
        config_kwargs = dict(
            speaker_labels=True,
            summarization=True,
            summary_model=aai.SummarizationModel.informative,
            summary_type=aai.SummarizationType.bullets,
            auto_chapters=True,
        )
        if body.language_code is not None:
            config_kwargs["language_code"] = body.language_code
        else:
            config_kwargs["language_detection"] = True
        config = aai.TranscriptionConfig(**config_kwargs)

        logger.info("Submitting transcription job to AssemblyAI.")
        transcript = await asyncio.to_thread(_do_transcribe, tmp_audio_path, config)
    finally:
        os.remove(tmp_audio_path)

    if transcript.status == aai.TranscriptStatus.error:
        logger.error(f"AssemblyAI transcription error: {transcript.error}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {transcript.error}")

    logger.info("Transcription completed successfully.")

    # Build segments from utterances
    segments = []
    if transcript.utterances:
        for utt in transcript.utterances:
            segments.append({
                "speaker": utt.speaker,
                "start": ms_to_timestamp(utt.start),
                "stop": ms_to_timestamp(utt.end),
                "transcript": utt.text,
            })

    # Build chapters list
    chapters = []
    if transcript.chapters:
        for ch in transcript.chapters:
            chapters.append({
                "headline": ch.headline,
                "summary": ch.summary,
                "start": ch.start,
                "end": ch.end,
            })

    result = {
        "segments": segments,
        "summary": transcript.summary or "",
        "chapters": chapters,
        "transcript_id": body.transcript_id,
    }

    # Write result JSON back to S3
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        tmp_result_path = f.name
        json.dump(result, f)

    try:
        transcript_bucket, transcript_s3_key = body.transcript_key.split("/", 1)
        write_s3_file(transcript_bucket, transcript_s3_key, tmp_result_path)
    finally:
        os.remove(tmp_result_path)

    # Fire webhook callback
    logger.info(f"Sending to webhook URI: {body.webhook_uri}")
    parsed = urlparse(body.webhook_uri)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise HTTPException(status_code=422, detail="Invalid webhook_uri")
    try:
        response = requests.post(
            body.webhook_uri,
            json={
                "status": "SUCCESS",
                "transcript_id": body.transcript_id,
                "transcript_key": body.transcript_key,
            },
        )
        response.raise_for_status()
        logger.info(f"Response from webhook: {str(response)}")
    except Exception as e:
        logger.exception(e)
        raise HTTPException(
            status_code=500, detail="Failed to send request to the webhook URI"
        )

    return {"status": "SUCCESS"}
