<p align="center">
  <img src="https://raw.githubusercontent.com/audiohacking/HeartMuLa-Studio/main/frontend/public/ctfn-icon.png" alt="CTFN Studio" width="120" height="120">
</p>

<h1 align="center">CTFN Studio</h1>

<p align="center">
  <strong>Apple Silicon / MPS fork — AI music generation studio for <a href="https://github.com/HeartMuLa/heartlib">HeartLib</a>, optimized for Apple Metal (M-Series &amp; Intel Macs)</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#credits">Credits</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react" alt="React">
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi" alt="FastAPI">
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?style=flat-square&logo=tailwindcss" alt="TailwindCSS">
  <img src="https://img.shields.io/badge/Apple-MPS%20%2F%20Metal-000000?style=flat-square&logo=apple" alt="Apple MPS">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License">
</p>

---

## About this fork

This repository is a **fork of HeartMuLa Studio** (rebranded as **CTFN Studio**) focused on **Apple MPS (Metal Performance Shaders)**

- **Native macOS app** — Standalone `.app` with native window (pywebview/Cocoa)
- **MPS-accelerated inference** — HeartMuLa and HeartCodec run on Metal where supported
- **Unified Memory friendly** — 4-bit quantization and MPS fallbacks for typical Mac RAM sizes
- **Close window = quit** — Closing the app window exits the process and frees memory (no Dock respawn)

For CUDA, Linux, or Windows setups, see the upstream project.

---

## Demo

<p align="center">
  <img src="preview.gif" alt="CTFN Studio Preview" width="100%">
</p>

---

## Features

### AI Music Generation
| Feature | Description |
|---------|-------------|
| **Full Song Generation** | Create complete songs with vocals and lyrics up to 4+ minutes |
| **Instrumental Mode** | Generate instrumental tracks without vocals |
| **Style Tags** | Define genre, mood, tempo, and instrumentation |
| **Seed Control** | Reproduce exact generations for consistency |
| **Queue System** | Queue multiple generations and process them sequentially |

### Reference Audio (Style Transfer) _Experimental_
| Feature | Description |
|---------|-------------|
| **Audio Upload** | Use any audio file as a style reference |
| **Waveform Visualization** | Waveform display powered by WaveSurfer.js |
| **Region Selection** | Draggable 10-second region selector for precise style sampling |
| **Style Influence** | Adjustable slider to control reference audio influence (1–100%) |
| **Synced Playback** | Modal waveform syncs with bottom player in real time |

### AI-Powered Lyrics
| Feature | Description |
|---------|-------------|
| **Lyrics Generation** | Generate lyrics from a topic using LLMs |
| **Multiple Providers** | Support for Ollama (local) and OpenRouter (cloud) |
| **Style Suggestions** | AI-suggested style tags based on your concept |
| **Prompt Enhancement** | Improve your prompts with AI assistance |

### Interface
| Feature | Description |
|---------|-------------|
| **Modern UI** | Clean layout with dark/light mode |
| **Bottom Player** | Player with waveform, volume, and progress |
| **History Feed** | Browse, search, and manage generated tracks |
| **Likes & Playlists** | Organize favorites into custom playlists |
| **Real-time Progress** | Live generation progress with step indicators |
| **Responsive Design** | Works on desktop and mobile devices |

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, TypeScript, TailwindCSS, Framer Motion, WaveSurfer.js |
| **Backend** | FastAPI, SQLModel, SSE (Server-Sent Events) |
| **AI Engine** | [HeartLib](https://github.com/HeartMuLa/heartlib) — MuQ, MuLan, HeartCodec |
| **LLM Integration** | Ollama, OpenRouter |
| **Acceleration** | PyTorch MPS (Apple Metal) |

---

## Performance (Apple MPS / Metal)

This fork is tuned for **Apple Silicon (M1/M2/M3)** and **Intel Macs with Metal**:

- **MPS device** — HeartMuLa and HeartCodec run on MPS when available; CPU fallback for unsupported ops.
- **4-bit quantization** — Lowers memory use (e.g. ~11GB → ~3GB equivalent) for Unified Memory:
  ```bash
  HEARTMULA_4BIT=true python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
  ```
- **MPS decode** — Audio decoding uses Metal where possible; runtime patches for heartlib compatibility are documented in [MPS_OPTIMIZATION.md](MPS_OPTIMIZATION.md).

Models are **auto-downloaded** from Hugging Face on first run (~5GB): HeartMuLa, HeartCodec, tokenizer, and config.

---

## Installation

### macOS App (recommended)

1. Download the latest **CTFNStudio-macOS.dmg** (or `.zip`) from [Releases](https://github.com/audiohacking/HeartMuLa-Studio/releases).
2. Open the DMG and drag **CTFN Studio.app** to Applications.
3. Double-click to launch. If macOS blocks it, use **Right-click → Open**, or run:
   ```bash
   xattr -cr /Applications/CTFNStudio.app
   ```

**Data is stored in your user Library**, not inside the app:

```
~/Library/Application Support/HeartMuLa/
├── models/              # AI models (~5GB, auto-downloaded)
├── generated_audio/     # Generated music files
├── ref_audio/           # Uploaded reference audio
└── jobs.db              # Song history

~/Library/Logs/HeartMuLa/
└── (logs)
```

**Requirements:** macOS 10.13+, Apple Silicon or Intel Mac with Metal, 10GB+ RAM, ~15GB free disk.

---

### Development (Python + Node)

**Prerequisites:** Python 3.10+, Node.js 18+, Git.

```bash
git clone https://github.com/audiohacking/HeartMuLa-Studio.git
cd HeartMuLa-Studio
```

**Backend:**

```bash
python -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

**Frontend:**

```bash
cd frontend
npm install
npm run build
cd ..
```

**Quick start (dev):**

```bash
./start.sh
```

Then open **http://localhost:5173** (dev) or **http://localhost:8000** (production).

---

## Usage

**Backend only:**

```bash
source venv/bin/activate
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

**Frontend dev:**

```bash
cd frontend && npm run dev
```

MPS is used automatically when available; no extra flags needed.

---

## Configuration

Create a `.env` file in `backend/` for optional settings:

```env
OPENROUTER_API_KEY=your_api_key_here   # Cloud LLM
OLLAMA_HOST=http://localhost:11434    # Local LLM
```

**Backend / launcher env (optional):**

| Variable | Default | Description |
|----------|---------|-------------|
| `HEARTMULA_MODEL_DIR` | `backend/models` or App Support | Model directory |
| `HEARTMULA_4BIT` | `auto` | 4-bit quantization: `auto`, `true`, `false` |
| `HEARTMULA_SEQUENTIAL_OFFLOAD` | `auto` | Model swapping for low RAM: `auto`, `true`, `false` |
| `HEARTMULA_VERSION` | `RL-3B-20260123` | Model version |

---

## API (summary)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/generate/music` | Start music generation |
| `POST` | `/generate/lyrics` | Generate lyrics (LLM) |
| `POST` | `/upload/ref_audio` | Upload reference audio |
| `GET` | `/history` | Generation history |
| `GET` | `/jobs/{id}` | Job status |
| `GET` | `/events` | SSE stream for progress |
| `GET` | `/audio/{path}` | Stream generated audio |

---

## Troubleshooting

| Issue | Suggestion |
|-------|------------|
| Models not downloading | Check internet and disk space (~5GB in `backend/models` or App Support) |
| Frontend can’t connect | Ensure backend is running on port 8000 |
| LLM not working | Run Ollama locally or set OpenRouter API key in `backend/.env` |
| Slow or high memory | Try `HEARTMULA_4BIT=true` or `HEARTMULA_SEQUENTIAL_OFFLOAD=true` |
| macOS app won’t open | Use Right-click → Open, or `xattr -cr /Applications/CTFNStudio.app` |

---

## Building the macOS app

```bash
./local_build.sh
```

This installs deps, builds the frontend, generates the icon, runs PyInstaller, and signs the bundle. Output: `dist/CTFNStudio.app`. See [build/macos/README.md](build/macos/README.md) and [.github/workflows/build-macos-release.yml](.github/workflows/build-macos-release.yml) for details.

---

## Credits

- **[HeartMuLa/heartlib](https://github.com/HeartMuLa/heartlib)** — Open-source AI music generation engine used by this project.
- **WaveSurfer.js** — Audio waveform visualization.

CTFN Studio is maintained for Apple MPS / Metal. The underlying AI engine is [HeartMuLa/heartlib](https://github.com/HeartMuLa/heartlib); this project is not affiliated with the upstream HeartMuLa project beyond use of HeartLib.

---

## License

[MIT License](LICENSE).
