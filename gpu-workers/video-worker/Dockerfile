FROM nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04
WORKDIR /app
ENV PYTHONUNBUFFERED=1 HF_HOME=/runpod-volume/huggingface HF_HUB_ENABLE_HF_TRANSFER=1
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends python3 python3-dev python3-pip git ffmpeg && rm -rf /var/lib/apt/lists/*
COPY gpu-workers/video-worker/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY gpu-workers/video-worker/handler.py ./handler.py
CMD ["python3", "-u", "handler.py"]
