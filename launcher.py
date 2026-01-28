#!/usr/bin/env python3
"""
HeartMuLa Studio macOS Launcher
This script is the entry point for the PyInstaller-bundled macOS app.
It sets up the environment and launches the FastAPI server with the frontend.
"""

import os
import sys
import subprocess
import webbrowser
import time
from pathlib import Path

def setup_environment():
    """Set up the macOS app environment."""
    # Determine if we're running as a bundled app
    if getattr(sys, 'frozen', False):
        # Running as PyInstaller bundle
        bundle_dir = sys._MEIPASS
        app_dir = Path(bundle_dir)
    else:
        # Running as script
        app_dir = Path(__file__).parent
    
    # Set up paths for the app
    home_dir = Path.home()
    app_support_dir = home_dir / "Library" / "Application Support" / "HeartMuLa"
    models_dir = app_support_dir / "models"
    generated_audio_dir = app_support_dir / "generated_audio"
    ref_audio_dir = app_support_dir / "ref_audio"
    logs_dir = home_dir / "Library" / "Logs" / "HeartMuLa"
    
    # Create directories
    for directory in [app_support_dir, models_dir, generated_audio_dir, ref_audio_dir, logs_dir]:
        directory.mkdir(parents=True, exist_ok=True)
    
    # Create backend directory structure in app bundle if it doesn't exist
    backend_dir = app_dir / "backend"
    backend_dir.mkdir(exist_ok=True)
    
    # Create symlinks from backend directories to user directories
    backend_generated_audio = backend_dir / "generated_audio"
    backend_ref_audio = backend_dir / "ref_audio"
    backend_models = backend_dir / "models"
    
    # Remove existing symlinks/directories and create new ones
    for link_path, target_path in [
        (backend_generated_audio, generated_audio_dir),
        (backend_ref_audio, ref_audio_dir),
        (backend_models, models_dir)
    ]:
        if link_path.exists() or link_path.is_symlink():
            if link_path.is_symlink():
                link_path.unlink()
            elif link_path.is_dir():
                import shutil
                shutil.rmtree(link_path)
        link_path.symlink_to(target_path)
    
    # Set environment variables
    os.environ["HEARTMULA_MODEL_DIR"] = str(models_dir)
    os.environ["HEARTMULA_DB_PATH"] = str(app_support_dir / "jobs.db")
    os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"  # Enable Metal Performance Shaders
    
    # Change working directory to app bundle to ensure relative paths work
    os.chdir(app_dir)
    
    return app_dir, logs_dir

def launch_server(app_dir, logs_dir):
    """Launch the FastAPI server."""
    log_file = logs_dir / "heartmula.log"
    
    # Import and run the FastAPI app
    sys.path.insert(0, str(app_dir))
    
    # Configure uvicorn to run the app
    import uvicorn
    from backend.app.main import app
    
    # Open browser after a short delay
    def open_browser():
        time.sleep(3)
        webbrowser.open("http://localhost:8000")
    
    import threading
    browser_thread = threading.Thread(target=open_browser, daemon=True)
    browser_thread.start()
    
    # Run the server
    print(f"Starting HeartMuLa Studio server...")
    print(f"Logs: {log_file}")
    print(f"Opening browser at http://localhost:8000")
    
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="info",
        access_log=True
    )

def main():
    """Main entry point."""
    try:
        app_dir, logs_dir = setup_environment()
        launch_server(app_dir, logs_dir)
    except KeyboardInterrupt:
        print("\nShutting down HeartMuLa Studio...")
        sys.exit(0)
    except Exception as e:
        print(f"Error starting HeartMuLa Studio: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
