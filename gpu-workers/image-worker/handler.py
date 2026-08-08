import base64
import io
import os
import time
import runpod
import torch
from PIL import Image
from diffusers import DiffusionPipeline

MODEL_ID = os.getenv("MODEL_ID", "black-forest-labs/FLUX.2-klein-4B")
pipe = DiffusionPipeline.from_pretrained(MODEL_ID, torch_dtype=torch.bfloat16)
pipe.enable_model_cpu_offload()

def decode_images(values):
    images = []
    for value in (values or []):
        images.append(Image.open(io.BytesIO(base64.b64decode(value))).convert("RGB"))
    return images

def handler(job):
    data = job.get("input", {})
    prompt = str(data.get("prompt", "")).strip()
    if not prompt:
        raise ValueError("prompt is required")
    ratio = data.get("aspectRatio", "16:9")
    width, height = ((1344, 768) if ratio == "16:9" else (768, 1344))
    references = decode_images(data.get("references"))
    started = time.perf_counter()
    args = dict(prompt=prompt, width=width, height=height, num_inference_steps=4, guidance_scale=1.0)
    if references:
        args["image"] = references
    try:
        image = pipe(**args).images[0]
    except TypeError:
        args.pop("image", None)
        image = pipe(**args).images[0]
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=True)
    return {"data": base64.b64encode(output.getvalue()).decode(), "gpuSeconds": time.perf_counter() - started, "model": "flux2-klein-4b"}

runpod.serverless.start({"handler": handler})
