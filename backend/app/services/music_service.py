import asyncio
import os
import gc
import torch
import torchaudio
import logging
from typing import Optional, Callable
from tqdm import tqdm
from backend.app.models import GenerationRequest, Job, JobStatus
from sqlmodel import Session, select
from heartlib.pipelines.music_generation import HeartMuLaGenPipeline, HeartMuLaGenConfig
from heartlib.heartmula.modeling_heartmula import HeartMuLa
from heartlib.heartcodec.modeling_heartcodec import HeartCodec
from tokenizers import Tokenizer

logger = logging.getLogger(__name__)


def configure_flash_attention_for_gpu(device_id: int):
    """
    Configure Flash Attention based on GPU compute capability.
    Flash Attention / CUTLASS requires SM 7.0+ (Volta and newer).
    Older GPUs (Pascal, Maxwell, etc.) need the math backend.

    This is safe for all users:
    - CPU-only: Returns early, no CUDA settings modified
    - MPS (Apple Silicon): Returns early, not applicable
    - NVIDIA SM 7.0+: Enables Flash Attention for speed
    - NVIDIA SM 6.x and older: Disables Flash Attention, uses math backend
    - AMD ROCm: Conservatively disables Flash Attention (compatibility varies)
    """
    if not torch.cuda.is_available():
        logger.info("[GPU Config] CUDA not available - skipping Flash Attention configuration")
        return

    try:
        props = torch.cuda.get_device_properties(device_id)
        gpu_name = props.name.lower()
        compute_cap = props.major + props.minor / 10

        # Check for AMD ROCm GPUs (they report as CUDA but may not support Flash Attention)
        is_amd = any(x in gpu_name for x in ['gfx', 'amd', 'radeon', 'instinct'])

        if is_amd:
            # AMD GPUs: Conservatively disable Flash Attention
            torch.backends.cuda.enable_flash_sdp(False)
            torch.backends.cuda.enable_mem_efficient_sdp(False)
            logger.info(f"[GPU Config] Flash Attention DISABLED for AMD GPU: {props.name} - using math backend")
            print(f"[GPU Config] Flash Attention DISABLED for AMD GPU: {props.name} - using math backend", flush=True)
        elif compute_cap >= 7.0:
            # NVIDIA SM 7.0+ (Volta, Turing, Ampere, Ada, Hopper) - enable Flash Attention
            torch.backends.cuda.enable_flash_sdp(True)
            torch.backends.cuda.enable_mem_efficient_sdp(True)
            logger.info(f"[GPU Config] Flash Attention ENABLED for {props.name} (SM {props.major}.{props.minor})")
            print(f"[GPU Config] Flash Attention ENABLED for {props.name} (SM {props.major}.{props.minor})", flush=True)
        else:
            # Older NVIDIA GPUs (Pascal SM 6.x, Maxwell SM 5.x, etc.) - use math backend
            torch.backends.cuda.enable_flash_sdp(False)
            torch.backends.cuda.enable_mem_efficient_sdp(False)
            logger.info(f"[GPU Config] Flash Attention DISABLED for {props.name} (SM {props.major}.{props.minor}) - using math backend")
            print(f"[GPU Config] Flash Attention DISABLED for {props.name} (SM {props.major}.{props.minor}) - using math backend", flush=True)

    except Exception as e:
        # If anything goes wrong, disable Flash Attention for safety
        logger.warning(f"[GPU Config] Error detecting GPU capabilities: {e}. Disabling Flash Attention for safety.")
        print(f"[GPU Config] Error detecting GPU: {e}. Disabling Flash Attention for safety.", flush=True)
        try:
            torch.backends.cuda.enable_flash_sdp(False)
            torch.backends.cuda.enable_mem_efficient_sdp(False)
        except Exception:
            pass


def patch_pipeline_with_callback(pipeline: HeartMuLaGenPipeline):
    """
    Monkey-patch the HeartMuLa pipeline to support progress callbacks.
    This allows us to report generation progress without modifying upstream heartlib.
    """
    original_forward = pipeline._forward

    def patched_forward(model_inputs, max_audio_length_ms, temperature, topk, cfg_scale,
                        callback: Optional[Callable] = None, **kwargs):
        """Patched _forward method that supports progress callback."""
        prompt_tokens = model_inputs["tokens"].to(pipeline.mula_device)
        prompt_tokens_mask = model_inputs["tokens_mask"].to(pipeline.mula_device)
        continuous_segment = model_inputs["muq_embed"].to(pipeline.mula_device)
        starts = model_inputs["muq_idx"]
        prompt_pos = model_inputs["pos"].to(pipeline.mula_device)
        frames = []

        bs_size = 2 if cfg_scale != 1.0 else 1
        pipeline.mula.setup_caches(bs_size)

        with torch.autocast(device_type=pipeline.mula_device.type, dtype=pipeline.mula_dtype):
            curr_token = pipeline.mula.generate_frame(
                tokens=prompt_tokens,
                tokens_mask=prompt_tokens_mask,
                input_pos=prompt_pos,
                temperature=temperature,
                topk=topk,
                cfg_scale=cfg_scale,
                continuous_segments=continuous_segment,
                starts=starts,
            )
        frames.append(curr_token[0:1,])

        def _pad_audio_token(token):
            padded_token = (
                torch.ones(
                    (token.shape[0], pipeline._parallel_number),
                    device=token.device,
                    dtype=torch.long,
                )
                * pipeline.config.empty_id
            )
            padded_token[:, :-1] = token
            padded_token = padded_token.unsqueeze(1)
            padded_token_mask = torch.ones_like(
                padded_token, device=token.device, dtype=torch.bool
            )
            padded_token_mask[..., -1] = False
            return padded_token, padded_token_mask

        max_audio_frames = max_audio_length_ms // 80

        for i in tqdm(range(max_audio_frames), desc="Generating audio"):
            curr_token, curr_token_mask = _pad_audio_token(curr_token)
            with torch.autocast(device_type=pipeline.mula_device.type, dtype=pipeline.mula_dtype):
                curr_token = pipeline.mula.generate_frame(
                    tokens=curr_token,
                    tokens_mask=curr_token_mask,
                    input_pos=prompt_pos[..., -1:] + i + 1,
                    temperature=temperature,
                    topk=topk,
                    cfg_scale=cfg_scale,
                    continuous_segments=None,
                    starts=None,
                )
            if torch.any(curr_token[0:1, :] >= pipeline.config.audio_eos_id):
                break
            frames.append(curr_token[0:1,])

            # Report progress via callback
            if callback is not None:
                progress = int((i + 1) / max_audio_frames * 100)
                callback(progress, f"Generating audio... {i + 1}/{max_audio_frames} frames")

        frames = torch.stack(frames).permute(1, 2, 0).squeeze(0)
        pipeline._unload()
        return {"frames": frames}

    # Replace the method
    pipeline._forward = patched_forward

    # Also patch __call__ to pass callback through
    original_call = pipeline.__call__

    def patched_call(inputs, callback=None, **kwargs):
        preprocess_kwargs = {"cfg_scale": kwargs.get("cfg_scale", 1.5)}
        forward_kwargs = {
            "max_audio_length_ms": kwargs.get("max_audio_length_ms", 120_000),
            "temperature": kwargs.get("temperature", 1.0),
            "topk": kwargs.get("topk", 50),
            "cfg_scale": kwargs.get("cfg_scale", 1.5),
            "callback": callback,
        }
        postprocess_kwargs = {
            "save_path": kwargs.get("save_path", "output.mp3"),
        }

        model_inputs = pipeline.preprocess(inputs, **preprocess_kwargs)
        model_outputs = pipeline._forward(model_inputs, **forward_kwargs)
        pipeline.postprocess(model_outputs, **postprocess_kwargs)

    pipeline.__call__ = patched_call

    logger.info("[Pipeline] Patched HeartMuLa pipeline with callback support")
    print("[Pipeline] Patched HeartMuLa pipeline with callback support", flush=True)
    return pipeline


def cleanup_gpu_memory():
    """Clean up GPU memory before loading models."""
    gc.collect()
    if torch.cuda.is_available():
        for i in range(torch.cuda.device_count()):
            with torch.cuda.device(i):
                torch.cuda.empty_cache()
                torch.cuda.synchronize()
        logger.info("GPU memory cleaned up")


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
            cls._instance.active_jobs = {}  # Map job_id -> threading.Event
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

    def _load_pipeline_multi_gpu(self, model_path: str, version: str):
        """Load pipeline with multi-GPU support using new dict-based device/dtype API."""
        num_gpus = torch.cuda.device_count()

        if num_gpus < 2:
            logger.info(f"Found {num_gpus} GPU(s). Using single GPU mode with lazy loading...")
            self.gpu_mode = "single"

            # Configure Flash Attention for the GPU
            configure_flash_attention_for_gpu(0)

            # Single GPU: Use lazy loading - codec stays on CPU until decode time
            pipeline = HeartMuLaGenPipeline.from_pretrained(
                model_path,
                device={
                    "mula": torch.device("cuda"),
                    "codec": torch.device("cpu"),
                },
                dtype={
                    "mula": torch.bfloat16,
                    "codec": torch.float32,
                },
                version=version,
                lazy_load=True,
            )
            return patch_pipeline_with_callback(pipeline)

        # Multi-GPU setup
        logger.info(f"Found {num_gpus} GPUs:")
        gpu_memories = {}
        for i in range(num_gpus):
            mem = get_gpu_memory(i)
            gpu_memories[i] = mem
            logger.info(f"  GPU {i}: {torch.cuda.get_device_name(i)} ({mem:.1f} GB)")

        # Put HeartMuLa on larger GPU (needs more VRAM), HeartCodec on smaller GPU
        mula_gpu = max(gpu_memories, key=gpu_memories.get)
        codec_gpu = min(gpu_memories, key=gpu_memories.get)

        print(f"[GPU Setup] HeartMuLa -> GPU {mula_gpu} ({gpu_memories[mula_gpu]:.1f} GB)", flush=True)
        print(f"[GPU Setup] HeartCodec -> GPU {codec_gpu} ({gpu_memories[codec_gpu]:.1f} GB)", flush=True)

        # Configure Flash Attention based on the GPU running HeartMuLa
        configure_flash_attention_for_gpu(mula_gpu)

        self.gpu_mode = "multi"

        pipeline = HeartMuLaGenPipeline.from_pretrained(
            model_path,
            device={
                "mula": torch.device(f"cuda:{mula_gpu}"),
                "codec": torch.device(f"cuda:{codec_gpu}"),
            },
            dtype={
                "mula": torch.bfloat16,
                "codec": torch.float32,
            },
            version=version,
        )
        return patch_pipeline_with_callback(pipeline)

    async def initialize(self, model_path: str = "HeartMuLa", version: str = "3B"):
        if self.pipeline is not None or self.is_loading:
            return

        self.is_loading = True

        # Clean up GPU memory before loading
        logger.info("Cleaning up GPU memory before loading...")
        cleanup_gpu_memory()

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
        from uuid import UUID as PyUUID
        job_id_str = str(job_id)  # String for dictionary keys
        job_id_uuid = PyUUID(job_id_str) if isinstance(job_id, str) else job_id  # UUID for DB queries

        # Add to queue and broadcast position
        self.job_queue.append(job_id_str)
        queue_pos = self.get_queue_position(job_id_str)
        logger.info(f"Job {job_id_str} added to queue at position {queue_pos}")
        event_manager.publish("job_queued", {"job_id": job_id_str, "position": queue_pos, "total": len(self.job_queue)})
        self._broadcast_queue_update()

        # 1. Acquire GPU Lock (will wait if another job is processing)
        async with self.gpu_lock:
            # Remove from queue now that we have the lock
            if job_id_str in self.job_queue:
                self.job_queue.remove(job_id_str)
                self._broadcast_queue_update()  # Update remaining jobs' positions

            logger.info(f"Starting generation for job {job_id_str}")

            # 2. Update status to PROCESSING
            try:
                with Session(db_engine) as session:
                    # check if job still exists
                    job = session.exec(select(Job).where(Job.id == job_id_uuid)).one_or_none()
                    if not job:
                        logger.warning(f"Job {job_id_str} was deleted before processing started. Aborting.")
                        return

                    job.status = JobStatus.PROCESSING
                    session.add(job)
                    session.commit()
                    logger.info(f"Job {job_id_str} status updated to PROCESSING")
            except Exception as e:
                logger.error(f"Failed to update job status to PROCESSING: {e}")
                return

            try:
                # 3. Create unique filename
                output_filename = f"song_{job_id_str}.mp3"
                save_path = os.path.abspath(f"backend/generated_audio/{output_filename}")

                # Create Cancellation Event
                import threading
                abort_event = threading.Event()
                self.active_jobs[job_id_str] = abort_event

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

                # Set Seed
                seed_to_use = request.seed
                if seed_to_use is None:
                    import random
                    seed_to_use = random.randint(0, 2**32 - 1)

                # Note: heartlib's pipeline is not async, so we wrap it
                loop = asyncio.get_running_loop()

                # Progress Callback for Pipeline
                def _pipeline_callback(progress, msg):
                    import warnings
                    warnings.filterwarnings("ignore", message="In MPS autocast, but the target dtype is not supported")

                    loop.call_soon_threadsafe(
                        event_manager.publish,
                        "job_progress",
                        {"job_id": job_id_str, "progress": progress, "msg": msg}
                    )

                def _run_pipeline():
                    os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"

                    sound_tags = request.tags if request.tags and request.tags.strip() else "pop music"

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
                    muq_segment_sec = 60.0
                    print(f"[DEBUG] Ref audio ID from request: {request.ref_audio_id}", flush=True)
                    if request.ref_audio_id:
                        ref_audio_dir = os.path.join(os.getcwd(), "backend", "ref_audio")
                        for ext in [".mp3", ".wav", ".flac", ".ogg"]:
                            candidate = os.path.join(ref_audio_dir, f"{request.ref_audio_id}{ext}")
                            if os.path.exists(candidate):
                                ref_audio_path = candidate
                                logger.info(f"Using reference audio: {ref_audio_path}")
                                try:
                                    info = torchaudio.info(ref_audio_path)
                                    audio_duration_sec = info.num_frames / info.sample_rate
                                    max_segment_sec = 10.0
                                    muq_segment_sec = (request.style_influence / 100.0) * max_segment_sec
                                    muq_segment_sec = min(muq_segment_sec, audio_duration_sec)
                                    muq_segment_sec = max(1.0, muq_segment_sec)
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
                        if ref_audio_path:
                            pipeline_inputs["ref_audio"] = ref_audio_path
                            pipeline_inputs["muq_segment_sec"] = muq_segment_sec
                            if request.ref_audio_start_sec is not None:
                                pipeline_inputs["ref_audio_start_sec"] = request.ref_audio_start_sec
                        else:
                            print(f"[DEBUG] No ref_audio_path found", flush=True)

                        if request.negative_tags:
                            pipeline_inputs["negative_tags"] = request.negative_tags
                            print(f"[DEBUG] Using negative_tags: {request.negative_tags}", flush=True)

                        self.pipeline(
                            pipeline_inputs,
                            max_audio_length_ms=request.duration_ms,
                            save_path=save_path,
                            topk=request.topk,
                            temperature=request.temperature,
                            cfg_scale=request.cfg_scale,
                            callback=_pipeline_callback,
                        )

                    return None

                # Notify Start
                event_manager.publish("job_update", {"job_id": job_id_str, "status": "processing"})
                event_manager.publish("job_progress", {"job_id": job_id_str, "progress": 0, "msg": "Starting generation pipeline..."})

                await loop.run_in_executor(None, _run_pipeline)

                # 6. Update status to COMPLETED
                with Session(db_engine) as session:
                    job = session.exec(select(Job).where(Job.id == job_id_uuid)).one_or_none()
                    if not job:
                        logger.warning(f"Job {job_id_str} was deleted during generation. Discarding result.")
                        return

                    job.status = JobStatus.COMPLETED
                    job.audio_path = f"/audio/{output_filename}"
                    job.title = auto_title
                    job.seed = seed_to_use
                    session.add(job)
                    session.commit()
                    final_audio_path = job.audio_path
                    final_title = job.title

                logger.info(f"Job {job_id_str} completed. Saved to {save_path}")
                event_manager.publish("job_update", {"job_id": job_id_str, "status": "completed", "audio_path": final_audio_path, "title": final_title})
                event_manager.publish("job_progress", {"job_id": job_id_str, "progress": 100, "msg": "Done!"})

            except Exception as e:
                logger.error(f"Job {job_id_str} failed: {e}")
                import traceback
                traceback.print_exc()
                with Session(db_engine) as session:
                    job = session.exec(select(Job).where(Job.id == job_id_uuid)).one()
                    job.status = JobStatus.FAILED
                    job.error_msg = str(e)
                    session.add(job)
                    session.commit()
                event_manager.publish("job_update", {"job_id": job_id_str, "status": "failed", "error": str(e)})

            finally:
                # Cleanup cancellation event
                if job_id_str in self.active_jobs:
                    del self.active_jobs[job_id_str]

                # Aggressive GPU memory cleanup after each generation
                try:
                    if self.pipeline and hasattr(self.pipeline, 'mula'):
                        self.pipeline.mula.reset_caches()
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
