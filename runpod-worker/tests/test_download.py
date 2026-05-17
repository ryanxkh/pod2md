import os

import pytest

from pipeline.download import download_audio, _guess_extension


class TestGuessExtension:
    def test_content_type_mp3(self):
        assert _guess_extension("audio/mpeg", "") == ".mp3"

    def test_content_type_wav(self):
        assert _guess_extension("audio/wav", "") == ".wav"

    def test_content_type_m4a(self):
        assert _guess_extension("audio/mp4", "") == ".m4a"

    def test_content_type_with_charset(self):
        assert _guess_extension("audio/mpeg; charset=utf-8", "") == ".mp3"

    def test_url_fallback(self):
        assert _guess_extension("", "https://example.com/file.mp3") == ".mp3"

    def test_url_strips_query(self):
        assert _guess_extension("", "https://example.com/file.wav?token=abc") == ".wav"

    def test_unknown_defaults(self):
        assert _guess_extension("", "https://example.com/file") == ".audio"

    def test_content_type_takes_precedence(self):
        assert _guess_extension("audio/wav", "https://example.com/file.mp3") == ".wav"


class TestDownloadAudio:
    def test_rejects_html_content_type(self, requests_mock):
        requests_mock.get(
            "https://example.com/page.html",
            text="<html></html>",
            headers={"Content-Type": "text/html"},
        )
        with pytest.raises(RuntimeError, match="Unexpected content type"):
            download_audio("https://example.com/page.html")

    def test_successful_download(self, requests_mock):
        audio_bytes = b"\x00" * 1024
        requests_mock.get(
            "https://example.com/test.mp3",
            content=audio_bytes,
            headers={"Content-Type": "audio/mpeg"},
        )
        path = download_audio("https://example.com/test.mp3")
        try:
            assert os.path.exists(path)
            assert path.endswith(".mp3")
            with open(path, "rb") as f:
                assert f.read() == audio_bytes
        finally:
            os.unlink(path)

    def test_404_raises(self, requests_mock):
        requests_mock.get("https://example.com/missing.mp3", status_code=404)
        with pytest.raises(RuntimeError, match="404"):
            download_audio("https://example.com/missing.mp3")
