<p align="center">
  <img src="https://raw.githubusercontent.com/fspecii/HeartMuLa-Studio/main/frontend/public/heartmula-icon.svg" alt="HeartMuLa Studio" width="120" height="120">
</p>

<h1 align="center">HeartMuLa Studio</h1>

<p align="center">
  <strong>A professional, Suno-like music generation studio for <a href="https://github.com/HeartMuLa/heartlib">HeartLib</a></strong>
</p>

<p align="center">
  <a href="https://www.youtube.com/watch?v=W7-JB-Pl8So">
    <img src="https://img.shields.io/badge/▶_Watch_Demo-YouTube-FF0000?style=for-the-badge&logo=youtube" alt="Watch Demo on YouTube">
  </a>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#demo">Demo</a> •
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
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License">
</p>

---

## Demo

<p align="center">
  <img src="preview.gif" alt="HeartMuLa Studio Preview" width="100%">
</p>

## Features

### 🎵 AI Music Generation
| Feature | Description |
|---------|-------------|
| **Full Song Generation** | Create complete songs with vocals and lyrics up to 4+ minutes |
| **Instrumental Mode** | Generate instrumental tracks without vocals |
| **Style Tags** | Define genre, mood, tempo, and instrumentation |
| **Seed Control** | Reproduce exact generations for consistency |
| **Queue System** | Queue multiple generations and process them sequentially |

### 🎨 Reference Audio (Style Transfer) `Experimental`
| Feature | Description |
|---------|-------------|
| **Audio Upload** | Use any audio file as a style reference |
| **Waveform Visualization** | Professional waveform display powered by WaveSurfer.js |
| **Region Selection** | Draggable 10-second region selector for precise style sampling |
| **Style Influence** | Adjustable slider to control reference audio influence (1-100%) |
| **Synced Playback** | Modal waveform syncs with bottom player in real-time |

> **Coming Soon: LoRA Voice Training** - We're actively developing LoRA-based voice training with exceptional results. Our early tests show voice consistency that surpasses Suno. Stay tuned for updates!

### 🎤 AI-Powered Lyrics
| Feature | Description |
|---------|-------------|
| **Lyrics Generation** | Generate lyrics from a topic using LLMs |
| **Multiple Providers** | Support for Ollama (local) and OpenRouter (cloud) |
| **Style Suggestions** | AI-suggested style tags based on your concept |
| **Prompt Enhancement** | Improve your prompts with AI assistance |

### 🎧 Professional Interface
| Feature | Description |
|---------|-------------|
| **Spotify-Inspired UI** | Clean, modern design with dark/light mode |
| **Bottom Player** | Full-featured player with waveform, volume, and progress |
| **History Feed** | Browse, search, and manage all generated tracks |
| **Likes & Playlists** | Organize favorites into custom playlists |
| **Real-time Progress** | Live generation progress with step indicators |
| **Responsive Design** | Works on desktop and mobile devices |

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, TypeScript, TailwindCSS, Framer Motion, WaveSurfer.js |
| **Backend** | FastAPI, SQLModel, SSE (Server-Sent Events) |
| **AI Engine** | [HeartLib](https://github.com/HeartMuLa/heartlib) - MuQ, MuLan, HeartCodec |
| **LLM Integration** | Ollama, OpenRouter |

## Prerequisites

- **Python** 3.10 or higher
- **Node.js** 18 or higher
- **CUDA GPU(s)**:
  - Multi-GPU: 2x 12GB+ GPUs (e.g., 2x RTX 3060/4070)
  - Single GPU: 24GB+ (e.g., RTX 3090/4090) or 16GB with lazy loading
- **Git** for cloning the repository

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/fspecii/HeartMuLa-Studio.git
cd HeartMuLa-Studio
```

### 2. Backend Setup

```bash
# Create virtual environment in root folder
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install backend dependencies
pip install -r backend/requirements.txt
```

> **Note:** HeartLib models (~5GB) will be downloaded automatically from HuggingFace on first run.

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Build for production
npm run build
```

## Usage

### Start the Backend

```bash
source venv/bin/activate  # Windows: venv\Scripts\activate

# Single GPU
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000

# Multi-GPU (recommended for 2+ GPUs)
CUDA_VISIBLE_DEVICES=0,1 python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

### Start the Frontend

**Development mode:**
```bash
cd frontend
npm run dev
```

**Production mode:**
```bash
# Serve the dist folder with any static server
npx serve dist -l 5173
```

### Access the Application

| Mode | URL |
|------|-----|
| Development | http://localhost:5173 |
| Production | http://localhost:8000 |

## Configuration

### Environment Variables

Create a `.env` file in the `backend` directory:

```env
# OpenRouter API (for cloud LLM)
OPENROUTER_API_KEY=your_api_key_here

# Ollama (for local LLM)
OLLAMA_HOST=http://localhost:11434
```

### GPU Configuration

HeartMuLa Studio automatically detects available GPUs and distributes the model:

| Setup | VRAM Required | Configuration |
|-------|---------------|---------------|
| **Multi-GPU (Recommended)** | 12GB + 12GB | HeartMuLa on GPU 0, HeartCodec on GPU 1 |
| **Single GPU (High VRAM)** | 24GB+ | Both models on same GPU |
| **Single GPU (Low VRAM)** | 16GB | Lazy loading - codec on CPU, loaded on demand |

**Multi-GPU Setup (Best Performance):**
```bash
CUDA_VISIBLE_DEVICES=0,1 python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

**Single GPU / Low VRAM Setup:**
The backend automatically uses lazy loading when only one GPU is detected. HeartCodec stays on CPU and is loaded to GPU only during audio decoding, then released.

**Memory Optimization:**
```bash
PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
```

### LLM Setup (Optional)

For AI-powered lyrics generation:

**Option A: Ollama (Local)**
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.2
```

**Option B: OpenRouter (Cloud)**
1. Get an API key from [OpenRouter](https://openrouter.ai/)
2. Add it to your `.env` file

## Project Structure

```
HeartMuLa-Studio/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application & routes
│   │   ├── models.py            # Pydantic/SQLModel schemas
│   │   └── services/
│   │       ├── music_service.py # HeartLib integration
│   │       └── llm_service.py   # LLM providers
│   ├── generated_audio/         # Output MP3 files
│   ├── ref_audio/               # Uploaded reference audio
│   ├── jobs.db                  # SQLite database
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ComposerSidebar.tsx    # Main generation form
│   │   │   ├── BottomPlayer.tsx       # Audio player
│   │   │   ├── RefAudioRegionModal.tsx # Waveform selector
│   │   │   ├── HistoryFeed.tsx        # Track history
│   │   │   └── ...
│   │   ├── App.tsx              # Main application
│   │   └── api.ts               # Backend API client
│   ├── public/
│   └── package.json
├── preview.gif
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/generate/music` | Start music generation |
| `POST` | `/generate/lyrics` | Generate lyrics with LLM |
| `POST` | `/upload/ref_audio` | Upload reference audio |
| `GET` | `/history` | Get generation history |
| `GET` | `/jobs/{id}` | Get job status |
| `GET` | `/events` | SSE stream for real-time updates |
| `GET` | `/audio/{path}` | Stream generated audio |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| CUDA out of memory | Use multi-GPU setup with `CUDA_VISIBLE_DEVICES=0,1` or reduce duration |
| Models not downloading | Check internet connection and disk space (~5GB needed) |
| Frontend can't connect | Ensure backend is running on port 8000 |
| LLM not working | Check Ollama is running or OpenRouter API key is set in `backend/.env` |
| Only one GPU detected | Set `CUDA_VISIBLE_DEVICES=0,1` explicitly when starting backend |

## Credits

- **[HeartMuLa/heartlib](https://github.com/HeartMuLa/heartlib)** - The open-source AI music generation engine
- **[mainza-ai/milimomusic](https://github.com/mainza-ai/milimomusic)** - Inspiration for the backend architecture
- **[WaveSurfer.js](https://wavesurfer.xyz/)** - Audio waveform visualization

## License

This project is open source under the [MIT License](LICENSE).

## Contributing

Contributions are welcome! Please feel free to:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

<p align="center">
  Made with ❤️ for the open-source AI music community
</p>
