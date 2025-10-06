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
> to `.` for you when building locally.

## Deploying on Render

Render can deploy the two services defined in this repository. The easiest way is to use the included `render.yaml` blueprint:

1. In the Render dashboard choose **Blueprints** → **New Blueprint Instance** and point it at this repository.
2. The blueprint creates two Docker web services:
   * **lung-cancer-backend** builds from `backend/Dockerfile` with its build context set to the `backend` directory. This avoids errors like `could not find /opt/render/project/src/backend/backend` that occur when Render looks for a nested `backend` directory.
   * **lung-cancer-frontend** builds from `frontend/Dockerfile` with the build context set to `frontend`.
3. Set the environment variables:
   * `NEXT_PUBLIC_API_BASE` (frontend) – the HTTPS URL of the backend service.
   * `PI_DEPLOY` (optional, both services) – overrides the baseline prevalence if needed.

The backend Dockerfile now reads the `PORT` environment variable provided by Render, so no custom start command is required.
