import base64
import io
import os
import tempfile
import time
import cloudinary
import cloudinary.uploader
import runpod
import torch
from PIL import Image
from diffusers import DiffusionPipeline
from diffusers.utils import export_to_video

MODEL_ID = os.getenv("MODEL_ID", "Wan-AI/Wan2.2-TI2V-5B-Diffusers")
pipe = DiffusionPipeline.from_pretrained(MODEL_ID, torch_dtype=torch.bfloat16)
pipe.enable_model_cpu_offload()
cloudinary.config(secure=True)

def first_image(values):
    if not values:
        return None
    return Image.open(io.BytesIO(base64.b64decode(values[0]))).convert("RGB")

def handler(job):
    data = job.get("input", {})
    prompt = str(data.get("prompt", "")).strip()
    if not prompt:
        raise ValueError("prompt is required")
    ratio = data.get("aspectRatio", "16:9")
    width, height = ((1280, 720) if ratio == "16:9" else (720, 1280))
    reference = first_image(data.get("references"))
    started = time.perf_counter()
    args = dict(prompt=prompt, width=width, height=height, num_frames=121, num_inference_steps=40, guidance_scale=5.0)
    if reference is not None:
        args["image"] = reference
    try:
        frames = pipe(**args).frames[0]
    except TypeError:
        args.pop("image", None)
        frames = pipe(**args).frames[0]
    with tempfile.NamedTemporaryFile(suffix=".mp4") as temp:
        export_to_video(frames, temp.name, fps=24)
        if not os.getenv("CLOUDINARY_URL"):
            raise RuntimeError("CLOUDINARY_URL is required for video delivery")
        uploaded = cloudinary.uploader.upload_large(temp.name, resource_type="video", folder="aiwebvideo/gpu", overwrite=False)
    return {"url": uploaded["secure_url"], "gpuSeconds": time.perf_counter() - started, "model": "wan2.2-ti2v-5b"}

runpod.serverless.start({"handler": handler})
