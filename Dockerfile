# ---- deps stage ----
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- builder stage ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

# ---- runner stage ----
FROM node:20-bookworm-slim AS runner

# 系统依赖：yt-dlp + ffmpeg + curl
# - python3 不装：yt-dlp 标准二进制是 PyInstaller 单文件包，自带 Python，无需外部依赖
# - curl 用于下载 yt-dlp 二进制 + 替代代码里 curl.exe 的跨平台分支
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        ffmpeg \
        curl \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# HF Spaces 强制以 uid 1000 跑容器；按 HF 文档建议在 COPY 之前建用户、改 WORKDIR
# node:20 基础镜像自带 node 用户已占 uid 1000，先删除再建 user
RUN userdel -r node 2>/dev/null || true && useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=7860 \
    HOSTNAME=0.0.0.0
WORKDIR $HOME/app

# Next.js standalone 产物（用 --chown 避免 HF 文档警告的"recursive chown 镜像翻倍"）
COPY --from=builder --chown=user /app/.next/standalone ./
COPY --from=builder --chown=user /app/.next/static ./.next/static
COPY --from=builder --chown=user /app/public ./public

COPY --chown=user scripts/start.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 7860
CMD ["./start.sh"]
