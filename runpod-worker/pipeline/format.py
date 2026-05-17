def format_output(result: dict) -> dict:
    """Transform WhisperX output into the webhook contract format."""
    raw_segments = result.get("segments", [])
    language = result.get("language", "en")

    seen_speakers: dict[str, str] = {}
    speaker_counter = 0
    formatted_segments = []

    for seg in raw_segments:
        speaker_label = seg.get("speaker", "UNKNOWN")

        if speaker_label not in seen_speakers:
            speaker_counter += 1
            seen_speakers[speaker_label] = f"Speaker {speaker_counter}"

        start_ms = int(seg.get("start", 0) * 1000)
        end_ms = int(seg.get("end", 0) * 1000)
        text = seg.get("text", "").strip()

        if not text:
            continue

        formatted_segments.append({
            "start_ms": start_ms,
            "end_ms": end_ms,
            "speaker_label": speaker_label,
            "speaker_name": seen_speakers[speaker_label],
            "text": text,
        })

    speakers = [
        {"label": label, "name": name, "confidence": "fallback"}
        for label, name in seen_speakers.items()
    ]

    duration_secs = 0
    if formatted_segments:
        duration_secs = formatted_segments[-1]["end_ms"] // 1000

    return {
        "segments": formatted_segments,
        "speakers": speakers,
        "metadata": {
            "duration_secs": duration_secs,
            "segment_count": len(formatted_segments),
            "model": "large-v3-turbo",
            "language": language,
        },
    }
