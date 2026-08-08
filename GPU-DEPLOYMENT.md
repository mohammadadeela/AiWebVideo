# Self-hosted generation deployment

AiWebVideo now prefers a private GPU worker and automatically falls back to the
existing generator when the worker is unavailable. The web VPS and Lucerne are
not changed by the GPU worker.

## Recommended launch configuration

- Image endpoint: FLUX.2 Klein 4B on an RTX 4090 serverless worker.
- Video endpoint: Wan 2.2 TI2V-5B on an L40S 48 GB serverless worker.
- Keep `GPU_FALLBACK_ENABLED=true` until at least 25 successful production jobs.
- Do not rent an always-on GPU until measured utilization makes it cheaper.

## Worker API contract

Deploy the official model inference containers behind these authenticated
routes:

```text
POST /v1/generate/image
POST /v1/generate/video
Authorization: Bearer <GPU_SERVER_SECRET>
Content-Type: application/json
```

The image request contains `model`, `prompt`, `aspectRatio`, `quality`, and up
to four base64 `references`. The video request additionally contains
`durationSeconds`. A worker response must be either:

```json
{"data":"<base64 file>","gpuSeconds":12.4,"model":"flux2-klein-4b"}
```

or:

```json
{"url":"https://private-temporary-download","gpuSeconds":421.2,"model":"wan2.2-ti2v-5b"}
```

The website records GPU seconds and estimated USD cost on each job. Do not put
provider or model names in customer-facing responses.

## Environment values on the Hostinger AiWebVideo app

```dotenv
GPU_SERVER_URL=https://YOUR-PRIVATE-GPU-ENDPOINT
GPU_SERVER_SECRET=GENERATE_A_LONG_RANDOM_SECRET
GPU_IMAGE_MODEL=flux2-klein-4b
GPU_VIDEO_MODEL=wan2.2-ti2v-5b
GPU_FALLBACK_ENABLED=true
GPU_REQUEST_TIMEOUT_MS=1800000
GPU_COST_PER_SECOND_USD=0.00053
```

Use the exact per-second price from the GPU provider instead of the example.
Then deploy normally; `pnpm run db:migrate` adds the cost-tracking columns.

## Safe rollout

1. Deploy this website version with `GPU_SERVER_URL` blank. Existing generation continues normally.
2. Create the two serverless GPU endpoints and test them privately.
3. Add the GPU variables to `.env.local` and redeploy only AiWebVideo.
4. Generate one image-only job, one 8-second video, and one mixed job.
5. Review database `gpu_seconds` and `generation_cost_usd` values.
6. Keep fallback enabled until the GPU worker is proven stable.
7. Update retail credits only after at least 25 jobs provide representative cost data.

## Query measured costs

```sql
SELECT generation_provider,
       COUNT(*) AS jobs,
       ROUND(AVG(gpu_seconds), 2) AS avg_gpu_seconds,
       ROUND(AVG(generation_cost_usd), 4) AS avg_cost_usd,
       ROUND(MAX(generation_cost_usd), 4) AS highest_cost_usd
FROM jobs
WHERE generation_provider IS NOT NULL
GROUP BY generation_provider;
```
