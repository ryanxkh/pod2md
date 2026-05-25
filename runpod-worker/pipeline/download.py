import os
import tempfile

import requests

DOWNLOAD_TIMEOUT = 300
CHUNK_SIZE = 8192


def download_audio(url: str) -> str:
    """Download audio from a direct HTTP/HTTPS URL to a temp file.

    Returns the local file path.
    """
    try:
        response = requests.get(url, stream=True, timeout=DOWNLOAD_TIMEOUT)
        response.raise_for_status()
    except requests.exceptions.HTTPError as exc:
        raise RuntimeError(f"HTTP error downloading audio: {exc.response.status_code}") from exc
    except requests.exceptions.Timeout as exc:
        raise RuntimeError("Timeout downloading audio") from exc
    except requests.exceptions.RequestException as exc:
        raise RuntimeError(f"Failed to download audio: {exc}") from exc

    content_type = response.headers.get("Content-Type", "")
    if content_type and not (
        content_type.startswith("audio/")
        or content_type.startswith("video/")
        or "octet-stream" in content_type
    ):
        raise RuntimeError(f"Unexpected content type: {content_type}")

    suffix = _guess_extension(content_type, url)
    fd, path = tempfile.mkstemp(suffix=suffix)
    try:
        with os.fdopen(fd, "wb") as f:
            for chunk in response.iter_content(chunk_size=CHUNK_SIZE):
                f.write(chunk)
    except Exception:
        os.unlink(path)
        raise

    return path


def _guess_extension(content_type: str, url: str) -> str:
    """Guess a file extension from content type or URL."""
    ct_map = {
        "audio/mpeg": ".mp3",
        "audio/mp3": ".mp3",
        "audio/wav": ".wav",
        "audio/x-wav": ".wav",
        "audio/mp4": ".m4a",
        "audio/x-m4a": ".m4a",
        "audio/ogg": ".ogg",
        "audio/flac": ".flac",
        "video/mp4": ".mp4",
    }
    for ct, ext in ct_map.items():
        if content_type.startswith(ct):
            return ext

    url_path = url.split("?")[0].split("#")[0]
    for ext in (".mp3", ".wav", ".m4a", ".ogg", ".flac", ".mp4", ".webm"):
        if url_path.endswith(ext):
            return ext

    return ".audio"
