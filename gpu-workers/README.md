# AiWebVideo RunPod workers

These folders are deployed as two separate RunPod Serverless queue endpoints.
The model weights are not committed to GitHub. RunPod downloads them directly
from Hugging Face into `/runpod-volume/huggingface` and reuses the cache.

Do not deploy an endpoint until the main repository containing these files has
been pushed. Use `gpu-workers/image-worker/Dockerfile` for the image endpoint
and `gpu-workers/video-worker/Dockerfile` for the video endpoint.

The video endpoint requires a private RunPod secret named `CLOUDINARY_URL`.
The website requires `RUNPOD_API_KEY`, `RUNPOD_IMAGE_ENDPOINT_ID`, and
`RUNPOD_VIDEO_ENDPOINT_ID`. Never commit those values.
