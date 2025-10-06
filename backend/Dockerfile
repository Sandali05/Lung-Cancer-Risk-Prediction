# syntax=docker/dockerfile:1
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

ARG APP_DIR=backend

WORKDIR /app

# System dependencies for scientific Python stack
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY ${APP_DIR}/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY ${APP_DIR}/ ./

ENV PORT=8000

EXPOSE ${PORT}

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
