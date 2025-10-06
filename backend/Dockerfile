# syntax=docker/dockerfile:1
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# System dependencies for scientific Python stack
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8000

EXPOSE ${PORT}

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
