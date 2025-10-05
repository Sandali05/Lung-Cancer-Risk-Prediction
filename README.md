# Lung Cancer Risk Prediction – Deployment Guide

This project contains a FastAPI backend that serves a calibrated XGBoost classifier and a Next.js frontend for collecting patient risk factors.  
Use this guide to run the stack locally for development or deploy it with containers.

## Repository layout

```
backend/   # FastAPI app, trained model artifacts, training script
frontend/  # Next.js 15 application (React 19, Tailwind CSS)
```

The backend exposes `/predict` and `/model-info`. The frontend expects the backend base URL in the `NEXT_PUBLIC_API_BASE` environment variable (defaults to `http://127.0.0.1:8000`).

---

## 1. Run locally without containers

### 1.1 Backend (FastAPI)

1. **Create a virtual environment** (Python 3.11 recommended):
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
   ```
2. **Install dependencies and start the API**:
   ```bash
   pip install -r requirements.txt
   uvicorn app:app --host 0.0.0.0 --port 8000
   ```

Environment variables:
- `PI_DEPLOY` – optional prevalence (0..1) used to recalibrate predictions on the fly. Set this to match the prevalence expected in the audience you are serving (e.g. `PI_DEPLOY=0.002` for a 0.2% baseline risk). If unset the backend falls back to the training prevalence stored in `meta.json`.
- `PI_TRAIN` – overrides the training prevalence stored in `meta.json` (rarely needed).
- `LUNG_CANCER_CSV` – **only required when retraining.** Point this to your local CSV (`export LUNG_CANCER_CSV=/absolute/path/to/lung_cancer_dataset.csv`). The dataset itself does **not** need to live in the repository; keep it in secure storage and reference it through this environment variable.

> The pickled scaler/model/meta files shipped in `backend/` are loaded automatically. If you retrain (`python lungcancer.py`), keep the artifacts in the same folder.

### 1.2 Frontend (Next.js)

1. **Install Node.js 20** (LTS) and npm 10.
2. **Install dependencies and start the dev server**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
3. **Point the UI at the API** by creating a `.env.local` file:
   ```bash
   NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000
   ```
4. Open `http://localhost:3000` in your browser.

For a production build:
```bash
npm run build
npm start
```

---

## 2. Run with Docker Compose

Container images are defined in `backend/Dockerfile` and `frontend/Dockerfile`. To build and run the full stack:

```bash
# from the repository root
docker compose up --build
```

- API is available at `http://localhost:8000`.
- Frontend is available at `http://localhost:3000`.
- The frontend container injects `NEXT_PUBLIC_API_BASE=http://api:8000`, so it reaches the API through the Docker network.

Override runtime settings:
```bash
# Inspect defaults
docker compose run --rm api env | grep PI_

# Example 1: persist prevalence in a .env file (docker compose reads it automatically)
echo "PI_DEPLOY=0.002" > .env
docker compose up --build

# Example 2: override prevalence for a single run
PI_DEPLOY=0.002 docker compose up --build

# Expose the API on a different host port by editing docker-compose.yml
#   services.api.ports -> "8080:8000"
```
(When retraining inside a container, mount your dataset instead of copying it into the image. Example: `docker run --rm -v /path/to/datasets:/data backend-image bash -c "LUNG_CANCER_CSV=/data/lung_cancer_dataset.csv python lungcancer.py"`.)

To stop the stack:
```bash
docker compose down
```

### 2.1 One-command quick start

If you just want to verify everything works end-to-end:

```bash
cp .env.example .env            # optional – edit PI_DEPLOY or add more settings
docker compose up --build -d    # run the API + frontend in the background
```

Then visit `http://localhost:3000`. When you are finished run `docker compose down`.

---

## 3. Deploying to cloud platforms

### Hosting quick start (Render backend + Vercel frontend)

If you just need a concrete “click here, paste that” walkthrough, follow the exact steps below. They assume you have already
pushed this repository to GitHub or GitLab.

#### 1. Deploy the API on Render

1. Sign in to [Render](https://render.com/) and click **New → Web Service**.
2. Connect your repository and pick the main branch.
3. Choose **Docker** as the runtime and set the **Dockerfile path** to `backend/Dockerfile`.
4. Under **Environment**, add the variables:
   - `PI_DEPLOY=0.002` (change as needed).
   - `PORT=8000` (Render will override it, but keeping the default avoids mismatched ports locally).
5. Set the **Start Command** to:
   ```bash
   uvicorn app:app --host 0.0.0.0 --port $PORT
   ```
6. Click **Create Web Service** and wait for the first deploy to finish. Copy the public URL (for example,
   `https://lung-risk-backend.onrender.com`).

#### 2. Deploy the frontend on Vercel

1. Visit [Vercel](https://vercel.com/) and create a new project from the same repository.
2. When prompted for the **Framework Preset**, choose **Next.js**.
3. Add an environment variable under **Production → Environment Variables**:
   - `NEXT_PUBLIC_API_BASE=https://lung-risk-backend.onrender.com` (replace with the URL from Render).
4. Click **Deploy**. Vercel will build the Next.js app with the backend URL baked into the static assets.
5. Once the deployment succeeds, open the Vercel-provided URL (e.g., `https://lung-risk-frontend.vercel.app`) and submit a sample
   form. The network tab should show a successful `POST` to `/predict` on your Render backend.

#### 3. (Optional) Add custom domains

- **Render:** Go to the backend service → **Settings → Custom Domains**, add your domain, and follow Render’s DNS instructions.
- **Vercel:** In the frontend project → **Settings → Domains**, add the domain and point your DNS `CNAME` to the Vercel target.

You can mix-and-match providers (e.g., both services on Render, or API on Cloud Run, UI on Netlify); the key requirement is that
`NEXT_PUBLIC_API_BASE` points to the running backend and that the backend allows cross-origin requests.

---

### Option A – Docker-friendly hosts (Render, Railway, Fly.io, Azure Container Apps)
1. Build the backend image locally or let the platform build it from `backend/Dockerfile`.
2. Expose port `8000` and configure optional environment variables (`PI_DEPLOY`, `PI_TRAIN`).
3. For the frontend, build from `frontend/Dockerfile`, set `NEXT_PUBLIC_API_BASE` to the deployed API URL, and expose port `3000` (or prerender/export if your host serves static files).

#### Example: Deploy the backend to Render
1. Commit your code and push to GitHub.
2. In Render, create a **New Web Service** and connect your repository.
3. Use `Docker` as the runtime and point Render at `backend/Dockerfile`.
4. Set **Start Command** to `uvicorn app:app --host 0.0.0.0 --port $PORT`.
5. Add environment variables:
   - `PI_DEPLOY=0.002` (or any prevalence value you need at inference time).
   - `PORT=10000` (Render injects this automatically, but adding a default avoids surprises locally).
6. Click **Create Web Service**. Once deployed, note the public URL (e.g., `https://lung-risk-backend.onrender.com`).

#### Example: Deploy the frontend to Render
1. Create another **Web Service** pointing to the same repo.
2. Use `Docker` with `frontend/Dockerfile` and set the **Start Command** to `npm start`.
3. In the environment variables, add `NEXT_PUBLIC_API_BASE=https://lung-risk-backend.onrender.com` (replace with your backend URL).
4. Expose port `3000` (Render again sets `$PORT`, so use `npm start -- -p $PORT` if you need to match their convention).

### Option B – Managed FastAPI hosting (e.g., AWS App Runner, Google Cloud Run)
- Use the backend Dockerfile as the service image.
- Ensure the service listens on the port required by the provider (set `PORT` env var if needed: `uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}`).
- Mount or bake the model artifacts (`model.pkl`, `scaler.pkl`, `meta.json`) into the image as-is.
- Configure `PI_DEPLOY` in the platform console or via IaC if you need to override the training prevalence.

#### Example: Deploy the backend to Google Cloud Run
1. Build and push the image: `gcloud builds submit --tag gcr.io/PROJECT_ID/lung-risk-backend backend`.
2. Deploy with: `gcloud run deploy lung-risk-api --image gcr.io/PROJECT_ID/lung-risk-backend --port 8000 --allow-unauthenticated`.
3. Set environment variables during deploy: `--set-env-vars PI_DEPLOY=0.002`.
4. Copy the service URL for the frontend.

### Option C – Static frontend hosting (Vercel, Netlify)
- Build the frontend (`npm run build`) and deploy the `.next` output according to your provider.
- Set `NEXT_PUBLIC_API_BASE` as an environment variable pointing to your backend URL.
- Ensure CORS is open on the backend (`app.py` already allows all origins by default).

#### Example: Deploy the frontend to Vercel
1. Install the Vercel CLI and log in (`npm i -g vercel && vercel login`).
2. From the `frontend/` directory, run `vercel` and follow the prompts.
3. When asked for environment variables, set `NEXT_PUBLIC_API_BASE=https://lung-risk-backend.onrender.com`.
4. For production, run `vercel --prod` to create a permanent URL.

---

## 4. Operational notes

- **Health checks:** `GET /model-info` returns model metadata and is suitable for liveness probes.
- **Logging:** Uvicorn logs to stdout; capture logs via your hosting platform.
- **Scaling:** The FastAPI app is stateless; run multiple instances behind a load balancer. Ensure the model artifacts are baked into the image or mounted.
- **Security:** Add authentication (e.g., API keys) and tighten CORS before serving sensitive data.

---

## 5. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `POST /predict` returns 422 | Ensure all request fields match the schema (see `backend/app.py`). |
| `ModuleNotFoundError` in Docker build | Confirm the base image has network access and that `requirements.txt` is unchanged. |
| Frontend shows CORS error | Verify `NEXT_PUBLIC_API_BASE` points to a reachable backend URL and that port 8000 is exposed. |
| Wrong probability scaling | Check `PI_DEPLOY` / `PI_TRAIN` environment variables and the values returned by `/model-info`. |
| Backend cannot find dataset when retraining | Make sure `LUNG_CANCER_CSV` points to an accessible path (mount it with `-v` when using Docker). |

---

Need more automation? Consider adding CI/CD workflows (GitHub Actions) that build/push the Docker images and run smoke tests.
