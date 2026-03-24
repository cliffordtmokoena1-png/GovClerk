import logging
import os
import whisper
import torch


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

WHISPER_MODEL_SIZE_DEFAULT = "tiny"


def load_whisper(device: str) -> whisper.Whisper:
    whisper_path = f"whisper_model_{WHISPER_MODEL_SIZE_DEFAULT}.pth"
    whisper_model = None

    if os.path.exists(whisper_path):
        logger.info(f"Loading Whisper from disk: {whisper_path} on {device}")
        whisper_model = torch.load(
            whisper_path, map_location=device, weights_only=False
        )
        whisper_model.to(device)
    else:
        logger.info(
            f"Loading Whisper from hub: {WHISPER_MODEL_SIZE_DEFAULT} on {device}"
        )
        whisper_model = whisper.load_model(WHISPER_MODEL_SIZE_DEFAULT, device=device)
        try:
            dirpath = os.path.dirname(whisper_path)
            if dirpath:
                os.makedirs(dirpath, exist_ok=True)
            torch.save(whisper_model, whisper_path)
            logger.info(f"Cached Whisper to: {whisper_path}")
        except Exception as e:
            logger.warning(f"Could not cache model: {e}")

    logger.info(f"Whisper ready on device: {whisper_model.device}")
    return whisper_model
