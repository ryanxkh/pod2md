from pipeline.format import format_output


def test_basic_formatting():
    result = {
        "segments": [
            {"start": 0.5, "end": 2.0, "text": "Hello world", "speaker": "SPEAKER_00"},
            {"start": 2.5, "end": 4.0, "text": "How are you", "speaker": "SPEAKER_01"},
        ],
        "language": "en",
    }
    output = format_output(result)

    assert len(output["segments"]) == 2
    assert output["segments"][0] == {
        "start_ms": 500,
        "end_ms": 2000,
        "speaker_label": "SPEAKER_00",
        "speaker_name": "Speaker 1",
        "text": "Hello world",
    }
    assert output["segments"][1]["speaker_name"] == "Speaker 2"

    assert len(output["speakers"]) == 2
    assert output["speakers"][0] == {
        "label": "SPEAKER_00",
        "name": "Speaker 1",
        "confidence": "fallback",
    }

    assert output["metadata"]["duration_secs"] == 4
    assert output["metadata"]["segment_count"] == 2
    assert output["metadata"]["model"] == "large-v3-turbo"
    assert output["metadata"]["language"] == "en"


def test_empty_segments():
    result = {"segments": [], "language": "en"}
    output = format_output(result)

    assert output["segments"] == []
    assert output["speakers"] == []
    assert output["metadata"]["duration_secs"] == 0
    assert output["metadata"]["segment_count"] == 0


def test_skips_empty_text():
    result = {
        "segments": [
            {"start": 0.0, "end": 1.0, "text": "   ", "speaker": "SPEAKER_00"},
            {"start": 1.0, "end": 2.0, "text": "", "speaker": "SPEAKER_00"},
            {"start": 2.0, "end": 3.0, "text": "Valid text", "speaker": "SPEAKER_00"},
        ],
        "language": "en",
    }
    output = format_output(result)

    assert len(output["segments"]) == 1
    assert output["segments"][0]["text"] == "Valid text"


def test_missing_speaker_label():
    result = {
        "segments": [
            {"start": 0.0, "end": 1.0, "text": "No speaker field"},
        ],
        "language": "en",
    }
    output = format_output(result)

    assert output["segments"][0]["speaker_label"] == "UNKNOWN"
    assert output["segments"][0]["speaker_name"] == "Speaker 1"


def test_speaker_numbering_preserves_order():
    result = {
        "segments": [
            {"start": 0.0, "end": 1.0, "text": "A", "speaker": "SPEAKER_02"},
            {"start": 1.0, "end": 2.0, "text": "B", "speaker": "SPEAKER_00"},
            {"start": 2.0, "end": 3.0, "text": "C", "speaker": "SPEAKER_02"},
        ],
        "language": "fr",
    }
    output = format_output(result)

    assert output["segments"][0]["speaker_name"] == "Speaker 1"
    assert output["segments"][1]["speaker_name"] == "Speaker 2"
    assert output["segments"][2]["speaker_name"] == "Speaker 1"
    assert output["metadata"]["language"] == "fr"


def test_default_language():
    result = {"segments": []}
    output = format_output(result)
    assert output["metadata"]["language"] == "en"
