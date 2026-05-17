import gc
import os

import torch
import whisperx


def transcribe_and_diarize(audio_path: str) -> dict:
    """Run the full WhisperX pipeline: transcribe, align, diarize.

    Models are loaded and unloaded sequentially to keep VRAM under ~14GB peak.
    """
    device = "cuda"
    hf_token = os.environ["HF_TOKEN"]

    # Step 1: Load and run ASR
    model = whisperx.load_model("turbo", device, compute_type="float16")
    audio = whisperx.load_audio(audio_path)
    result = model.transcribe(audio, batch_size=16)
    language = result["language"]

    # Free ASR model before loading alignment model
    del model
    gc.collect()
    torch.cuda.empty_cache()

    # Step 2: Align for word-level timestamps
    align_model, metadata = whisperx.load_align_model(
        language_code=language, device=device
    )
    result = whisperx.align(
        result["segments"], align_model, metadata, audio, device
    )

    # Free alignment model before loading diarization model
    del align_model
    gc.collect()
    torch.cuda.empty_cache()

    # Step 3: Diarize
    diarize_model = whisperx.DiarizationPipeline(
        model_name="pyannote/speaker-diarization-community-1",
        use_auth_token=hf_token,
        device=device,
    )
    diarize_segments = diarize_model(audio_path)
    result = whisperx.assign_word_speakers(diarize_segments, result)

    # Free diarization model
    del diarize_model
    gc.collect()
    torch.cuda.empty_cache()

    # Attach language to result for downstream use
    result["language"] = language

    return result
