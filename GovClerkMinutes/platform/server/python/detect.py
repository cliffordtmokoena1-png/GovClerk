from typing import Dict, Tuple
import whisper
from whisper.audio import log_mel_spectrogram, N_FRAMES, pad_or_trim
import torch
import numpy as np


def detect_language_full_clip(
    model: whisper.Whisper, wav_16k: np.ndarray
) -> Tuple[str, Dict[str, float]]:
    mel = log_mel_spectrogram(wav_16k)
    stride = N_FRAMES
    probs_accum: Dict[str, float] = {}
    n_chunks = 0
    for start in range(0, mel.shape[-1], stride):
        chunk = pad_or_trim(mel[:, start : start + stride], length=stride)
        with torch.no_grad():
            _, probs = model.detect_language(chunk.to(model.device))
        for k, v in probs.items():
            probs_accum[k] = probs_accum.get(k, 0.0) + float(v)
        n_chunks += 1
    avg_probs = {k: v / max(n_chunks, 1) for k, v in probs_accum.items()}
    top_lang = max(avg_probs, key=avg_probs.get)
    return top_lang, avg_probs
