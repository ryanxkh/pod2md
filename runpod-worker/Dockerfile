FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install Python 3.11, ffmpeg, git
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3.11-venv \
    python3.11-dev \
    python3-pip \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

# Make python3.11 the default python3
RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Bake models at build time to minimize cold starts
ARG HF_TOKEN
ENV HF_TOKEN=${HF_TOKEN}

# Download Faster-Whisper large-v3-turbo model
RUN python3 -c "\
from faster_whisper import WhisperModel; \
WhisperModel('turbo', device='cpu', compute_type='int8')"

# Download pyannote speaker-diarization-community-1 model
RUN python3 -c "\
from pyannote.audio import Pipeline; \
import os; \
Pipeline.from_pretrained( \
    'pyannote/speaker-diarization-community-1', \
    use_auth_token=os.environ['HF_TOKEN'] \
)"

# Download wav2vec2 alignment model (English)
RUN python3 -c "\
import whisperx; \
whisperx.load_align_model(language_code='en', device='cpu')"

# Clear HF_TOKEN from the image layer environment
ENV HF_TOKEN=""

# Copy application code
COPY pipeline/ pipeline/
COPY handler.py .
COPY test_local.py .

CMD ["python3", "-u", "handler.py"]
