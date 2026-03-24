from typing import List, Optional, Tuple
import logging
import torch
from speechbrain.inference.classifiers import EncoderClassifier
from silero_vad import load_silero_vad, get_speech_timestamps  # pip: silero-vad

from decode import TARGET_SR, decode_any_to_16k_mono

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---- Tuning knobs ----
MIN_SPEECH_SEC = 1.0  # reject if total voiced < 1s
WINDOW_SEC = 10.0  # target window length for long inputs
MAX_WINDOWS = 6  # cap number of windows to embed overall
MAX_TOTAL_VOICED_SEC = 60.0  # don't use more than ~1 min voiced audio total


_SILERO_VAD_MODEL = None


def _ensure_silero_vad():
    """
    Lazy-load Silero VAD from the PyPI package (NOT torch.hub).
    Returns the model (Torch or ONNX) and the function get_speech_timestamps.
    """
    global _SILERO_VAD_MODEL
    if _SILERO_VAD_MODEL is None:
        logger.info("Loading Silero VAD from PyPI package 'silero-vad'...")
        # Set onnx=True if you installed onnxruntime and want the ONNX model
        _SILERO_VAD_MODEL = load_silero_vad(onnx=False)  # returns a callable model
    return _SILERO_VAD_MODEL, get_speech_timestamps


def _silero_vad_segments(wav_1d: torch.Tensor, sr: int) -> List[Tuple[int, int]]:
    """
    Returns voiced segments as (start_sample, end_sample) using Silero VAD (PyPI).
    """
    # Silero VAD expects a 1-D CPU float tensor at the given sample rate.
    if wav_1d.is_cuda:
        wav_1d = wav_1d.detach().cpu()

    model, _get_speech_timestamps = _ensure_silero_vad()
    ts = _get_speech_timestamps(
        wav_1d,
        model,
        sampling_rate=sr,
        threshold=0.5,
        min_speech_duration_ms=250,
        min_silence_duration_ms=200,
        window_size_samples=512,
    )
    return [(t["start"], t["end"]) for t in ts]


def _pick_windows_from_voiced(
    voiced: List[Tuple[int, int]],
    sr: int,
    window_s: float,
    max_windows: int,
    max_total_s: float,
) -> List[Tuple[int, int]]:
    """
    Convert arbitrary voiced segments into at most `max_windows` windows.
    Each window is <= window_s long, centered in its source segment where possible.
    Keeps the longest segments first and caps the total voiced duration used.
    """
    if not voiced:
        return []

    # Convert to (start, end, dur_s) and sort by duration desc
    segs = [(s, e, (e - s) / sr) for (s, e) in voiced]
    segs.sort(key=lambda x: x[2], reverse=True)

    windows: List[Tuple[int, int]] = []
    used_total = 0.0
    for s, e, dur in segs:
        if len(windows) >= max_windows or used_total >= max_total_s:
            break
        # desired window length in samples
        win_len = min(int(window_s * sr), e - s)
        if win_len <= 0:
            continue
        # center the window inside the segment if segment is longer than window
        if (e - s) > win_len:
            start = s + ((e - s) - win_len) // 2
            end = start + win_len
        else:
            start, end = s, e

        windows.append((start, end))
        used_total += (end - start) / sr

    # If we still have no windows (all segments were tiny), keep the single longest segment.
    if not windows:
        s, e, _ = segs[0]
        windows = [(s, e)]

    return windows


def load_speechbrain_model(device: str) -> EncoderClassifier:
    model = EncoderClassifier.from_hparams(
        source="speechbrain/spkrec-ecapa-voxceleb",
        run_opts={"device": device},
    )
    logger.info(f"SpeechBrain speaker encoder loaded on {device}")
    return model


def get_speaker_embedding(
    model: EncoderClassifier, device: str, segments: List[bytes]
) -> Optional[List[float]]:
    """
    Robust speaker embedding from multiple audio segments (same speaker):
      - For each bytes segment:
          - decode to mono 16k, peak-normalize
          - VAD → voiced regions in samples
      - Sort segments by total **voiced duration** (desc)
      - Across segments, pick centered windows (<= WINDOW_SEC) until we reach:
          - <= MAX_WINDOWS windows total, and
          - <= MAX_TOTAL_VOICED_SEC total voiced duration used
      - Duration-weighted mean of per-window embeddings (no per-window L2)
      - Final single L2-normalize
    Returns embedding as list[float], or None if unusable (e.g., not enough speech).
    """
    if not segments:
        return None

    # Decode + VAD per segment
    decoded: List[torch.Tensor] = []
    voiced_lists: List[List[Tuple[int, int]]] = []
    voiced_secs: List[float] = []

    total_all_voiced = 0.0

    for data in segments:
        # Decode bytes -> float32 mono @ 16k
        wav_np = decode_any_to_16k_mono(data)
        if wav_np.size == 0:
            decoded.append(None)  # placeholder
            voiced_lists.append([])
            voiced_secs.append(0.0)
            continue

        wav = torch.from_numpy(wav_np).to(device)

        # Peak-normalize for consistent VAD thresholds
        peak = wav.abs().max()
        if torch.isfinite(peak) and peak > 0:
            wav = wav / peak

        # VAD
        try:
            voiced = _silero_vad_segments(wav, TARGET_SR)
        except Exception as e:
            logger.warning(f"Silero VAD unavailable for one segment; using raw: {e}")
            voiced = [(0, wav.numel())]

        # Keep data
        decoded.append(wav)
        voiced_lists.append(voiced)
        vsec = sum((e - s) / TARGET_SR for (s, e) in voiced)
        voiced_secs.append(vsec)
        total_all_voiced += vsec

    # If across all segments we don't have enough speech, bail out.
    if total_all_voiced < MIN_SPEECH_SEC:
        return None

    # Sort segments by voiced duration (desc)
    order = sorted(range(len(segments)), key=lambda i: voiced_secs[i], reverse=True)

    # Select windows across segments up to caps
    selected_windows: List[Tuple[int, int, int]] = []  # (seg_idx, s, e)
    used_total = 0.0
    windows_count = 0

    for idx in order:
        if windows_count >= MAX_WINDOWS or used_total >= MAX_TOTAL_VOICED_SEC:
            break
        wav = decoded[idx]
        if wav is None:
            continue
        voiced = voiced_lists[idx]
        # Remaining budget
        remaining_windows = MAX_WINDOWS - windows_count
        remaining_total_s = max(0.0, MAX_TOTAL_VOICED_SEC - used_total)
        if remaining_windows <= 0 or remaining_total_s <= 0:
            break

        # Pick windows within this segment
        windows = _pick_windows_from_voiced(
            voiced,
            sr=TARGET_SR,
            window_s=WINDOW_SEC,
            max_windows=remaining_windows,
            max_total_s=remaining_total_s,
        )

        # Record, update budgets
        for s, e in windows:
            dur_s = (e - s) / TARGET_SR
            selected_windows.append((idx, s, e))
            windows_count += 1
            used_total += dur_s
            if windows_count >= MAX_WINDOWS or used_total >= MAX_TOTAL_VOICED_SEC:
                break

    # If still nothing, try to fall back to the single longest voiced region overall
    if not selected_windows:
        i_long = max(
            range(len(voiced_lists)), key=lambda i: voiced_secs[i], default=None
        )
        if i_long is None or not voiced_lists[i_long]:
            return None
        s, e = max(voiced_lists[i_long], key=lambda se: (se[1] - se[0]))
        selected_windows = [(i_long, s, e)]

    # Embed + duration-weighted mean
    num_vec = None
    denom = 0.0

    with torch.no_grad():
        for seg_idx, s, e in selected_windows:
            wav = decoded[seg_idx]
            seg = wav[s:e]
            dur_s = (e - s) / TARGET_SR
            if dur_s < MIN_SPEECH_SEC:
                continue

            batch = seg.unsqueeze(0)  # [1, T]
            emb = model.encode_batch(batch)  # [1, D] or [1, 1, D]
            if emb.dim() == 3:
                emb = emb.squeeze(1)
            emb = emb.squeeze(0)  # [D], raw (not L2)

            w = float(dur_s)  # duration weight; swap for SNR weight if desired
            num_vec = emb * w if num_vec is None else num_vec + emb * w
            denom += w

    if num_vec is None or denom == 0.0:
        return None

    centroid = num_vec / denom
    centroid = torch.nn.functional.normalize(centroid, p=2, dim=0)
    return centroid.detach().cpu().numpy().astype("float32").tolist()
