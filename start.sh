#!/bin/bash
# CTFN Studio Startup Script
#
# Usage:
#   ./start.sh                    # Auto-detect optimal GPU config
#   ./start.sh --force-4bit       # Force 4-bit quantization
#   ./start.sh --force-swap       # Force model swapping (low VRAM mode)
#   ./start.sh --help             # Show help

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Parse arguments
EXTRA_ENV=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --force-4bit)
            EXTRA_ENV="$EXTRA_ENV HEARTMULA_4BIT=true"
            shift
            ;;
        --force-swap)
            EXTRA_ENV="$EXTRA_ENV HEARTMULA_SEQUENTIAL_OFFLOAD=true"
            shift
            ;;
        --help)
            echo "CTFN Studio Startup Script"
            echo ""
            echo "Usage: ./start.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --force-4bit    Force 4-bit quantization (saves VRAM)"
            echo "  --force-swap    Force model swapping (for GPUs <14GB)"
            echo "  --help          Show this help message"
            echo ""
            echo "By default, the script auto-detects the best configuration"
            echo "based on your GPU's VRAM:"
            echo ""
            echo "  20GB+     Full precision (fastest)"
            echo "  14-20GB   4-bit quantization (fast)"
            echo "  10-14GB   4-bit + model swapping (+70s/song)"
            echo "  <10GB     May not work"
            echo ""
            echo "Models are auto-downloaded to: backend/models/"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              CTFN Studio                                 ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Kill any existing instances
echo "Stopping any existing instances..."
pkill -f "uvicorn backend.app.main:app" 2>/dev/null || true
pkill -f "vite.*5173" 2>/dev/null || true
sleep 2

# Start backend with auto-detection (or manual overrides)
echo "Starting backend (auto-detecting GPU configuration)..."
source venv/bin/activate
env $EXTRA_ENV \
    PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True \
    python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 > /tmp/heartmula_backend.log 2>&1 &

# Start frontend with LAN access
echo "Starting frontend..."
cd frontend
npm run dev -- --host 0.0.0.0 > /tmp/heartmula_frontend.log 2>&1 &
cd "$SCRIPT_DIR"

echo ""
echo "Backend:  http://localhost:8000 (loading models...)"
echo "Frontend: http://localhost:5173"
echo ""
echo "Logs:"
echo "  Backend:  tail -f /tmp/heartmula_backend.log"
echo "  Frontend: tail -f /tmp/heartmula_frontend.log"
echo ""
echo "Waiting for backend to load models (auto-downloads on first run ~5GB)..."

# Wait for backend to be ready (up to 5 minutes for first-time download)
for i in {1..300}; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo ""
        echo "✓ Backend ready!"
        break
    fi
    sleep 1
    if [ $((i % 10)) -eq 0 ]; then
        echo -n "."
    fi
done

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  CTFN Studio is ready!                                    ║"
echo "║  Open: http://localhost:5173                              ║"
echo "╚═══════════════════════════════════════════════════════════╝"
