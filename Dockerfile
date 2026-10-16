# syntax=docker/dockerfile:1.7
# Layers go from least to most often changed, so editing app code never reinstalls Whisper.
FROM python:3.12-slim-bookworm

COPY --from=oven/bun:1.3-debian /usr/local/bin/bun /usr/local/bin/bun
COPY --from=mwader/static-ffmpeg:7.1 /ffmpeg /ffprobe /usr/local/bin/
COPY --from=ghcr.io/astral-sh/uv:0.8 /uv /usr/local/bin/uv

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    HF_HOME=/opt/huggingface \
    WHISPER_PYTHON=python3

WORKDIR /app

COPY scripts/transcribe.py scripts/transcribe.py.lock scripts/
RUN --mount=type=cache,target=/root/.cache/uv \
    uv export --quiet --script scripts/transcribe.py --no-hashes \
    | uv pip install --system --quiet -r - \
    && mkdir -p "$HF_HOME" && chmod a+rwX "$HF_HOME"

COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production

COPY fonts ./fonts
COPY licenses ./licenses
COPY prompts ./prompts
COPY src ./src
COPY main.ts tsconfig.json ./

# The static ffmpeg build ships no fontconfig setup; point it at the bundled fonts.
COPY <<EOF /etc/fonts/fonts.conf
<?xml version="1.0"?>
<fontconfig><dir>/app/fonts</dir><cachedir>/tmp/fontconfig</cachedir></fontconfig>
EOF
ENV FONTCONFIG_FILE=/etc/fonts/fonts.conf

CMD ["bun", "run", "main.ts"]
