from typing import Any, Dict, Optional
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
import contextlib
import tempfile
import json
import openai
import pydub
from datetime import datetime
from dotenv import load_dotenv
import boto3
import os
import logging
import requests

logger = logging.getLogger(__name__)

load_dotenv()

openai.api_key = os.getenv("OPENAI_KEY")
HUMDINGER_KEY = os.getenv("HUMDINGER_KEY")

app = FastAPI()


class TranscribeSegmentsBody(BaseModel):
    transcript_id: int
    audio_key: str
    transcript_key: str
    prompt: str
    webhook_uri: str


def write_s3_file(bucket, key, filename):
    s3 = boto3.resource("s3")
    try:
        s3.meta.client.upload_file(filename, bucket, key)
        logger.info("Successfully uploaded file to s3.")
    except Exception as e:
        logger.exception(e)


@contextlib.contextmanager
def get_diarization(transcript_key: str) -> Dict[str, Any]:
    s3 = boto3.resource("s3")
    bucket, key = transcript_key.split("/", 1)
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        filename = f.name
    s3.meta.client.download_file(bucket, key, filename)
    try:
        with open(filename, "r") as f:
            data = json.load(f)
            yield data
    finally:
        os.remove(filename)


@contextlib.contextmanager
def get_audio(audio_key: str) -> Any:
    s3 = boto3.resource("s3")
    bucket, key = audio_key.split("/", 1)
    with tempfile.NamedTemporaryFile(delete=False) as f:
        filename = f.name
    s3.meta.client.download_file(bucket, key, filename)
    try:
        yield pydub.AudioSegment.from_file(filename)
    finally:
        os.remove(filename)


def time_to_ms(time_str):
    time_format = "%H:%M:%S.%f"
    t = datetime.strptime(time_str, time_format)
    return (
        (t.hour * 60 + t.minute) * 60 * 1000 + t.second * 1000 + t.microsecond // 1000
    )


@app.post("/api/transcribe-segments")
async def transcribe_segments(
    body: TranscribeSegmentsBody, authorization: Optional[str] = Header(None)
):
    if authorization != HUMDINGER_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")

    logger.info("got authenticated request")
    print("LFKJFLKJFLKFJLFKJFLKJFLKFJ")

    transcript_data = []

    with get_diarization(body.transcript_key) as diarization, get_audio(
        body.audio_key
    ) as audio:
        i = 1
        for segment in diarization["segments"]:
            start = time_to_ms(segment["start"])
            stop = time_to_ms(segment["stop"])

            # Cut the audio segment from the main audio file
            audio_segment = audio[start:stop]

            # Export the segment to a temporary file
            audio_segment.export("temp.mp3", format="mp3")

            # Read the audio
            audio_file = open("temp.mp3", "rb")

            # TODO: make this call async
            # TODO: customize language
            transcript = openai.Audio.transcribe(
                "whisper-1", file=audio_file, prompt=body.prompt, language="en"
            )

            logger.info(f"Transcribed {i}/{len(diarization['segments'])}")
            i += 1

            # Append to transcript data
            transcript_data.append(
                {"speaker": segment["speaker"], "transcript": transcript["text"]}
            )

            # TODO: delete this
            with open("output.json", "w") as f:
                json.dump(transcript_data, f)

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json") as f:
            segments = []
            for segment, transcript in zip(diarization["segments"], transcript_data):
                assert segment["speaker"] == transcript["speaker"]
                segment["transcript"] = transcript["transcript"]
                segments.append(segment)
            diarization["segments"] = segments
            json.dump(diarization, f)
            f.flush()

            bucket, key = body.transcript_key.split("/", 1)
            write_s3_file(bucket, key, f.name)

        logger.info(f"Sending to webhook URI: {body.webhook_uri}")
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
