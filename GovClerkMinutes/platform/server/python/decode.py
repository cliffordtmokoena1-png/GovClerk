import io
import soundfile as sf
import torchaudio
import torch
import numpy as np

TARGET_SR = 16000


def decode_any_to_16k_mono(buffer: bytes) -> np.ndarray:
    """Decode container/compressed audio from bytes -> float32 mono 16k."""
    data, sr = sf.read(io.BytesIO(buffer), dtype="float32", always_2d=False)
    if data.ndim == 2:
        data = data.mean(axis=1)
    if sr != TARGET_SR:
        t = torch.from_numpy(data)
        t = torchaudio.functional.resample(t, orig_freq=sr, new_freq=TARGET_SR)
        data = t.numpy().astype("float32")
    return data
