#!/bin/sh
set -eu

APP_DIR=/volume1/docker/xiaomusic
BUILD_DIR=/volume1/docker/xiaomusic-build
ARCHIVE="$BUILD_DIR/xiaomusic-main-deploy.tar.gz"
IMAGE=xiaomusic-local:codex
BACKUP="$APP_DIR/compose.yaml.bak.$(date +%Y%m%d-%H%M%S)"

if [ ! -f "$ARCHIVE" ]; then
  echo "Missing archive: $ARCHIVE" >&2
  exit 1
fi

mkdir -p "$BUILD_DIR/src"
rm -rf "$BUILD_DIR/src"
mkdir -p "$BUILD_DIR/src"
tar -xzf "$ARCHIVE" -C "$BUILD_DIR/src"

cat > "$BUILD_DIR/src/Dockerfile.nas" <<'DOCKERFILE'
ARG PYTHON_VERSION=3.14
FROM python:${PYTHON_VERSION}-alpine

RUN apk add --no-cache \
    build-base \
    ffmpeg \
    nodejs \
    npm \
    zlib-dev \
    jpeg-dev \
    freetype-dev \
    lcms2-dev \
    openjpeg-dev \
    tiff-dev \
    libwebp-dev

RUN pip install -U pdm
ENV PDM_CHECK_UPDATE=false

WORKDIR /app
COPY pyproject.toml README.md package.json ./
RUN pdm install --prod --no-editable -v
RUN npm install --loglevel=verbose

COPY xiaomusic/ ./xiaomusic/
COPY plugins/ ./plugins/
COPY holiday/ ./holiday/
COPY xiaomusic.py .
COPY xiaomusic/__init__.py /base_version.py

RUN mkdir -p /app/ffmpeg/bin \
    && ln -s "$(which ffmpeg)" /app/ffmpeg/bin/ffmpeg \
    && ln -s "$(which ffprobe)" /app/ffmpeg/bin/ffprobe \
    && touch /app/.dockerenv

VOLUME /app/conf
VOLUME /app/music
EXPOSE 8090

ENV TZ=Asia/Shanghai
ENV PATH=/app/.venv/bin:/usr/local/bin:$PATH

CMD ["/app/.venv/bin/python3", "/app/xiaomusic.py"]
DOCKERFILE

echo "Building $IMAGE ..."
docker build -f "$BUILD_DIR/src/Dockerfile.nas" -t "$IMAGE" "$BUILD_DIR/src"

if [ -f "$APP_DIR/compose.yaml" ]; then
  cp "$APP_DIR/compose.yaml" "$BACKUP"
  echo "Backed up compose.yaml to $BACKUP"
fi

cat > "$APP_DIR/compose.yaml" <<'YAML'
services:
  xiaomusic:
    image: xiaomusic-local:codex
    container_name: xiaomusic
    environment:
      - XIAOMUSIC_PUBLIC_PORT=58090
      - TZ=Asia/Shanghai
    ports:
      - "58090:8090"
    volumes:
      - /volume1/docker/xiaomusic:/app/conf
      - /volume1/music:/app/music
    restart: "no"
YAML

cd "$APP_DIR"
if docker compose version >/dev/null 2>&1; then
  docker compose up -d --force-recreate
else
  docker-compose up -d --force-recreate
fi

echo "Container status:"
docker ps --filter name=xiaomusic
echo
echo "Recent logs:"
docker logs --tail 80 xiaomusic
