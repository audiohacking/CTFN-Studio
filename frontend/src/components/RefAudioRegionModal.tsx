import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Pause, Check, RotateCcw } from 'lucide-react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';
import type { PreviewPlaybackState } from './BottomPlayer';

interface RefAudioRegionModalProps {
    isOpen: boolean;
    onClose: () => void;
    audioUrl: string;
    duration: number;
    currentStartSec: number | null;
    onSelectRegion: (startSec: number | null) => void;
    darkMode?: boolean;
    // Sync with bottom player
    previewPlaybackState?: PreviewPlaybackState;
    onPreviewSeek?: (time: number) => void;
    onPreviewPlayPause?: () => void;
}

export const RefAudioRegionModal: React.FC<RefAudioRegionModalProps> = ({
    isOpen,
    onClose,
    audioUrl,
    duration,
    currentStartSec,
    onSelectRegion,
    darkMode = false,
    previewPlaybackState,
    onPreviewSeek,
    onPreviewPlayPause
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const regionsRef = useRef<RegionsPlugin | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [regionStart, setRegionStart] = useState<number>(currentStartSec ?? Math.max(0, (duration - 10) / 2));

    const REGION_DURATION = 10; // 10 seconds

    // Get playback state from bottom player or use defaults
    const isPlaying = previewPlaybackState?.isPlaying ?? false;
    const currentTime = previewPlaybackState?.currentTime ?? 0;

    useEffect(() => {
        if (!isOpen || !containerRef.current) return;

        // Create WaveSurfer instance (visual only - no audio, synced with bottom player)
        const ws = WaveSurfer.create({
            container: containerRef.current,
            waveColor: darkMode ? '#404040' : '#cbd5e1',
            progressColor: darkMode ? '#1DB954' : '#06b6d4',
            cursorColor: darkMode ? '#1DB954' : '#06b6d4',
            barWidth: 2,
            barGap: 1,
            barRadius: 2,
            height: 80,
            normalize: true,
            backend: 'WebAudio',
            media: document.createElement('audio'), // Dummy audio - we don't play from here
        });

        // Create regions plugin
        const regions = ws.registerPlugin(RegionsPlugin.create());
        regionsRef.current = regions;

        ws.load(audioUrl);

        ws.on('ready', () => {
            setIsReady(true);
            // Add the selection region
            const start = currentStartSec ?? Math.max(0, (ws.getDuration() - REGION_DURATION) / 2);
            setRegionStart(start);

            regions.addRegion({
                id: 'selection',
                start: start,
                end: Math.min(start + REGION_DURATION, ws.getDuration()),
                color: darkMode ? 'rgba(29, 185, 84, 0.3)' : 'rgba(6, 182, 212, 0.3)',
                drag: true,
                resize: false,
            });
        });

        // Handle click on waveform to seek
        ws.on('click', (relativeX) => {
            const seekTime = relativeX * duration;
            onPreviewSeek?.(seekTime);
        });

        // Handle region updates
        regions.on('region-updated', (region) => {
            if (region.id === 'selection') {
                const newStart = Math.max(0, Math.min(region.start, duration - REGION_DURATION));
                setRegionStart(newStart);
                // Update region position if it was clamped
                if (region.start !== newStart) {
                    region.setOptions({ start: newStart, end: newStart + REGION_DURATION });
                }
            }
        });

        wavesurferRef.current = ws;

        return () => {
            ws.destroy();
            wavesurferRef.current = null;
            regionsRef.current = null;
            setIsReady(false);
        };
    }, [isOpen, audioUrl, darkMode]);

    // Sync waveform progress with bottom player's currentTime
    useEffect(() => {
        if (wavesurferRef.current && isReady && duration > 0) {
            const progress = currentTime / duration;
            // Update the visual progress without triggering audio
            wavesurferRef.current.seekTo(Math.min(Math.max(progress, 0), 1));
        }
    }, [currentTime, duration, isReady]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handlePlayPause = () => {
        onPreviewPlayPause?.();
    };

    const handlePlaySelection = () => {
        onPreviewSeek?.(regionStart);
        // Small delay then play
        setTimeout(() => {
            if (!isPlaying) {
                onPreviewPlayPause?.();
            }
        }, 50);
    };

    const handleResetToMiddle = () => {
        const middle = Math.max(0, (duration - REGION_DURATION) / 2);
        setRegionStart(middle);
        if (regionsRef.current) {
            const region = regionsRef.current.getRegions().find(r => r.id === 'selection');
            if (region) {
                region.setOptions({ start: middle, end: middle + REGION_DURATION });
            }
        }
    };

    const handleConfirm = () => {
        onSelectRegion(regionStart);
        onClose();
    };

    const handleUseMiddle = () => {
        onSelectRegion(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={onClose}
            >
                {/* Backdrop */}
                <div className={`absolute inset-0 ${darkMode ? 'bg-black/80' : 'bg-black/50'} backdrop-blur-sm`} />

                {/* Modal */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    className={`relative w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden ${
                        darkMode ? 'bg-[#181818]' : 'bg-white'
                    }`}
                >
                    {/* Header */}
                    <div className={`flex items-center justify-between px-6 py-4 border-b ${
                        darkMode ? 'border-[#282828]' : 'border-slate-200'
                    }`}>
                        <div>
                            <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                                Select Sample Region
                            </h2>
                            <p className={`text-sm ${darkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
                                Choose a 10-second portion for style reference
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className={`p-2 rounded-full transition-colors ${
                                darkMode ? 'hover:bg-[#282828] text-[#b3b3b3]' : 'hover:bg-slate-100 text-slate-500'
                            }`}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Waveform Container */}
                    <div className="px-6 py-6">
                        {/* Time labels */}
                        <div className={`flex justify-between text-xs mb-2 ${
                            darkMode ? 'text-[#b3b3b3]' : 'text-slate-500'
                        }`}>
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>

                        {/* Waveform with integrated play button */}
                        <div className="flex items-center gap-3">
                            {/* Play/Pause Button - controls bottom player */}
                            <button
                                onClick={handlePlayPause}
                                disabled={!isReady}
                                className={`shrink-0 w-12 h-12 flex items-center justify-center rounded-full transition-all ${
                                    darkMode
                                        ? 'bg-[#1DB954] hover:bg-[#1ed760] text-black disabled:opacity-50'
                                        : 'bg-cyan-500 hover:bg-cyan-600 text-white disabled:opacity-50'
                                }`}
                            >
                                {isPlaying ? (
                                    <Pause className="w-5 h-5" />
                                ) : (
                                    <Play className="w-5 h-5 ml-0.5" />
                                )}
                            </button>

                            {/* Waveform - click to seek in bottom player */}
                            <div
                                ref={containerRef}
                                className={`flex-1 rounded-lg overflow-hidden cursor-pointer ${
                                    darkMode ? 'bg-[#282828]' : 'bg-slate-100'
                                }`}
                            />
                        </div>

                        {/* Loading state */}
                        {!isReady && (
                            <div className={`flex items-center justify-center py-8 ${
                                darkMode ? 'text-[#b3b3b3]' : 'text-slate-500'
                            }`}>
                                <div className="animate-spin rounded-full h-6 w-6 border-2 border-current border-t-transparent mr-2" />
                                Loading waveform...
                            </div>
                        )}

                        {/* Selected region info */}
                        {isReady && (
                            <div className={`mt-4 p-3 rounded-lg ${
                                darkMode ? 'bg-[#1DB954]/10 border border-[#1DB954]/30' : 'bg-cyan-50 border border-cyan-200'
                            }`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded ${
                                            darkMode ? 'bg-[#1DB954]' : 'bg-cyan-500'
                                        }`} />
                                        <span className={`text-sm font-medium ${
                                            darkMode ? 'text-[#1DB954]' : 'text-cyan-700'
                                        }`}>
                                            Selected: {formatTime(regionStart)} - {formatTime(Math.min(regionStart + REGION_DURATION, duration))}
                                        </span>
                                    </div>
                                    <button
                                        onClick={handlePlaySelection}
                                        disabled={!isReady}
                                        className={`text-xs px-3 py-1 rounded-full transition-colors ${
                                            darkMode
                                                ? 'bg-[#282828] hover:bg-[#333] text-white'
                                                : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                                        }`}
                                    >
                                        Preview Selection
                                    </button>
                                </div>
                                <p className={`text-xs mt-1 ${
                                    darkMode ? 'text-[#b3b3b3]' : 'text-slate-500'
                                }`}>
                                    Drag the highlighted region to adjust • Click waveform to seek
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className={`px-6 py-4 border-t flex items-center justify-between ${
                        darkMode ? 'border-[#282828] bg-[#121212]' : 'border-slate-200 bg-slate-50'
                    }`}>
                        <button
                            onClick={handleResetToMiddle}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                                darkMode
                                    ? 'text-[#b3b3b3] hover:text-white hover:bg-[#282828]'
                                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200'
                            }`}
                        >
                            <RotateCcw className="w-4 h-4" />
                            Reset to Middle
                        </button>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleUseMiddle}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    darkMode
                                        ? 'text-[#b3b3b3] hover:text-white hover:bg-[#282828]'
                                        : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200'
                                }`}
                            >
                                Use Default (Middle)
                            </button>
                            <button
                                onClick={handleConfirm}
                                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    darkMode
                                        ? 'bg-[#1DB954] hover:bg-[#1ed760] text-black'
                                        : 'bg-cyan-500 hover:bg-cyan-600 text-white'
                                }`}
                            >
                                <Check className="w-4 h-4" />
                                Confirm Selection
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
