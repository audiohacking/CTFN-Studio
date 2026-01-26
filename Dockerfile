# HeartMuLa Studio - Docker Image
# Multi-stage build for optimized image size

# =============================================================================
# Stage 1: Build Frontend
# =============================================================================
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

# Copy package files first for better caching
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build the frontend
RUN npm run build

# =============================================================================
# Stage 2: Final Image with Python + CUDA
# =============================================================================
FROM nvidia/cuda:12.1.0-cudnn8-devel-ubuntu22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3.11-venv \
    python3.11-dev \
    python3-pip \
    git \
    ffmpeg \
    libsndfile1 \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3.11 /usr/bin/python3 \
    && ln -sf /usr/bin/python3.11 /usr/bin/python

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN useradd -m -u 1000 heartmula && \
    mkdir -p /app/backend/models /app/backend/generated_audio /app/backend/ref_audio /app/backend/db && \
    chown -R heartmula:heartmula /app

# Copy backend requirements first for better caching
COPY --chown=heartmula:heartmula backend/requirements.txt /app/backend/

# Install Python dependencies
RUN pip3 install --no-cache-dir --upgrade pip && \
    pip3 install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121 && \
    pip3 install --no-cache-dir -r /app/backend/requirements.txt && \
    pip3 install --no-cache-dir bitsandbytes accelerate

# Copy backend code
COPY --chown=heartmula:heartmula backend/ /app/backend/

# Copy built frontend from Stage 1
COPY --from=frontend-builder --chown=heartmula:heartmula /app/frontend/dist /app/frontend/dist

# Copy startup script
COPY --chown=heartmula:heartmula start.sh /app/

# Environment variables for HeartMuLa
ENV PYTHONUNBUFFERED=1 \
    PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True \
    HEARTMULA_4BIT=auto \
    HEARTMULA_SEQUENTIAL_OFFLOAD=auto \
    HF_HOME=/app/backend/models \
    TORCHINDUCTOR_CACHE_DIR=/app/backend/models/.torch_cache

# Expose port
EXPOSE 8000

# Switch to non-root user
USER heartmula

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Default command - run the backend server
CMD ["python3", "-m", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
