# syntax=docker/dockerfile:1
FROM node:20-bullseye-slim AS deps
WORKDIR /app
ARG NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

FROM node:20-bullseye-slim AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/ ./
RUN npm run build

FROM node:20-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
EXPOSE $PORT
CMD ["sh","-c","npm run start"]
