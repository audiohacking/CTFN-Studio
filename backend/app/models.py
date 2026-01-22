from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4
from sqlmodel import Field, SQLModel
from enum import Enum

class JobStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class Job(SQLModel, table=True):
    id: Optional[UUID] = Field(default_factory=uuid4, primary_key=True)
    status: JobStatus = Field(default=JobStatus.QUEUED)
    title: Optional[str] = None
    prompt: str
    lyrics: Optional[str] = None
    tags: Optional[str] = None  # Added field for Style/Tags
    seed: Optional[int] = None # Added for Seed Consistency
    audio_path: Optional[str] = None
    duration_ms: int = 240000
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    error_msg: Optional[str] = None

class GenerationRequest(SQLModel):
    model_config = {"protected_namespaces": ()}
    prompt: str
    lyrics: Optional[str] = None
    duration_ms: int = 30000
    temperature: float = 1.0
    cfg_scale: float = 1.5
    topk: int = 50
    tags: Optional[str] = None
    seed: Optional[int] = None # Added for Seed Consistency
    llm_model: Optional[str] = None # specific LLM usage for title/lyrics
    parent_job_id: Optional[str] = None # For Track Extension (Phase 9)
    ref_audio_id: Optional[str] = None # Reference audio file ID for style conditioning
    style_influence: float = 100.0 # Style influence (0-100%, controls muq_segment_sec)
    ref_audio_start_sec: Optional[float] = None # Start time in seconds for reference audio segment (None = use middle)

class LyricsRequest(SQLModel):
    model_config = {"protected_namespaces": ()}
    topic: str
    model_name: str = "llama3"
    seed_lyrics: Optional[str] = None
    provider: str = "ollama"
    language: str = "English"

class EnhancePromptRequest(SQLModel):
    model_config = {"protected_namespaces": ()}
    concept: str
    model_name: str = "llama3"
    provider: str = "ollama"

class InspirationRequest(SQLModel):
    model_config = {"protected_namespaces": ()}
    model_name: str = "llama3"
    provider: str = "ollama"


# Liked Songs (Favorites)
class LikedSong(SQLModel, table=True):
    id: Optional[UUID] = Field(default_factory=uuid4, primary_key=True)
    job_id: UUID = Field(index=True)
    liked_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Playlists
class Playlist(SQLModel, table=True):
    id: Optional[UUID] = Field(default_factory=uuid4, primary_key=True)
    name: str
    description: Optional[str] = None
    cover_seed: Optional[str] = None  # For procedural cover generation
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Playlist Songs (Many-to-Many)
class PlaylistSong(SQLModel, table=True):
    id: Optional[UUID] = Field(default_factory=uuid4, primary_key=True)
    playlist_id: UUID = Field(index=True)
    job_id: UUID = Field(index=True)
    position: int = 0  # Order in playlist
    added_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Request/Response Models
class CreatePlaylistRequest(SQLModel):
    name: str
    description: Optional[str] = None


class UpdatePlaylistRequest(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None


class AddToPlaylistRequest(SQLModel):
    job_id: str
