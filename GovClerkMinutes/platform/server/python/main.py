from __future__ import annotations
import logging
from typing import Dict, List, Optional
import torch

from decode import decode_any_to_16k_mono
from detect import detect_language_full_clip
from speechbrain_model import get_speaker_embedding, load_speechbrain_model
from whisper_model import load_whisper

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PythonInterface:
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.whisper_model = load_whisper(self.device)
        self.speechbrain_model = load_speechbrain_model(self.device)

    def detect_language(self, data: bytes) -> Dict[str, object]:
        wav = decode_any_to_16k_mono(data)
        lang, probs = detect_language_full_clip(self.whisper_model, wav)
        return {"language": lang, "confidence": float(probs[lang]), "probs": probs}

    def get_speaker_embedding(self, segments: List[bytes]) -> Optional[List[float]]:
        """
        Given a list of audio segments (each already mono 16 kHz PCM, same speaker),
        return a single embedding.
        """
        if not segments:
            return None
        return get_speaker_embedding(self.speechbrain_model, self.device, segments)
