import asyncio
import os
import gc
import torch
import torchaudio
import logging
from typing import Optional
from backend.app.models import GenerationRequest, Job, JobStatus
from sqlmodel import Session, select
import sys
sys.path.insert(0, '/home/l1/Desktop/heartlib/src')
from heartlib.pipelines.music_generation import HeartMuLaGenPipeline, HeartMuLaGenConfig
from heartlib.heartmula.modeling_heartmula import HeartMuLa
from heartlib.heartcodec.modeling_heartcodec import HeartCodec
from tokenizers import Tokenizer

logger = logging.getLogger(__name__)

def get_gpu_memory(device_id):
    props = torch.cuda.get_device_properties(device_id)
    return props.total_memory / (1024 ** 3)

class MusicService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MusicService, cls).__new__(cls)
            cls._instance.pipeline = None
            cls._instance.gpu_lock = asyncio.Lock()
            cls._instance.is_loading = False
            cls._instance.active_jobs = {} # Map job_id -> threading.Event
            cls._instance.gpu_mode = "single"
            cls._instance.job_queue = []  # List of job_ids waiting in queue
        return cls._instance

    def get_queue_position(self, job_id: str) -> int:
        """Returns 1-based position in queue, or 0 if not in queue."""
        try:
            return self.job_queue.index(job_id) + 1
        except ValueError:
            return 0

    def _broadcast_queue_update(self):
        """Notify all queued jobs of their current position."""
        for i, jid in enumerate(self.job_queue):
            event_manager.publish("job_queue", {"job_id": str(jid), "position": i + 1, "total": len(self.job_queue)})

    def _load_pipeline_multi_gpu(self, model_path: str, version: str, load_muq_mulan: bool = True):
        """Load pipeline with multi-GPU support using native mula_device/codec_device approach."""
        num_gpus = torch.cuda.device_count()

        if num_gpus < 2:
            logger.info(f"Found {num_gpus} GPU(s). Using single GPU mode with lazy loading...")
            self.gpu_mode = "single"
            print(f"[DEBUG] Loading pipeline with MuQ-MuLan: {load_muq_mulan}, lazy_load: True", flush=True)
            # Single GPU: Use lazy loading - codec stays on CPU until decode time
            return HeartMuLaGenPipeline.from_pretrained(
                model_path,
                device=torch.device("cuda"),
                codec_device=torch.device("cpu"),  # Keep codec on CPU to save GPU memory
                dtype=torch.bfloat16,
                version=version,
                load_muq_mulan=load_muq_mulan,
                lazy_load=True,  # Enable lazy loading for codec
            )

        # Multi-GPU setup: Use native mula_device/codec_device approach
        logger.info(f"Found {num_gpus} GPUs:")
        gpu_memories = {}
        for i in range(num_gpus):
            mem = get_gpu_memory(i)
            gpu_memories[i] = mem
            logger.info(f"  GPU {i}: {torch.cuda.get_device_name(i)} ({mem:.1f} GB)")

        # Put HeartMuLa on larger GPU, HeartCodec on smaller GPU
        mula_gpu = max(gpu_memories, key=gpu_memories.get)
        codec_gpu = min(gpu_memories, key=gpu_memories.get)

        logger.info(f"HeartMuLa -> GPU {mula_gpu} ({gpu_memories[mula_gpu]:.1f} GB)")
        logger.info(f"HeartCodec -> GPU {codec_gpu} ({gpu_memories[codec_gpu]:.1f} GB)")

        self.gpu_mode = "multi"

        # Use native from_pretrained with separate device arguments
        return HeartMuLaGenPipeline.from_pretrained(
            model_path,
            device=torch.device(f"cuda:{mula_gpu}"),  # mula_device
            codec_device=torch.device(f"cuda:{codec_gpu}"),  # codec_device
            dtype=torch.bfloat16,
            version=version,
            load_muq_mulan=load_muq_mulan,
        )

    async def initialize(self, model_path: str = "/home/l1/Desktop/heartlib/ckpt", version: str = "3B"):
        if self.pipeline is not None or self.is_loading:
            return

        self.is_loading = True
        logger.info(f"Loading Heartlib model from {model_path}...")
        try:
            # Run blocking load in executor to avoid freezing async loop
            loop = asyncio.get_running_loop()
            self.pipeline = await loop.run_in_executor(
                None,
                lambda: self._load_pipeline_multi_gpu(model_path, version)
            )
            logger.info(f"Heartlib model loaded successfully in {self.gpu_mode}-GPU mode.")
        except Exception as e:
            logger.error(f"Failed to load Heartlib model: {e}")
            raise e
        finally:
            self.is_loading = False

    async def generate_task(self, job_id: str, request: GenerationRequest, db_engine):
        """Background task to generate music."""
        job_id = str(job_id) # Ensure string for dictionary keys

        # Add to queue and broadcast position
        self.job_queue.append(job_id)
        queue_pos = self.get_queue_position(job_id)
        logger.info(f"Job {job_id} added to queue at position {queue_pos}")
        event_manager.publish("job_queued", {"job_id": job_id, "position": queue_pos, "total": len(self.job_queue)})
        self._broadcast_queue_update()

        # 1. Acquire GPU Lock (will wait if another job is processing)
        async with self.gpu_lock:
            # Remove from queue now that we have the lock
            if job_id in self.job_queue:
                self.job_queue.remove(job_id)
                self._broadcast_queue_update()  # Update remaining jobs' positions

            logger.info(f"Starting generation for job {job_id}")

            # 2. Update status to PROCESSING
            try:
                with Session(db_engine) as session:
                    # check if job still exists
                    job = session.exec(select(Job).where(Job.id == job_id)).one_or_none()
                    if not job:
                        logger.warning(f"Job {job_id} was deleted before processing started. Aborting.")
                        return

                    job.status = JobStatus.PROCESSING
                    session.add(job)
                    session.commit()
                    logger.info(f"Job {job_id} status updated to PROCESSING")
            except Exception as e:
                logger.error(f"Failed to update job status to PROCESSING: {e}")
                return

            try:
                # 3. Create unique filename
                output_filename = f"song_{job_id}.mp3"
                save_path = os.path.abspath(f"backend/generated_audio/{output_filename}")
                
                # Create Cancellation Event
                import threading
                abort_event = threading.Event()
                self.active_jobs[job_id] = abort_event
                
                # 4. Generate Auto-Title (Robust)
                from backend.app.services.llm_service import LLMService
                
                # Use lyrics for context if available, otherwise prompt
                context_source = request.lyrics if request.lyrics and len(request.lyrics) > 10 else request.prompt
                # Truncate to first 1000 chars to avoid token limits, but enough for context
                context_source = context_source[:1000]
                
                auto_title = "Untitled Track"
                try:
                    # Logic: If no model is specified, find what's running locally
                    model_to_use = request.llm_model
                    provider_to_use = "ollama"
                    if not model_to_use:
                        try:
                            models = LLMService.get_models()
                            if models:
                                # models is a list of dicts with 'id', 'name', 'provider'
                                model_to_use = models[0]["id"]
                                provider_to_use = models[0]["provider"]
                                logger.info(f"No specific LLM model requested. Using: {model_to_use} ({provider_to_use})")
                            else:
                                model_to_use = "llama3"
                                logger.warning("No specific LLM model requested and no local models found. Defaulting to 'llama3'.")
                        except Exception as e:
                             model_to_use = "llama3"
                             logger.warning(f"Error fetching local models: {e}. Fallback to 'llama3'.")

                    auto_title = LLMService.generate_title(context_source, model=model_to_use, provider=provider_to_use)
                except Exception as e:
                    logger.warning(f"Auto-title generation failed: {e}. Using default.")
                
                # 5. Run Generation (Blocking, run in executor)
                
                # Phase 10: Set Seed (Moved to outer scope)
                seed_to_use = request.seed
                if seed_to_use is None:
                    # Fallback if not passed (though we should have it)
                    import random
                    seed_to_use = random.randint(0, 2**32 - 1)
                
                # Note: heartlib's pipeline is not async, so we wrap it
                loop = asyncio.get_running_loop()
                
                # Progress Callback for Pipeline
                def _pipeline_callback(progress, msg):
                    # Suppress MPS autocast warning spam if mostly benign (it just disables autocast for unsupported ops)
                    import warnings
                    warnings.filterwarnings("ignore", message="In MPS autocast, but the target dtype is not supported")

                    loop.call_soon_threadsafe(
                        event_manager.publish, 
                        "job_progress", 
                        {"job_id": str(job_id), "progress": progress, "msg": msg}
                    )

                def _run_pipeline():
                    # Set fallback for MPS conv1d limit just in case
                    os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"
                    
                    # Logic: 
                    # request.tags -> Sound Description (e.g. "Afrobeat") -> Heartlib 'tags'
                    # request.prompt -> User's Concept (e.g. "Song about rain") -> Not used by Heartlib generation, just for history/title
                    
                    # If user didn't provide sound tags, use the prompt as a fallback tag
                    sound_tags = request.tags if request.tags and request.tags.strip() else "pop music"

                    # Phase 9: Load History Tokens if extending
                    history_tokens = None
                    if request.parent_job_id:
                        try:
                            parent_token_path = os.path.join(os.getcwd(), "backend", "generated_tokens", f"{request.parent_job_id}.pt")
                            if os.path.exists(parent_token_path):
                                logger.info(f"Loading history tokens from {parent_token_path}")
                                history_tokens = torch.load(parent_token_path, map_location=self.device)
                                # Ensure correct shape/device if needed
                                if history_tokens.device != self.device:
                                     history_tokens = history_tokens.to(self.device)
                            else:
                                logger.warning(f"Parent token file not found: {parent_token_path}")
                        except Exception as e:
                            logger.error(f"Failed to load history tokens: {e}")

                    logger.info(f"Setting random seed to {seed_to_use}")
                    torch.manual_seed(seed_to_use)
                    if torch.cuda.is_available():
                        torch.cuda.manual_seed_all(seed_to_use)
                    import random
                    random.seed(seed_to_use)
                    import numpy as np
                    np.random.seed(seed_to_use)



                    # Resolve reference audio path if provided
                    ref_audio_path = None
                    muq_segment_sec = 60.0  # Default to 60 seconds
                    print(f"[DEBUG] Ref audio ID from request: {request.ref_audio_id}", flush=True)
                    if request.ref_audio_id:
                        ref_audio_dir = os.path.join(os.getcwd(), "backend", "ref_audio")
                        for ext in [".mp3", ".wav", ".flac", ".ogg"]:
                            candidate = os.path.join(ref_audio_dir, f"{request.ref_audio_id}{ext}")
                            if os.path.exists(candidate):
                                ref_audio_path = candidate
                                logger.info(f"Using reference audio: {ref_audio_path}")
                                # Get audio duration and calculate muq_segment_sec based on style_influence
                                # The model was trained with ~10 second segments (PR #28 default)
                                try:
                                    info = torchaudio.info(ref_audio_path)
                                    audio_duration_sec = info.num_frames / info.sample_rate
                                    # style_influence controls segment length: 100% = 10s (trained default)
                                    # Higher values give stronger style transfer
                                    max_segment_sec = 10.0  # Model's trained default
                                    muq_segment_sec = (request.style_influence / 100.0) * max_segment_sec
                                    muq_segment_sec = min(muq_segment_sec, audio_duration_sec)  # Don't exceed audio length
                                    muq_segment_sec = max(1.0, muq_segment_sec)  # Minimum 1 second
                                    print(f"[DEBUG] Audio duration: {audio_duration_sec:.1f}s, style_influence: {request.style_influence}%, muq_segment_sec: {muq_segment_sec:.1f}s", flush=True)
                                except Exception as e:
                                    logger.warning(f"Could not get audio duration: {e}, using default 10s")
                                    muq_segment_sec = 10.0
                                break

                    with torch.no_grad():
                        pipeline_inputs = {
                            "lyrics": request.lyrics,
                            "tags": sound_tags,
                        }
                        # Add reference audio if available
                        if ref_audio_path:
                            pipeline_inputs["ref_audio"] = ref_audio_path
                            pipeline_inputs["muq_segment_sec"] = muq_segment_sec
                            # Allow user to pick specific portion of reference audio
                            if request.ref_audio_start_sec is not None:
                                pipeline_inputs["ref_audio_start_sec"] = request.ref_audio_start_sec
                                print(f"[DEBUG] Passing ref_audio to pipeline: {ref_audio_path}, muq_segment_sec: {muq_segment_sec}, start_sec: {request.ref_audio_start_sec}", flush=True)
                            else:
                                print(f"[DEBUG] Passing ref_audio to pipeline: {ref_audio_path}, muq_segment_sec: {muq_segment_sec} (using middle)", flush=True)
                        else:
                            print(f"[DEBUG] No ref_audio_path found", flush=True)

                        output = self.pipeline(
                            pipeline_inputs,
                            max_audio_length_ms=request.duration_ms,
                            save_path=save_path,
                            topk=request.topk,
                            temperature=request.temperature,
                            cfg_scale=request.cfg_scale,
                            callback=_pipeline_callback,  # Pass our new callback
                            abort_event=abort_event,      # Pass cancellation signal
                            history_tokens=history_tokens, # Phase 9
                        )
                        
                        # Save tokens if returned (Phase 9)
                        if output is not None and "tokens" in output and output["tokens"] is not None:
                            try:
                                tokens_dir = os.path.join(os.getcwd(), "backend", "generated_tokens")
                                os.makedirs(tokens_dir, exist_ok=True)
                                token_path = os.path.join(tokens_dir, f"{job_id}.pt")
                                torch.save(output["tokens"], token_path)
                                logger.info(f"Saved tokens to {token_path}")
                                
                                # Update Job with token path (Requires DB schema update or just implicit knowledge)
                                # For now, we assume implicit path based on ID, but ideally we add to DB.
                                # Let's update the job object later in the session block.
                            except Exception as e:
                                logger.error(f"Failed to save tokens: {e}")
                    
                    return output
                
                # Notify Start
                event_manager.publish("job_update", {"job_id": str(job_id), "status": "processing"})
                event_manager.publish("job_progress", {"job_id": str(job_id), "progress": 0, "msg": "Starting generation pipeline..."})

                # output variable capture
                output = await loop.run_in_executor(None, _run_pipeline)

                # 6. Update status to COMPLETED
                with Session(db_engine) as session:
                    # Re-fetch to avoid stale object
                    job = session.exec(select(Job).where(Job.id == job_id)).one_or_none()
                    if not job:
                         logger.warning(f"Job {job_id} was deleted during generation. Discarding result.")
                         return

                    job.status = JobStatus.COMPLETED
                    job.audio_path = f"/audio/{output_filename}"
                    job.title = auto_title
                    job.seed = seed_to_use # Ensure saved
                    session.add(job)
                    session.commit()
                    # Extract values while attached to session
                    final_audio_path = job.audio_path
                    final_title = job.title
                
                logger.info(f"Job {job_id} completed. Saved to {save_path}")
                event_manager.publish("job_update", {"job_id": str(job_id), "status": "completed", "audio_path": final_audio_path, "title": final_title})
                event_manager.publish("job_progress", {"job_id": str(job_id), "progress": 100, "msg": "Done!"})

            except Exception as e:
                logger.error(f"Job {job_id} failed: {e}")
                with Session(db_engine) as session:
                    job = session.exec(select(Job).where(Job.id == job_id)).one()
                    job.status = JobStatus.FAILED
                    job.error_msg = str(e)
                    session.add(job)
                    session.commit()
                event_manager.publish("job_update", {"job_id": str(job_id), "status": "failed", "error": str(e)})

            finally:
                # Cleanup cancellation event
                if job_id in self.active_jobs:
                    del self.active_jobs[job_id]

                # Aggressive GPU memory cleanup after each generation
                try:
                    if self.pipeline and hasattr(self.pipeline, 'heartmula'):
                        self.pipeline.heartmula.reset_caches()
                    gc.collect()
                    if torch.cuda.is_available():
                        torch.cuda.empty_cache()
                        torch.cuda.synchronize()
                    logger.info("GPU memory cleaned up after generation")
                except Exception as cleanup_err:
                    logger.warning(f"Memory cleanup warning: {cleanup_err}")

    def cancel_job(self, job_id: str):
        # Check if job is in queue (waiting)
        if job_id in self.job_queue:
            logger.info(f"Removing queued job {job_id}")
            self.job_queue.remove(job_id)
            self._broadcast_queue_update()
            return True
        # Check if job is actively processing
        if job_id in self.active_jobs:
            logger.info(f"Cancelling active job {job_id}")
            self.active_jobs[job_id].set()
            return True
        return False

    def shutdown_all(self):
        """Cancel all active jobs."""
        logger.info(f"Shutting down MusicService. Cancelling {len(self.active_jobs)} active jobs.")
        for job_id, event in list(self.active_jobs.items()):
            event.set()


class EventManager:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(EventManager, cls).__new__(cls)
            cls._instance.subscribers = []
        return cls._instance

    def subscribe(self):
        q = asyncio.Queue()
        self.subscribers.append(q)
        return q

    def unsubscribe(self, q):
        if q in self.subscribers:
            self.subscribers.remove(q)

    def publish(self, event_type: str, data: dict):
        import json
        msg = f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
        for q in self.subscribers:
            try:
                q.put_nowait(msg)
            except asyncio.QueueFull:
                pass

    def shutdown(self):
        """Broadcast shutdown signal to all subscribers to release connections."""
        msg = "event: shutdown\ndata: {}\n\n"
        for q in self.subscribers:
             try:
                q.put_nowait(msg)
             except asyncio.QueueFull:
                pass


music_service = MusicService()
event_manager = EventManager()
