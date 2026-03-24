import json
import logging
import sys
from typing import Dict

import whisper

logging.basicConfig(
    level=logging.INFO,
    stream=sys.stderr,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)

logger = logging.getLogger(__name__)


def send_obj(obj: Dict):
    sys.stdout.write(json.dumps(obj))
    sys.stdout.write("\n")
    sys.stdout.flush()


def main():
    logger.info("Loading whisper large model...")
    # model = whisper.load_model("base")
    model = whisper.load_model("large")
    logger.info("Model load done!")

    while True:
        line = sys.stdin.readline().strip()
        logger.info("Got input command: " + line)

        if line == "":
            continue

        message = json.loads(line.strip())
        command = message.get("command")

        if command == "transcribe":
            filepath = message.get("filepath")
            result = model.transcribe(filepath, language="en")
            send_obj({"response": result["text"]})
        else:
            send_obj({"error": f"Invalid command: {command}"})


if __name__ == "__main__":
    main()
