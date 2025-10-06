# Lung Cancer Frontend

This directory contains the Next.js frontend for the lung cancer risk prediction demo. The app is configured to build under strict TypeScript settings and to run well in offline-friendly Docker builds.

## Prerequisites
- Node.js 18 or newer
- npm 9 or newer

## Available scripts
- `npm run dev` — start the development server at [http://localhost:3000](http://localhost:3000)
- `npm run build` — generate an optimized production build (used in CI/Docker)
- `npm start` — run the production build with `next start`
- `npm test` — run the ESLint suite (alias for `npm run lint`)

## Deploying to GitHub Pages
This project statically exports the site (`next.config.js` sets `output: 'export'`). When the
build runs inside GitHub Actions we automatically derive the repository name from the
`GITHUB_REPOSITORY` environment variable and configure the correct `basePath`/`assetPrefix`.
This ensures the generated files are served from `https://<user>.github.io/<repo>/` instead of
the domain root, which prevents the blank page/404 that otherwise appears on GitHub Pages.

If you build locally and want to mimic the GitHub Pages output you can set
`GITHUB_ACTIONS=true GITHUB_REPOSITORY=<owner>/<repo>` before running `npm run build`.
As an alternative, set `NEXT_PUBLIC_GITHUB_PAGES_BASE=<repo-name>` to
explicitly control the exported base path.

After the static files are generated they need to be served from a branch that
GitHub Pages watches. The example GitHub Actions workflow publishes the
contents of the `out/` directory to a `gh-pages` branch, so in the repository
settings configure **Settings → Pages → Build and deployment** to use the
`gh-pages` branch and the `/ (root)` folder. Using a separate branch keeps the
exported artifacts isolated from the application source while still allowing
Pages to host the site.

### Manually publishing to `gh-pages`

If you are not using GitHub Actions you can push the exported files yourself:

1. Build the static site with the GitHub Pages environment variables so the
   correct paths are baked into the export:

   ```bash
   cd frontend
   GITHUB_ACTIONS=true GITHUB_REPOSITORY=<owner>/<repo> npm run build
   ```

2. Create (or update) a local worktree for the `gh-pages` branch that only
   contains the exported files:

   ```bash
   git worktree add -B gh-pages ../gh-pages
   rm -rf ../gh-pages/*
   cp -R out/. ../gh-pages/
   ```

3. Commit and push the static files from the worktree directory:

   ```bash
   cd ../gh-pages
   git add .
   git commit -m "Publish static export"
   git push origin gh-pages
   ```

4. In the repository settings confirm that **Settings → Pages** is configured
   to serve from the `gh-pages` branch and the `/ (root)` folder. GitHub Pages
   will redeploy shortly after the push completes.

### Pointing the frontend at your hosted API

The static site needs to know where the FastAPI backend is hosted. During
development the default of `http://127.0.0.1:8000` works, but in production you
must set `NEXT_PUBLIC_API_BASE` to your deployed API URL before building. For
example:

```bash
NEXT_PUBLIC_API_BASE=https://your-backend.example.com \
  GITHUB_ACTIONS=true GITHUB_REPOSITORY=<owner>/<repo> \
  npm run build
```

When the exported site loads it will call `${NEXT_PUBLIC_API_BASE}/predict` and
`${NEXT_PUBLIC_API_BASE}/model-info`, so ensure those endpoints are accessible
from the browser and that CORS is enabled on the backend. The deployed UI also
exposes an **API Connection** panel that lets you override the API base URL at
runtime; the value is stored in the browser&apos;s `localStorage` so you can test
different deployments without rebuilding the site.

## Styling notes
The default layout uses system UI fonts so the Docker image does not require network access for font downloads. Global styles live in [`app/globals.css`](app/globals.css) and the top-level layout is defined in [`app/layout.tsx`](app/layout.tsx).

## Docker usage
A multi-stage Dockerfile is provided in [`Dockerfile`](Dockerfile). Build the image with:

```bash
docker build -t lung-frontend .
```

To run the container:

```bash
docker run --rm -p 3000:3000 lung-frontend
```

The container listens on port 3000 by default.
