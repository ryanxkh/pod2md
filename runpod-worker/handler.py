import os

import runpod

from pipeline.download import download_audio, download_youtube_audio
from pipeline.transcribe import transcribe_and_diarize
from pipeline.format import format_output


def handler(job):
    input_data = job["input"]
    audio_url = input_data["audio_url"]
    source_type = input_data.get("source_type", "direct")
    audio_path = None

    try:
        # Stage 1: Download
        runpod.serverless.progress_update(job, {"stage": "downloading", "progress": 5})
        if source_type == "youtube":
            audio_path = download_youtube_audio(audio_url)
        else:
            audio_path = download_audio(audio_url)

        # Stage 2: Transcribe + Diarize
        runpod.serverless.progress_update(job, {"stage": "transcribing", "progress": 20})
        result = transcribe_and_diarize(audio_path)

        # Stage 3: Format
        runpod.serverless.progress_update(job, {"stage": "formatting", "progress": 90})
        return format_output(result)

    finally:
        if audio_path:
            try:
                os.unlink(audio_path)
            except OSError:
                pass


runpod.serverless.start({"handler": handler})
