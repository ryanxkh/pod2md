#!/usr/bin/env python3
"""Local test script — runs the transcription pipeline without RunPod.

Usage:
    python test_local.py <audio_url>
    python test_local.py https://example.com/episode.mp3
"""
import json
import os
import sys
import time

from pipeline.download import download_audio
from pipeline.transcribe import transcribe_and_diarize
from pipeline.format import format_output


def main():
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <audio_url>", file=sys.stderr)
        sys.exit(1)

    audio_url = sys.argv[1]

    if "HF_TOKEN" not in os.environ:
        print("Error: HF_TOKEN environment variable is required", file=sys.stderr)
        sys.exit(1)

    print(f"Downloading: {audio_url}", file=sys.stderr)
    t0 = time.time()
    audio_path = download_audio(audio_url)
    print(f"Downloaded in {time.time() - t0:.1f}s -> {audio_path}", file=sys.stderr)

    try:
        print("Transcribing + diarizing...", file=sys.stderr)
        t1 = time.time()
        result = transcribe_and_diarize(audio_path)
        print(f"Transcribed in {time.time() - t1:.1f}s", file=sys.stderr)

        print("Formatting output...", file=sys.stderr)
        output = format_output(result)

        print(json.dumps(output, indent=2))

        meta = output["metadata"]
        print(
            f"\nSummary: {meta['segment_count']} segments, "
            f"{len(output['speakers'])} speakers, "
            f"{meta['duration_secs']}s duration, "
            f"language={meta['language']}",
            file=sys.stderr,
        )
    finally:
        os.unlink(audio_path)


if __name__ == "__main__":
    main()
