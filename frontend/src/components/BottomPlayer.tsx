import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Download, Repeat, Shuffle, Heart, ListPlus, X, FileAudio } from 'lucide-react';
import { api, type Job } from '../api';
import { AlbumCover } from './AlbumCover';

export interface PreviewAudio {
    url: string;
    filename: string;
    onClose: () => void;
}

export interface PreviewPlaybackState {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
}

interface BottomPlayerProps {
    currentTrack: Job | null;
    onNext?: () => void;
    onPrev?: () => void;
    darkMode?: boolean;
    onPlayStateChange?: (isPlaying: boolean) => void;
    pauseTrigger?: number; // Increment to trigger pause
    playTrigger?: number; // Increment to trigger play/resume
    isLiked?: boolean;
    onToggleLike?: () => void;
    onAddToPlaylist?: () => void;
    onTrackClick?: (track: Job) => void;
    previewAudio?: PreviewAudio | null; // Reference audio preview mode
    onPreviewPlaybackChange?: (state: PreviewPlaybackState) => void; // Report preview playback state
    previewSeekTo?: number; // Seek to this time (trigger on change)
    previewPlayPauseTrigger?: number; // Toggle play/pause (trigger on change)
}

export const BottomPlayer: React.FC<BottomPlayerProps> = ({
    currentTrack,
    onNext,
    onPrev,
    darkMode = false,
    onPlayStateChange,
    pauseTrigger,
    playTrigger,
    isLiked = false,
    onToggleLike,
    onAddToPlaylist,
    onTrackClick,
    previewAudio,
    onPreviewPlaybackChange,
    previewSeekTo,
    previewPlayPauseTrigger
}) => {
    // Determine if we're in preview mode
    const isPreviewMode = !!previewAudio;
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurfer = useRef<WaveSurfer | null>(null);
    const onNextRef = useRef(onNext);  // Ref to avoid stale closure
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isReady, setIsReady] = useState(false);

    // Keep onNext ref updated
    useEffect(() => {
        onNextRef.current = onNext;
    }, [onNext]);

    // Volume Persistence
    const [volume, setVolume] = useState(() => {
        const saved = localStorage.getItem('heartmula_volume');
        return saved ? parseFloat(saved) : 0.7;
    });
    const [isMuted, setIsMuted] = useState(false);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Initialize WaveSurfer (only once on mount)
    useEffect(() => {
        if (!containerRef.current) return;

        wavesurfer.current = WaveSurfer.create({
            container: containerRef.current,
            waveColor: 'rgba(148, 163, 184, 0.5)',
            progressColor: '#0891b2',
            cursorColor: 'transparent',
            barWidth: 2,
            barGap: 1,
            barRadius: 2,
            height: 40,
            normalize: true,
            backend: 'MediaElement',
        });

        wavesurfer.current.on('ready', () => {
            setDuration(wavesurfer.current?.getDuration() || 0);
            wavesurfer.current?.setVolume(isMuted ? 0 : volume);
            setIsReady(true);
        });

        wavesurfer.current.on('seeking', () => {
            setCurrentTime(wavesurfer.current?.getCurrentTime() || 0);
        });

        wavesurfer.current.on('finish', () => {
            setIsPlaying(false);
            // Auto-play next track when song ends
            if (onNextRef.current) {
                onNextRef.current();
            }
        });

        wavesurfer.current.on('play', () => setIsPlaying(true));
        wavesurfer.current.on('pause', () => setIsPlaying(false));

        return () => {
            try {
                wavesurfer.current?.destroy();
            } catch (e) {
                // Ignore cleanup errors
            }
        };
    }, []);

    // Update WaveSurfer colors when darkMode changes (without recreating instance)
    useEffect(() => {
        if (wavesurfer.current) {
            wavesurfer.current.setOptions({
                waveColor: darkMode ? 'rgba(100, 116, 139, 0.5)' : 'rgba(148, 163, 184, 0.5)',
                progressColor: darkMode ? '#22d3ee' : '#0891b2',
            });
        }
    }, [darkMode]);

    // Track if we should auto-play when ready
    const shouldAutoPlayRef = useRef(false);

    // Track the current audio source to detect changes
    const currentAudioSourceRef = useRef<string | null>(null);

    // Load new track or preview audio
    useEffect(() => {
        if (!wavesurfer.current) return;

        let audioUrl: string | null = null;
        let sourceId: string | null = null;

        if (previewAudio) {
            // Preview mode - use the preview audio URL
            audioUrl = previewAudio.url;
            sourceId = `preview:${previewAudio.url}`;
        } else if (currentTrack?.audio_path) {
            // Normal mode - use the track's audio path
            audioUrl = api.getAudioUrl(currentTrack.audio_path);
            sourceId = `track:${currentTrack.id}`;
        }

        // Only load if source changed
        if (audioUrl && sourceId !== currentAudioSourceRef.current) {
            setIsReady(false);
            setCurrentTime(0);
            setDuration(0);
            currentAudioSourceRef.current = sourceId;
            wavesurfer.current.load(audioUrl);
        }
    }, [currentTrack?.id, currentTrack?.audio_path, previewAudio?.url]);

    // Auto-play when track loads (only if triggered by playTrigger)
    useEffect(() => {
        if (isReady && wavesurfer.current && currentTrack && shouldAutoPlayRef.current) {
            wavesurfer.current.play();
            shouldAutoPlayRef.current = false;
        }
    }, [isReady, currentTrack?.id]);

    // Poll for current time while playing (audioprocess event is unreliable with MediaElement backend)
    useEffect(() => {
        if (!isPlaying) return;

        const interval = setInterval(() => {
            if (wavesurfer.current) {
                setCurrentTime(wavesurfer.current.getCurrentTime() || 0);
            }
        }, 250); // Update 4 times per second

        return () => clearInterval(interval);
    }, [isPlaying]);

    // Report play state changes to parent
    useEffect(() => {
        onPlayStateChange?.(isPlaying);
    }, [isPlaying, onPlayStateChange]);

    // Handle external pause request (trigger on pauseTrigger change)
    useEffect(() => {
        if (pauseTrigger && pauseTrigger > 0 && wavesurfer.current) {
            wavesurfer.current.pause();
        }
    }, [pauseTrigger]);

    // Handle external play request (trigger on playTrigger change)
    useEffect(() => {
        if (playTrigger && playTrigger > 0) {
            shouldAutoPlayRef.current = true;
            if (wavesurfer.current && isReady) {
                wavesurfer.current.play();
            }
        }
    }, [playTrigger]);

    // Report preview playback state to parent (for modal sync)
    useEffect(() => {
        if (isPreviewMode && onPreviewPlaybackChange) {
            onPreviewPlaybackChange({ isPlaying, currentTime, duration });
        }
    }, [isPreviewMode, isPlaying, currentTime, duration, onPreviewPlaybackChange]);

    // Handle preview seek command from modal
    const prevSeekRef = useRef<number | undefined>(undefined);
    useEffect(() => {
        if (isPreviewMode && previewSeekTo !== undefined && previewSeekTo !== prevSeekRef.current && wavesurfer.current && duration > 0) {
            prevSeekRef.current = previewSeekTo;
            wavesurfer.current.seekTo(previewSeekTo / duration);
        }
    }, [isPreviewMode, previewSeekTo, duration]);

    // Handle preview play/pause toggle from modal
    const prevPlayPauseTriggerRef = useRef<number | undefined>(undefined);
    useEffect(() => {
        if (isPreviewMode && previewPlayPauseTrigger !== undefined && previewPlayPauseTrigger !== prevPlayPauseTriggerRef.current && wavesurfer.current && isReady) {
            prevPlayPauseTriggerRef.current = previewPlayPauseTrigger;
            wavesurfer.current.playPause();
        }
    }, [isPreviewMode, previewPlayPauseTrigger, isReady]);

    const togglePlay = () => {
        if (wavesurfer.current && isReady) {
            wavesurfer.current.playPause();
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (wavesurfer.current) {
            wavesurfer.current.seekTo(time / duration);
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        setIsMuted(val === 0);
        if (wavesurfer.current) wavesurfer.current.setVolume(val);
        localStorage.setItem('heartmula_volume', val.toString());
    };

    const toggleMute = () => {
        const newMuted = !isMuted;
        setIsMuted(newMuted);
        if (wavesurfer.current) {
            wavesurfer.current.setVolume(newMuted ? 0 : volume);
        }
    };

    const downloadTrack = () => {
        if (currentTrack) {
            const downloadUrl = api.getDownloadUrl(currentTrack.id);
            window.location.href = downloadUrl;
        }
    };

    return (
        <div className={`fixed bottom-0 left-0 right-0 h-20 sm:h-24 border-t ${darkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white/95 border-slate-200 backdrop-blur-xl'} z-50`}>
            {/* Hidden WaveSurfer container - always mounted */}
            <div ref={containerRef} className="absolute opacity-0 pointer-events-none w-full h-10" />

            {/* No track selected and no preview */}
            {!currentTrack && !previewAudio ? (
                <div className="h-full flex items-center justify-center">
                    <p className={`text-sm font-mono ${darkMode ? 'text-[#727272]' : 'text-slate-400'}`}>
                        Select a track to play
                    </p>
                </div>
            ) : (
                <div className="h-full max-w-screen-2xl mx-auto px-2 sm:px-4 flex items-center gap-2 sm:gap-4">
                    {/* Track Info - Left */}
                    <div className="flex items-center gap-2 sm:gap-3 w-auto sm:w-72 min-w-0 shrink-0">
                        {isPreviewMode ? (
                            <>
                                {/* Preview Mode: Reference Audio Icon */}
                                <div className={`shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-md flex items-center justify-center ${
                                    darkMode ? 'bg-[#1DB954]/20' : 'bg-cyan-100'
                                }`}>
                                    <FileAudio className={`w-6 h-6 ${darkMode ? 'text-[#1DB954]' : 'text-cyan-600'}`} />
                                </div>
                                <div className="min-w-0 flex-1 text-left max-w-[120px] sm:max-w-none">
                                    <div className="flex items-center gap-1.5">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                            darkMode ? 'bg-[#1DB954]/20 text-[#1DB954]' : 'bg-cyan-100 text-cyan-700'
                                        }`}>
                                            PREVIEW
                                        </span>
                                    </div>
                                    <p className={`text-xs sm:text-sm font-medium truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                        {previewAudio?.filename || 'Reference Audio'}
                                    </p>
                                    <p className={`text-[10px] sm:text-xs truncate hidden sm:block ${darkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
                                        Style Reference
                                    </p>
                                </div>
                                {/* Close preview button */}
                                <button
                                    onClick={previewAudio?.onClose}
                                    className={`p-2 rounded-full transition-colors ${
                                        darkMode ? 'text-[#b3b3b3] hover:text-white hover:bg-[#282828]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                    }`}
                                    title="Close preview"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </>
                        ) : currentTrack ? (
                            <>
                                {/* Normal Mode: Album Art - Clickable */}
                                <button
                                    onClick={() => onTrackClick?.(currentTrack)}
                                    className="shrink-0 rounded-md overflow-hidden hover:opacity-80 transition-opacity"
                                >
                                    <AlbumCover seed={currentTrack.id} size="lg" className="w-12 h-12 sm:w-14 sm:h-14" />
                                </button>
                                <button
                                    onClick={() => onTrackClick?.(currentTrack)}
                                    className="min-w-0 flex-1 text-left max-w-[120px] sm:max-w-none"
                                >
                                    <p className={`text-xs sm:text-sm font-medium truncate ${darkMode ? 'text-white hover:underline cursor-pointer' : 'text-slate-900 hover:underline cursor-pointer'}`}>
                                        {currentTrack.title || currentTrack.prompt || 'Untitled'}
                                    </p>
                                    <p className={`text-[10px] sm:text-xs truncate hidden sm:block ${darkMode ? 'text-[#b3b3b3] hover:text-white hover:underline cursor-pointer' : 'text-slate-500 hover:text-slate-700 hover:underline cursor-pointer'}`}>
                                        {currentTrack.tags || 'AI Generated'}
                                    </p>
                                </button>
                                {/* Like Button - Always visible, Playlist hidden on mobile */}
                                <div className="hidden sm:flex items-center gap-1">
                                    <button
                                        onClick={onToggleLike}
                                        className={`p-2 rounded-full transition-colors ${
                                            isLiked
                                                ? darkMode ? 'text-[#1DB954]' : 'text-red-500'
                                                : darkMode ? 'text-[#b3b3b3] hover:text-white' : 'text-slate-400 hover:text-red-500'
                                        }`}
                                        title={isLiked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
                                    >
                                        <Heart className="w-4 h-4" fill={isLiked ? 'currentColor' : 'none'} />
                                    </button>
                                    <button
                                        onClick={onAddToPlaylist}
                                        className={`p-2 rounded-full transition-colors ${darkMode ? 'text-[#b3b3b3] hover:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                                        title="Add to Playlist"
                                    >
                                        <ListPlus className="w-4 h-4" />
                                    </button>
                                </div>
                            </>
                        ) : null}
                    </div>

                    {/* Player Controls - Center */}
                    <div className="flex-1 flex flex-col items-center gap-0.5 sm:gap-1 max-w-2xl">
                        {/* Buttons */}
                        <div className="flex items-center gap-2 sm:gap-4">
                            {!isPreviewMode && (
                                <button
                                    onClick={() => {}}
                                    className={`hidden sm:block p-1.5 transition-colors ${darkMode ? 'text-[#b3b3b3] hover:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <Shuffle className="w-4 h-4" />
                                </button>
                            )}
                            {!isPreviewMode && (
                                <button
                                    onClick={onPrev}
                                    className={`p-1 sm:p-1.5 transition-colors ${darkMode ? 'text-[#b3b3b3] hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                                >
                                    <SkipBack className="w-5 h-5 fill-current" />
                                </button>
                            )}
                            <button
                                onClick={togglePlay}
                                disabled={!isReady}
                                className={`p-2.5 sm:p-3 rounded-full transition-all hover:scale-105 active:scale-95 disabled:opacity-50 ${
                                    isPreviewMode
                                        ? darkMode ? 'bg-[#1DB954] text-black hover:bg-[#1ed760]' : 'bg-cyan-500 text-white hover:bg-cyan-600'
                                        : darkMode ? 'bg-white text-black hover:bg-white/90' : 'bg-slate-900 text-white'
                                }`}
                            >
                                {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current pl-0.5" />}
                            </button>
                            {!isPreviewMode && (
                                <button
                                    onClick={onNext}
                                    className={`p-1 sm:p-1.5 transition-colors ${darkMode ? 'text-[#b3b3b3] hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                                >
                                    <SkipForward className="w-5 h-5 fill-current" />
                                </button>
                            )}
                            {!isPreviewMode && (
                                <button
                                    onClick={() => {}}
                                    className={`hidden sm:block p-1.5 transition-colors ${darkMode ? 'text-[#b3b3b3] hover:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <Repeat className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full flex items-center gap-1 sm:gap-2">
                            <span className={`text-[10px] font-mono w-8 sm:w-10 text-right ${darkMode ? 'text-[#b3b3b3]' : 'text-slate-400'}`}>
                                {formatTime(currentTime)}
                            </span>
                            <div className="flex-1 relative group">
                                {/* Custom progress bar */}
                                <div className={`h-1 rounded-full relative ${darkMode ? 'bg-[#4D4D4D]' : 'bg-slate-200'}`}>
                                    <div
                                        className={`h-full rounded-full transition-all ${darkMode ? 'bg-white group-hover:bg-[#1DB954]' : 'bg-cyan-600'}`}
                                        style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
                                    />
                                    <input
                                        type="range"
                                        min="0"
                                        max={duration || 100}
                                        value={currentTime}
                                        onChange={handleSeek}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                </div>
                            </div>
                            <span className={`text-[10px] font-mono w-8 sm:w-10 ${darkMode ? 'text-[#b3b3b3]' : 'text-slate-400'}`}>
                                {formatTime(duration)}
                            </span>
                        </div>
                    </div>

                    {/* Volume & Actions - Right (hidden on mobile) */}
                    <div className="hidden sm:flex items-center gap-3 w-48 justify-end">
                        {!isPreviewMode && currentTrack && (
                            <button
                                onClick={downloadTrack}
                                className={`p-2 rounded-full transition-colors ${darkMode ? 'text-[#b3b3b3] hover:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                                title="Download"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                        )}
                        <div className="flex items-center gap-2 group">
                            <button
                                onClick={toggleMute}
                                className={`p-1 transition-colors ${darkMode ? 'text-[#b3b3b3] hover:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                            </button>
                            <div className="relative w-24 h-1">
                                <div className={`absolute inset-0 rounded-full ${darkMode ? 'bg-[#4D4D4D]' : 'bg-slate-200'}`}>
                                    <div
                                        className={`h-full rounded-full transition-all ${darkMode ? 'bg-white group-hover:bg-[#1DB954]' : 'bg-cyan-500'}`}
                                        style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                                    />
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={isMuted ? 0 : volume}
                                    onChange={handleVolumeChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
