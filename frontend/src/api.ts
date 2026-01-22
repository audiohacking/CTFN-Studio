import axios from 'axios';

// Use the same host as the frontend (works for both localhost and LAN access)
const API_BASE_URL = `http://${window.location.hostname}:8000`;

export interface Job {
    id: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    title?: string;
    prompt: string;
    lyrics?: string;
    tags?: string;
    audio_path?: string;
    error_msg?: string;
    created_at: string;
    duration_ms?: number;
    seed?: number;
}

export interface LLMModel {
    id: string;
    name: string;
    provider: 'ollama' | 'openrouter';
}

export interface Playlist {
    id: string;
    name: string;
    description?: string;
    cover_seed?: string;
    song_count: number;
    created_at: string;
    updated_at: string;
}

export interface PlaylistWithSongs extends Playlist {
    songs: {
        job: Job;
        position: number;
        added_at: string;
    }[];
}

export const api = {
    checkHealth: async () => {
        const res = await axios.get(`${API_BASE_URL}/health`);
        return res.data;
    },

    getLyricsModels: async (): Promise<LLMModel[]> => {
        const res = await axios.get(`${API_BASE_URL}/models/lyrics`);
        return res.data.models;
    },

    getLanguages: async (): Promise<string[]> => {
        const res = await axios.get(`${API_BASE_URL}/languages`);
        return res.data.languages;
    },

    generateJob: async (
        prompt: string,
        durationMs: number,
        lyrics?: string,
        tags?: string,
        cfg_scale: number = 1.5,
        parentJobId?: string,
        seed?: number,
        refAudioId?: string,
        styleInfluence: number = 100.0,
        refAudioStartSec?: number
    ) => {
        const res = await axios.post(`${API_BASE_URL}/generate/music`, {
            prompt,
            duration_ms: durationMs,
            lyrics,
            tags,
            cfg_scale,
            parent_job_id: parentJobId,
            seed,
            ref_audio_id: refAudioId,
            style_influence: styleInfluence,
            ref_audio_start_sec: refAudioStartSec
        });
        return res.data;
    },

    generateLyrics: async (topic: string, modelId: string, provider: string, currentLyrics?: string, language: string = "English") => {
        const res = await axios.post(`${API_BASE_URL}/generate/lyrics`, {
            topic,
            model_name: modelId,
            provider,
            seed_lyrics: currentLyrics,
            language
        });
        return {
            lyrics: res.data.lyrics,
            suggested_topic: res.data.suggested_topic,
            suggested_tags: res.data.suggested_tags
        };
    },

    enhancePrompt: async (concept: string, modelId: string, provider: string) => {
        const res = await axios.post(`${API_BASE_URL}/generate/enhance_prompt`, {
            concept,
            model_name: modelId,
            provider
        });
        return res.data;
    },

    getInspiration: async (modelId: string, provider: string) => {
        const res = await axios.post(`${API_BASE_URL}/generate/evaluate_inspiration`, {
            model_name: modelId,
            provider
        });
        return res.data;
    },

    getStylePresets: async (modelId: string) => {
        const res = await axios.post(`${API_BASE_URL}/generate/styles`, {
            model_name: modelId
        });
        return res.data.styles;
    },

    generateMusic: async (
        tags: string,
        lyrics: string,
        durationMs: number = 240000,
        temperature: number = 1.0,
        cfgScale: number = 1.5,
        topk: number = 50,
        prompt: string,
        llmModel: string = "llama3",
        refAudioId?: string
    ) => {
        const res = await axios.post(`${API_BASE_URL}/generate/music`, {
            lyrics,
            tags,
            duration_ms: durationMs,
            temperature,
            cfg_scale: cfgScale,
            topk,
            prompt,
            llm_model: llmModel,
            ref_audio_id: refAudioId
        });
        return res.data;
    },

    // ============== REFERENCE AUDIO ==============

    uploadRefAudio: async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        const res = await axios.post(`${API_BASE_URL}/upload/ref_audio`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return res.data as { id: string; filename: string; path: string; size: number };
    },

    deleteRefAudio: async (fileId: string) => {
        const res = await axios.delete(`${API_BASE_URL}/upload/ref_audio/${fileId}`);
        return res.data;
    },

    renameJob: async (jobId: string, title: string) => {
        const res = await axios.patch(`${API_BASE_URL}/jobs/${jobId}`, { title });
        return res.data;
    },

    deleteJob: async (jobId: string) => {
        const res = await axios.delete(`${API_BASE_URL}/jobs/${jobId}`);
        return res.data;
    },

    cancelJob: async (jobId: string) => {
        const res = await axios.post(`${API_BASE_URL}/jobs/${jobId}/cancel`);
        return res.data;
    },

    getJobStatus: async (jobId: string) => {
        const res = await axios.get<Job>(`${API_BASE_URL}/jobs/${jobId}`);
        return res.data;
    },

    getHistory: async () => {
        const res = await axios.get<Job[]>(`${API_BASE_URL}/history`);
        return res.data;
    },

    getAudioUrl: (path: string) => {
        return `${API_BASE_URL}${path}`;
    },

    getDownloadUrl: (jobId: string) => {
        return `${API_BASE_URL}/download_track/${jobId}`;
    },

    connectToEvents: (onMessage: (event: MessageEvent) => void) => {
        const eventSource = new EventSource(`${API_BASE_URL}/events`);
        eventSource.onmessage = onMessage;

        // Listen to all event types from backend
        eventSource.addEventListener("job_update", onMessage);
        eventSource.addEventListener("job_progress", onMessage);
        eventSource.addEventListener("job_queued", onMessage);
        eventSource.addEventListener("job_queue", onMessage);

        return eventSource;
    },

    // ============== LIKES (Favorites) ==============

    likeSong: async (jobId: string) => {
        const res = await axios.post(`${API_BASE_URL}/songs/${jobId}/like`);
        return res.data;
    },

    unlikeSong: async (jobId: string) => {
        const res = await axios.delete(`${API_BASE_URL}/songs/${jobId}/like`);
        return res.data;
    },

    getLikedSongs: async () => {
        const res = await axios.get(`${API_BASE_URL}/songs/liked`);
        return res.data as { songs: Job[]; liked_ids: string[] };
    },

    getLikedSongIds: async () => {
        const res = await axios.get(`${API_BASE_URL}/songs/liked/ids`);
        return res.data.liked_ids as string[];
    },

    // ============== PLAYLISTS ==============

    getPlaylists: async () => {
        const res = await axios.get(`${API_BASE_URL}/playlists`);
        return res.data.playlists as Playlist[];
    },

    createPlaylist: async (name: string, description?: string) => {
        const res = await axios.post(`${API_BASE_URL}/playlists`, { name, description });
        return res.data as Playlist;
    },

    getPlaylist: async (playlistId: string) => {
        const res = await axios.get(`${API_BASE_URL}/playlists/${playlistId}`);
        return res.data as PlaylistWithSongs;
    },

    updatePlaylist: async (playlistId: string, name?: string, description?: string) => {
        const res = await axios.patch(`${API_BASE_URL}/playlists/${playlistId}`, { name, description });
        return res.data;
    },

    deletePlaylist: async (playlistId: string) => {
        const res = await axios.delete(`${API_BASE_URL}/playlists/${playlistId}`);
        return res.data;
    },

    addSongToPlaylist: async (playlistId: string, jobId: string) => {
        const res = await axios.post(`${API_BASE_URL}/playlists/${playlistId}/songs`, { job_id: jobId });
        return res.data;
    },

    removeSongFromPlaylist: async (playlistId: string, jobId: string) => {
        const res = await axios.delete(`${API_BASE_URL}/playlists/${playlistId}/songs/${jobId}`);
        return res.data;
    }
};
