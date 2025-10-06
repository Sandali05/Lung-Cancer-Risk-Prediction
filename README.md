# Lung Cancer Risk Prediction

This repository contains a FastAPI backend that serves a lung cancer risk model and a Next.js frontend for interacting with it.

## Local development

Use Docker Compose to run both services locally:

```bash
docker-compose up --build
```

The backend will be available at <http://localhost:8000> and the frontend at <http://localhost:3000>.

> **Note:** The Dockerfiles accept an `APP_DIR` build argument so they can build either from the repository root (the Render
> default) or from the individual service directories (what Docker Compose uses). The compose file already sets this argument
> to `.` for you when building locally, and the Render blueprint builds from the repository root so no extra configuration is
> required in that environment.

## Deploying on Render

Render can deploy the two services defined in this repository. The easiest way is to use the included `render.yaml` blueprint:

1. In the Render dashboard choose **Blueprints** → **New Blueprint Instance** and point it at this repository.
2. The blueprint creates two Docker web services:
   * **lung-cancer-backend** builds from `backend/Dockerfile` using the repository root as its build context so Render no longer looks for a nested `backend/backend` directory.
   * **lung-cancer-frontend** builds from `frontend/Dockerfile` with the same repository-root build context, ensuring the Dockerfile can resolve shared files like `.env` or documentation if you add them later.
3. Set the environment variables:
   * `NEXT_PUBLIC_API_BASE` (frontend) – the HTTPS URL of the backend service.
   * `PI_DEPLOY` (optional, both services) – overrides the baseline prevalence if needed.

The backend Dockerfile now reads the `PORT` environment variable provided by Render, so no custom start command is required. The frontend defaults to Node's `next start` runtime so the `NEXT_PUBLIC_API_BASE` environment variable is resolved when the container boots. If you prefer the old static-export behaviour for another hosting target, set `NEXT_OUTPUT_MODE=export` before running `npm run build`.
