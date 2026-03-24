import logging
import math
import sys
import torch
import time
from typing import Literal
from torch.profiler import profile, ProfilerActivity
import pyinstrument

logging.basicConfig(
    level=logging.INFO,
    stream=sys.stderr,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

ConditionalProfilerMode = Literal["torch", "pyinstrument", None]


def save_profiler_results(profile: profile):
    profile_path = f"torch_{math.floor(time.time())}.json"
    profile.export_chrome_trace(profile_path)
    logger.info(f"Profiling results saved to {profile_path}")


class ConditionalProfiler:
    """
    Context manager to dynamically select between torch and pyinstrument profilers
    """

    def __init__(self, mode: Literal["torch", "pyinstrument", None]):
        self.mode = mode
        self.profiler = None

    def __enter__(self):
        if self.mode == "pyinstrument":
            self.profiler = pyinstrument.Profiler()
        elif self.mode == "torch":
            logger.info(torch.cuda.memory_summary())
            self.profiler = profile(
                activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA],
                on_trace_ready=lambda p: save_profiler_results(p),
            )
            self.profiler.__enter__()
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        if self.mode is not None and self.profiler:
            logger.info(torch.cuda.memory_summary())
            self.profiler.__exit__(exc_type, exc_value, traceback)
            if self.mode == "pyinstrument":
                profile_path = f"pyinstrument_{math.floor(time.time())}.html"
                self.profiler.output_html(open(profile_path, "w"))
                logger.info(f"Profiling results saved to {profile_path}")
