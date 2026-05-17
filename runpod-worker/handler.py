import os

import runpod

from pipeline.download import download_audio
from pipeline.transcribe import transcribe_and_diarize
from pipeline.format import format_output


def handler(job):
    input_data = job["input"]
    audio_url = input_data["audio_url"]

    try:
        # Stage 1: Download
        runpod.serverless.progress_update(job, {"stage": "downloading", "progress": 5})
        audio_path = download_audio(audio_url)

        # Stage 2: Transcribe + Diarize
        runpod.serverless.progress_update(job, {"stage": "transcribing", "progress": 20})
        result = transcribe_and_diarize(audio_path)

        # Stage 3: Format
        runpod.serverless.progress_update(job, {"stage": "formatting", "progress": 90})
        output = format_output(result)

    finally:
        # Clean up temp file
        if "audio_path" in locals():
            try:
                os.unlink(audio_path)
            except OSError:
                pass

    return output


runpod.serverless.start({"handler": handler})
