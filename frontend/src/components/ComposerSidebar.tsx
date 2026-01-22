import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Sparkles, RotateCcw, Wand2, ArrowRightCircle, RefreshCw, Clock, Sliders, Music, Upload, X, FileAudio, Play, Dices, Copy, Scissors } from 'lucide-react';

import { api, type Job, type LLMModel } from '../api';
import { RefAudioRegionModal } from './RefAudioRegionModal';
import type { PreviewPlaybackState } from './BottomPlayer';

interface ComposerSidebarProps {
    onGenerate: (data: CompositionData) => void;
    isGenerating: boolean;
    lyricsModels: LLMModel[];
    languages: string[];
    onGenerateLyrics: (topic: string, modelId: string, provider: string, language: string, currentLyrics?: string) => Promise<{ lyrics: string; suggested_topic: string; suggested_tags: string }>;
    isGeneratingLyrics: boolean;
    currentJobId?: string;
    onCancel?: (jobId: string) => void;
    parentJob?: Job;
    onClearParentJob?: () => void;
    reimportData?: { lyrics?: string; tags?: string; topic?: string };
    onClearReimport?: () => void;
    darkMode?: boolean;
    onPreviewRefAudio?: (url: string, filename: string) => void;
    onClearPreviewAudio?: () => void;
    previewPlaybackState?: PreviewPlaybackState;
    onPreviewSeek?: (time: number) => void;
    onPreviewPlayPause?: () => void;
}

export interface CompositionData {
    lyrics: string;
    topic: string;
    tags: string;
    durationMs: number;
    temperature: number;
    cfgScale: number;
    topk: number;
    llmModel: string;
    instrumentalOnly: boolean;
    refAudioId?: string;
    styleInfluence?: number;
    refAudioStartSec?: number;
    seed?: number;
}

export const ComposerSidebar: React.FC<ComposerSidebarProps> = ({
    onGenerate,
    isGenerating,
    lyricsModels,
    languages,
    onGenerateLyrics,
    isGeneratingLyrics,
    currentJobId,
    onCancel,
    parentJob,
    onClearParentJob,
    reimportData,
    onClearReimport,
    darkMode = false,
    onPreviewRefAudio,
    onClearPreviewAudio,
    previewPlaybackState,
    onPreviewSeek,
    onPreviewPlayPause
}) => {
    const [topic, setTopic] = useState('');
    const [style, setStyle] = useState('');
    const [lyrics, setLyrics] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(() => localStorage.getItem('heartmula_show_advanced') === 'true');
    const [logs, setLogs] = useState<string[]>([]);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [instrumentalOnly, setInstrumentalOnly] = useState(() => localStorage.getItem('heartmula_instrumental') === 'true');

    // Reference Audio State
    const [refAudio, setRefAudio] = useState<{ id: string; filename: string; path: string } | null>(null);
    const [isUploadingRef, setIsUploadingRef] = useState(false);
    const [styleInfluence, setStyleInfluence] = useState(100);
    const [refAudioDuration, setRefAudioDuration] = useState(0);
    const [refAudioStartSec, setRefAudioStartSec] = useState<number | null>(null); // null = use middle
    const [showRegionModal, setShowRegionModal] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const refAudioPlayerRef = React.useRef<HTMLAudioElement>(null);

    const handleRefAudioLoadedMetadata = () => {
        if (refAudioPlayerRef.current) {
            setRefAudioDuration(refAudioPlayerRef.current.duration);
        }
    };

    const formatTime = (time: number) => {
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const [pendingModalOpen, setPendingModalOpen] = useState(false);

    const handleRefAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingRef(true);
        try {
            const result = await api.uploadRefAudio(file);
            setRefAudio({ id: result.id, filename: result.filename, path: result.path });
            setPendingModalOpen(true); // Flag to open modal once duration is loaded
        } catch (err: any) {
            console.error('Failed to upload reference audio:', err);
            alert('Failed to upload: ' + (err.response?.data?.detail || err.message));
        } finally {
            setIsUploadingRef(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Helper to open modal and load audio into bottom player
    const openRegionModal = () => {
        if (refAudio) {
            onPreviewRefAudio?.(api.getAudioUrl(refAudio.path), refAudio.filename);
            setShowRegionModal(true);
        }
    };

    // Auto-open region modal when ref audio is uploaded and duration is loaded
    useEffect(() => {
        if (pendingModalOpen && refAudioDuration > 0) {
            setPendingModalOpen(false);
            if (refAudioDuration > 10) {
                openRegionModal();
            }
        }
    }, [pendingModalOpen, refAudioDuration]);

    const handleRemoveRefAudio = async () => {
        if (!refAudio) return;
        setRefAudioDuration(0);
        setRefAudioStartSec(null);
        try {
            await api.deleteRefAudio(refAudio.id);
        } catch (err) {
            console.error('Failed to delete ref audio:', err);
        }
        setRefAudio(null);
    };

    useEffect(() => {
        const handleLog = (e: any) => {
            const data = e.detail;
            if (data.msg) {
                setLogs(prev => {
                    const newLogs = [...prev, `${data.msg}`];
                    return newLogs.slice(-4);
                });
            }
        };
        if (isGenerating) {
            window.addEventListener('heartmula_progress', handleLog);
        } else {
            setLogs([]);
        }
        return () => window.removeEventListener('heartmula_progress', handleLog);
    }, [isGenerating]);

    // Advanced State
    const [duration, setDuration] = useState(() => parseInt(localStorage.getItem('heartmula_duration') || '30'));
    const [temperature, setTemperature] = useState(() => parseFloat(localStorage.getItem('heartmula_temperature') || '1.0'));
    const [cfgScale, setCfgScale] = useState(() => parseFloat(localStorage.getItem('heartmula_cfg') || '1.5'));
    const [topk, setTopk] = useState(() => parseInt(localStorage.getItem('heartmula_topk') || '50'));
    const [selectedModelIndex, setSelectedModelIndex] = useState(() => parseInt(localStorage.getItem('heartmula_model_index') || '0'));
    const [selectedLanguage, setSelectedLanguage] = useState(() => localStorage.getItem('heartmula_language') || 'English');
    const [customSeed, setCustomSeed] = useState<string>(() => localStorage.getItem('heartmula_custom_seed') || '');
    const [useSeed, setUseSeed] = useState(() => localStorage.getItem('heartmula_use_seed') === 'true');
    const [generateCount, setGenerateCount] = useState(1);

    const currentModel = lyricsModels[selectedModelIndex] || lyricsModels[0];

    React.useEffect(() => {
        localStorage.setItem('heartmula_duration', duration.toString());
        localStorage.setItem('heartmula_temperature', temperature.toString());
        localStorage.setItem('heartmula_cfg', cfgScale.toString());
        localStorage.setItem('heartmula_topk', topk.toString());
        localStorage.setItem('heartmula_model_index', selectedModelIndex.toString());
        localStorage.setItem('heartmula_language', selectedLanguage);
        localStorage.setItem('heartmula_instrumental', instrumentalOnly.toString());
        localStorage.setItem('heartmula_custom_seed', customSeed);
        localStorage.setItem('heartmula_use_seed', useSeed.toString());
        localStorage.setItem('heartmula_show_advanced', showAdvanced.toString());
    }, [duration, temperature, cfgScale, topk, selectedModelIndex, selectedLanguage, instrumentalOnly, customSeed, useSeed, showAdvanced]);

    React.useEffect(() => {
        if (lyricsModels.length > 0 && selectedModelIndex >= lyricsModels.length) {
            setSelectedModelIndex(0);
        }
    }, [lyricsModels, selectedModelIndex]);

    const handleMagicGenerate = async () => {
        if (!topic || !currentModel) return;
        setIsEnhancing(true);
        try {
            const seed = lyrics.trim();
            const result = await onGenerateLyrics(topic, currentModel.id, currentModel.provider, selectedLanguage, seed);
            // Always update with AI-generated content
            if (result.lyrics) {
                setLyrics(result.lyrics);
            }
            if (result.suggested_topic) {
                setTopic(result.suggested_topic);
            }
            // Always update tags/style if returned, even replacing existing
            if (result.suggested_tags !== undefined) {
                setStyle(result.suggested_tags);
            }
        } catch (e: any) {
            console.error(e);
            alert("AI Generation Failed: " + (e.response?.data?.detail || e.message || "Unknown error"));
        } finally {
            setIsEnhancing(false);
        }
    };

    const [stylePills, setStylePills] = useState<string[]>(["Cinematic", "Lo-fi", "Synthwave", "Rock", "HipHop", "Orchestral", "Ambient", "Trap", "Techno"]);
    const [isLoadingStyles, setIsLoadingStyles] = useState(false);

    const refreshStyles = async () => {
        if (!currentModel) return;
        setIsLoadingStyles(true);
        try {
            const styles = await api.getStylePresets(currentModel.id);
            if (styles && styles.length > 0) setStylePills(styles);
        } catch (e) {
            console.error("Failed to load styles", e);
        } finally {
            setIsLoadingStyles(false);
        }
    };

    useEffect(() => {
        if (currentModel) refreshStyles();
    }, [currentModel?.id]);

    const addStyle = (s: string) => {
        if (style.includes(s)) return;
        setStyle(prev => prev ? `${prev}, ${s}` : s);
    };

    useEffect(() => {
        if (parentJob) {
            setTopic(parentJob.prompt);
            setLyrics(parentJob.lyrics || "");
            if (parentJob.tags) setStyle(parentJob.tags);
            if (parentJob.seed) {
                setCustomSeed(parentJob.seed.toString());
                setUseSeed(true);
            }
        }
    }, [parentJob]);

    useEffect(() => {
        if (reimportData) {
            if (reimportData.topic) setTopic(reimportData.topic);
            if (reimportData.lyrics) setLyrics(reimportData.lyrics);
            if (reimportData.tags) setStyle(reimportData.tags);
            if (onClearReimport) onClearReimport();
        }
    }, [reimportData]);

    const handleSubmit = () => {
        for (let i = 0; i < generateCount; i++) {
            let seedValue: number | undefined = undefined;
            if (useSeed && i === 0) {
                // First track uses user's seed (or generates one if empty)
                if (customSeed) {
                    seedValue = parseInt(customSeed, 10);
                } else {
                    seedValue = Math.floor(Math.random() * 4294967295);
                    setCustomSeed(seedValue.toString());
                }
            } else if (useSeed && i > 0) {
                // Subsequent tracks get random seeds when bulk generating with custom seed
                seedValue = Math.floor(Math.random() * 4294967295);
            }
            // If not using seed, seedValue stays undefined (random on backend)

            // When using reference audio, CFG scale must be at least 1.5 for proper conditioning
            const effectiveCfgScale = refAudio ? Math.max(cfgScale, 1.5) : cfgScale;

            onGenerate({
                lyrics: instrumentalOnly ? '' : lyrics,
                topic,
                tags: instrumentalOnly ? (style ? `${style}, instrumental` : 'instrumental') : style,
                durationMs: duration * 1000,
                temperature, cfgScale: effectiveCfgScale, topk,
                llmModel: currentModel?.id || 'llama3',
                instrumentalOnly,
                refAudioId: refAudio?.id,
                styleInfluence: refAudio ? styleInfluence : undefined,
                refAudioStartSec: refAudio ? (refAudioStartSec ?? undefined) : undefined,
                seed: seedValue
            });
        }
        // Reset count after generating
        setGenerateCount(1);
    };

    const handleReset = () => {
        setTopic(''); setLyrics(''); setStyle(''); setDuration(30);
        // Don't reset seed - user should toggle to Random explicitly
        if (refAudio) handleRemoveRefAudio();
    };

    const generateRandomSeed = () => {
        const seed = Math.floor(Math.random() * 4294967295);
        setCustomSeed(seed.toString());
        setUseSeed(true);
    };

    const copySeedToClipboard = () => {
        if (customSeed) {
            navigator.clipboard.writeText(customSeed);
        }
    };

    return (
        <div className={`h-full w-full flex flex-col overflow-hidden transition-colors duration-300 ${
            darkMode ? 'bg-[#121212]' : 'bg-white'
        }`}>
            {/* Extension Mode Banner */}
            {parentJob && (
                <div className={`px-4 py-2 flex items-center justify-between shrink-0 ${
                    darkMode ? 'bg-[#1DB954]/10 border-b border-[#1DB954]/20' : 'bg-green-50 border-b border-green-100'
                }`}>
                    <div className={`flex items-center gap-2 text-xs font-medium truncate ${
                        darkMode ? 'text-[#1DB954]' : 'text-green-600'
                    }`}>
                        <ArrowRightCircle className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Extending: {parentJob.title || "Untitled"}</span>
                    </div>
                    {onClearParentJob && (
                        <button
                            onClick={onClearParentJob}
                            className={`text-xs px-2 py-0.5 rounded shrink-0 ${
                                darkMode ? 'text-[#b3b3b3] hover:text-white' : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            Cancel
                        </button>
                    )}
                </div>
            )}

            {/* Header */}
            <div className={`px-4 py-3 flex items-center justify-between shrink-0 border-b ${
                darkMode ? 'border-[#282828]' : 'border-slate-100'
            }`}>
                <h2 className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                    New Track
                </h2>
                <button
                    onClick={handleReset}
                    className={`p-1.5 rounded-md transition-colors ${
                        darkMode ? 'hover:bg-[#282828] text-[#b3b3b3] hover:text-white' : 'hover:bg-slate-100 text-slate-400'
                    }`}
                    title="Reset"
                >
                    <RotateCcw className="w-4 h-4" />
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-4">
                    {/* AI Model & Language Row */}
                    <div className="flex gap-2">
                        <select
                            value={selectedModelIndex}
                            onChange={(e) => setSelectedModelIndex(Number(e.target.value))}
                            className={`flex-1 min-w-0 text-xs px-2 py-2 rounded-md border transition-colors ${
                                darkMode
                                    ? 'bg-[#282828] border-[#404040] text-white hover:border-[#505050]'
                                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                            } focus:outline-none`}
                        >
                            {lyricsModels.length === 0 ? (
                                <option value={0}>Loading...</option>
                            ) : (
                                lyricsModels.map((m, idx) => (
                                    <option key={m.id} value={idx}>
                                        {m.name}
                                    </option>
                                ))
                            )}
                        </select>
                        <select
                            value={selectedLanguage}
                            onChange={(e) => setSelectedLanguage(e.target.value)}
                            className={`w-24 text-xs px-2 py-2 rounded-md border transition-colors ${
                                darkMode
                                    ? 'bg-[#282828] border-[#404040] text-white hover:border-[#505050]'
                                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                            } focus:outline-none`}
                        >
                            {languages.length === 0 ? (
                                <option value="English">English</option>
                            ) : (
                                languages.map(lang => (
                                    <option key={lang} value={lang}>{lang}</option>
                                ))
                            )}
                        </select>
                    </div>

                    {/* Song Concept */}
                    <div className="space-y-1.5">
                        <label className={`text-xs font-medium ${darkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
                            Song Concept
                        </label>
                        <div className="relative">
                            <input
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                placeholder="e.g. 'A lost astronaut', 'Summer love'"
                                className={`w-full text-sm px-3 py-2.5 pr-10 rounded-md border transition-colors ${
                                    darkMode
                                        ? 'bg-[#282828] border-[#404040] text-white placeholder:text-[#606060] focus:border-[#1DB954]'
                                        : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-cyan-500'
                                } focus:outline-none`}
                            />
                            <button
                                onClick={handleMagicGenerate}
                                disabled={isEnhancing || isGeneratingLyrics || !topic}
                                className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-all disabled:opacity-30 ${
                                    darkMode
                                        ? 'text-[#b3b3b3] hover:text-[#1DB954] hover:bg-[#1DB954]/10'
                                        : 'text-slate-400 hover:text-cyan-600 hover:bg-cyan-50'
                                }`}
                                title="Generate lyrics & style with AI"
                            >
                                {(isEnhancing || isGeneratingLyrics) ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Wand2 className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Musical Style */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className={`text-xs font-medium ${darkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
                                Musical Style
                            </label>
                            <button
                                onClick={refreshStyles}
                                disabled={isLoadingStyles}
                                className={`p-1 rounded transition-colors ${
                                    darkMode ? 'text-[#606060] hover:text-[#b3b3b3]' : 'text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                <RefreshCw className={`w-3 h-3 ${isLoadingStyles ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                        <input
                            value={style}
                            onChange={(e) => setStyle(e.target.value)}
                            placeholder="e.g. 'Synthwave, 80s, fast tempo'"
                            className={`w-full text-sm px-3 py-2.5 rounded-md border transition-colors ${
                                darkMode
                                    ? 'bg-[#282828] border-[#404040] text-white placeholder:text-[#606060] focus:border-[#1DB954]'
                                    : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-cyan-500'
                            } focus:outline-none`}
                        />
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {stylePills.slice(0, 6).map(s => (
                                <button
                                    key={s}
                                    onClick={() => addStyle(s)}
                                    className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                                        darkMode
                                            ? 'bg-[#282828] text-[#b3b3b3] hover:bg-[#383838] hover:text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Lyrics */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className={`text-xs font-medium ${darkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
                                Lyrics
                            </label>
                            <button
                                onClick={() => setInstrumentalOnly(!instrumentalOnly)}
                                className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full transition-colors ${
                                    instrumentalOnly
                                        ? darkMode
                                            ? 'bg-[#1DB954]/20 text-[#1DB954]'
                                            : 'bg-purple-100 text-purple-600'
                                        : darkMode
                                            ? 'bg-[#282828] text-[#606060] hover:text-[#b3b3b3]'
                                            : 'bg-slate-100 text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                <Music className="w-3 h-3" />
                                Instrumental
                            </button>
                        </div>
                        <AnimatePresence mode="wait">
                            {instrumentalOnly ? (
                                <motion.div
                                    key="instrumental"
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className={`flex items-center justify-center gap-2 py-8 rounded-md border border-dashed ${
                                        darkMode
                                            ? 'bg-[#1DB954]/5 border-[#1DB954]/30 text-[#1DB954]'
                                            : 'bg-purple-50 border-purple-200 text-purple-500'
                                    }`}
                                >
                                    <Music className="w-5 h-5" />
                                    <span className="text-sm font-medium">Instrumental mode</span>
                                </motion.div>
                            ) : (
                                <motion.textarea
                                    key="lyrics"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    value={lyrics}
                                    onChange={(e) => setLyrics(e.target.value)}
                                    placeholder="Click the wand above to generate, or write your own..."
                                    rows={8}
                                    className={`w-full text-sm px-3 py-2.5 rounded-md border resize-none transition-colors ${
                                        darkMode
                                            ? 'bg-[#282828] border-[#404040] text-white placeholder:text-[#606060] focus:border-[#1DB954]'
                                            : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-cyan-500'
                                    } focus:outline-none`}
                                />
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Duration Quick Select */}
                    <div className="space-y-1.5">
                        <label className={`text-xs font-medium flex items-center gap-1.5 ${darkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
                            <Clock className="w-3 h-3" />
                            Duration: {duration}s
                        </label>
                        <div className="flex gap-2">
                            {[30, 60, 120, 180].map(d => (
                                <button
                                    key={d}
                                    onClick={() => setDuration(d)}
                                    className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
                                        duration === d
                                            ? darkMode
                                                ? 'bg-[#1DB954] text-black font-medium'
                                                : 'bg-cyan-500 text-white font-medium'
                                            : darkMode
                                                ? 'bg-[#282828] text-[#b3b3b3] hover:bg-[#383838]'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {d}s
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Reference Audio Upload */}
                    <div className="space-y-1.5">
                        <label className={`text-xs font-medium flex items-center gap-1.5 ${darkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
                            <FileAudio className="w-3 h-3" />
                            Reference Audio
                            <span className={`text-[10px] ${darkMode ? 'text-[#606060]' : 'text-slate-400'}`}>(optional)</span>
                        </label>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleRefAudioUpload}
                            accept="audio/*"
                            className="hidden"
                        />
                        {refAudio ? (
                            <div className={`space-y-2 p-2.5 rounded-md border ${
                                darkMode
                                    ? 'bg-[#1DB954]/10 border-[#1DB954]/30'
                                    : 'bg-cyan-50 border-cyan-200'
                            }`}>
                                {/* Hidden audio element for getting duration */}
                                <audio
                                    ref={refAudioPlayerRef}
                                    src={api.getAudioUrl(refAudio.path)}
                                    onLoadedMetadata={handleRefAudioLoadedMetadata}
                                    className="hidden"
                                />

                                {/* File info and remove button */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <FileAudio className={`w-4 h-4 shrink-0 ${darkMode ? 'text-[#1DB954]' : 'text-cyan-600'}`} />
                                        <span className={`text-xs truncate ${darkMode ? 'text-[#1DB954]' : 'text-cyan-700'}`}>
                                            {refAudio.filename}
                                        </span>
                                    </div>
                                    <button
                                        onClick={handleRemoveRefAudio}
                                        className={`p-1 rounded hover:bg-black/10 ${darkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {/* Preview in Bottom Player Button */}
                                <button
                                    onClick={() => onPreviewRefAudio?.(api.getAudioUrl(refAudio.path), refAudio.filename)}
                                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-md transition-colors ${
                                        darkMode
                                            ? 'bg-[#282828] hover:bg-[#333] text-white'
                                            : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                                    }`}
                                >
                                    <Play className={`w-3.5 h-3.5 ${darkMode ? 'text-[#1DB954]' : 'text-cyan-500'}`} />
                                    <span className="text-xs font-medium">Preview in Player</span>
                                    {refAudioDuration > 0 && (
                                        <span className={`text-[10px] font-mono ${darkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
                                            ({formatTime(refAudioDuration)})
                                        </span>
                                    )}
                                </button>

                                {/* Style Influence Slider - controls how much of the reference audio to analyze */}
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center">
                                        <span className={`text-[10px] ${darkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
                                            Style Influence
                                        </span>
                                        <span className={`text-[10px] font-mono ${darkMode ? 'text-[#1DB954]' : 'text-cyan-600'}`}>
                                            {styleInfluence}%
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="100"
                                        step="1"
                                        value={styleInfluence}
                                        onChange={(e) => setStyleInfluence(parseInt(e.target.value))}
                                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[#1DB954]"
                                        style={{
                                            background: darkMode
                                                ? `linear-gradient(to right, #1DB954 0%, #1DB954 ${styleInfluence}%, #404040 ${styleInfluence}%, #404040 100%)`
                                                : `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${styleInfluence}%, #e2e8f0 ${styleInfluence}%, #e2e8f0 100%)`
                                        }}
                                    />
                                    <div className="flex justify-between text-[9px] opacity-50">
                                        <span>Sample</span>
                                        <span>Full Song</span>
                                    </div>
                                </div>

                                {/* Region Selector Button - Opens modal to pick which 10s portion to use */}
                                {refAudioDuration > 10 && (
                                    <button
                                        onClick={openRegionModal}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
                                            darkMode
                                                ? 'bg-[#282828] hover:bg-[#333] text-white'
                                                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Scissors className={`w-3.5 h-3.5 ${darkMode ? 'text-[#1DB954]' : 'text-cyan-500'}`} />
                                            <span className="text-xs font-medium">Sample Region</span>
                                        </div>
                                        <span className={`text-xs font-mono ${darkMode ? 'text-[#1DB954]' : 'text-cyan-600'}`}>
                                            {refAudioStartSec !== null
                                                ? `${formatTime(refAudioStartSec)} - ${formatTime(Math.min(refAudioStartSec + 10, refAudioDuration))}`
                                                : 'Middle 10s'
                                            }
                                        </span>
                                    </button>
                                )}
                            </div>
                        ) : (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploadingRef}
                                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-md border border-dashed transition-colors ${
                                    darkMode
                                        ? 'border-[#404040] text-[#606060] hover:border-[#1DB954] hover:text-[#1DB954] hover:bg-[#1DB954]/5'
                                        : 'border-slate-300 text-slate-400 hover:border-cyan-400 hover:text-cyan-500 hover:bg-cyan-50'
                                } ${isUploadingRef ? 'opacity-50 cursor-wait' : ''}`}
                            >
                                {isUploadingRef ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Upload className="w-4 h-4" />
                                )}
                                <span className="text-xs">
                                    {isUploadingRef ? 'Uploading...' : 'Upload audio for style reference'}
                                </span>
                            </button>
                        )}
                        <p className={`text-[10px] ${darkMode ? 'text-[#505050]' : 'text-slate-400'}`}>
                            Upload a song to match its style/vibe
                        </p>
                    </div>

                    {/* Advanced Settings Toggle */}
                    <div className={`border-t pt-3 ${darkMode ? 'border-[#282828]' : 'border-slate-100'}`}>
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className={`flex items-center justify-between w-full text-xs font-medium ${
                                darkMode ? 'text-[#606060] hover:text-[#b3b3b3]' : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            <span className="flex items-center gap-1.5">
                                <Sliders className="w-3 h-3" />
                                Advanced Settings
                            </span>
                            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        <AnimatePresence>
                            {showAdvanced && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="space-y-3 pt-3">
                                        {[
                                            { label: 'Temperature', value: temperature, min: 0.1, max: 2.0, step: 0.1, set: setTemperature },
                                            { label: 'CFG Scale', value: cfgScale, min: 1.0, max: 5.0, step: 0.5, set: setCfgScale },
                                            { label: 'Top-K', value: topk, min: 10, max: 100, step: 10, set: setTopk },
                                        ].map(({ label, value, min, max, step, set }) => (
                                            <div key={label} className="space-y-1">
                                                <div className={`flex justify-between text-xs ${darkMode ? 'text-[#606060]' : 'text-slate-400'}`}>
                                                    <span>{label}</span>
                                                    <span className={darkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}>{value}</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min={min}
                                                    max={max}
                                                    step={step}
                                                    value={value}
                                                    onChange={(e) => set(Number(e.target.value))}
                                                    className={`w-full h-1 rounded-full appearance-none cursor-pointer ${
                                                        darkMode ? 'bg-[#404040] accent-[#1DB954]' : 'bg-slate-200 accent-cyan-500'
                                                    }`}
                                                />
                                            </div>
                                        ))}

                                        {/* Seed Input */}
                                        <div className="space-y-1.5 pt-2">
                                            <div className="flex items-center justify-between">
                                                <label className={`text-xs font-medium flex items-center gap-1.5 ${darkMode ? 'text-[#606060]' : 'text-slate-400'}`}>
                                                    <Dices className="w-3 h-3" />
                                                    Seed
                                                </label>
                                                <button
                                                    onClick={() => setUseSeed(!useSeed)}
                                                    className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                                                        useSeed
                                                            ? darkMode
                                                                ? 'bg-[#1DB954]/20 text-[#1DB954]'
                                                                : 'bg-cyan-100 text-cyan-600'
                                                            : darkMode
                                                                ? 'bg-[#282828] text-[#606060]'
                                                                : 'bg-slate-100 text-slate-400'
                                                    }`}
                                                >
                                                    {useSeed ? 'Custom' : 'Random'}
                                                </button>
                                            </div>
                                            {useSeed && (
                                                <div className="flex gap-1.5">
                                                    <input
                                                        type="text"
                                                        value={customSeed}
                                                        onChange={(e) => setCustomSeed(e.target.value.replace(/\D/g, ''))}
                                                        placeholder="Enter seed number"
                                                        className={`flex-1 text-xs px-2 py-1.5 rounded-md border transition-colors ${
                                                            darkMode
                                                                ? 'bg-[#282828] border-[#404040] text-white placeholder:text-[#606060] focus:border-[#1DB954]'
                                                                : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-cyan-500'
                                                        } focus:outline-none`}
                                                    />
                                                    <button
                                                        onClick={generateRandomSeed}
                                                        className={`p-1.5 rounded-md transition-colors ${
                                                            darkMode
                                                                ? 'bg-[#282828] text-[#b3b3b3] hover:bg-[#383838] hover:text-white'
                                                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                        }`}
                                                        title="Generate random seed"
                                                    >
                                                        <Dices className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={copySeedToClipboard}
                                                        className={`p-1.5 rounded-md transition-colors ${
                                                            darkMode
                                                                ? 'bg-[#282828] text-[#b3b3b3] hover:bg-[#383838] hover:text-white'
                                                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                        }`}
                                                        title="Copy seed"
                                                    >
                                                        <Copy className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                            <p className={`text-[10px] ${darkMode ? 'text-[#505050]' : 'text-slate-400'}`}>
                                                Use same seed for reproducible results
                                            </p>
                                        </div>
                                    </div>

                                    {/* Bulk Generate */}
                                    <div>
                                        <label className={`text-xs font-medium block mb-2 ${darkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
                                            Bulk Generate
                                        </label>
                                        <div className="flex items-center gap-1">
                                            {[1, 2, 3, 5, 10].map((count) => (
                                                <button
                                                    key={count}
                                                    onClick={() => setGenerateCount(count)}
                                                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                                                        generateCount === count
                                                            ? darkMode
                                                                ? 'bg-[#1DB954] text-black'
                                                                : 'bg-cyan-500 text-white'
                                                            : darkMode
                                                                ? 'bg-[#282828] text-[#b3b3b3] hover:bg-[#383838] hover:text-white'
                                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                    }`}
                                                >
                                                    {count}
                                                </button>
                                            ))}
                                        </div>
                                        <p className={`text-[10px] mt-1 ${darkMode ? 'text-[#505050]' : 'text-slate-400'}`}>
                                            Generate multiple tracks with same settings
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Progress Log */}
            <AnimatePresence>
                {isGenerating && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className={`px-4 py-3 border-t shrink-0 ${
                            darkMode ? 'bg-[#181818] border-[#282828]' : 'bg-slate-50 border-slate-100'
                        }`}
                    >
                        <div className={`flex items-center gap-2 text-xs font-medium mb-1.5 ${
                            darkMode ? 'text-[#1DB954]' : 'text-green-600'
                        }`}>
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-[#1DB954]" />
                            Generating...
                        </div>
                        <div className={`text-xs space-y-0.5 ${darkMode ? 'text-[#606060]' : 'text-slate-400'}`}>
                            {logs.slice(-2).map((log, i) => (
                                <div key={i} className="truncate">{log}</div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Footer */}
            <div className={`p-4 border-t shrink-0 space-y-2 ${
                darkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-100'
            }`}>
                {isGenerating && currentJobId && onCancel && (
                    <button
                        onClick={() => onCancel(currentJobId)}
                        className={`w-full py-2.5 text-xs font-medium rounded-lg transition-colors ${
                            darkMode
                                ? 'bg-[#282828] text-white hover:bg-[#383838]'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                    >
                        Stop Generation
                    </button>
                )}

                <button
                    onClick={handleSubmit}
                    disabled={!topic || !style || (!instrumentalOnly && !lyrics)}
                    className={`w-full py-3 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                        darkMode
                            ? 'bg-[#1DB954] text-black hover:bg-[#1ed760]'
                            : 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white hover:from-cyan-600 hover:to-indigo-600 shadow-lg shadow-cyan-500/25'
                    }`}
                >
                    {instrumentalOnly ? <Music className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                    {isGenerating
                        ? `Add ${generateCount > 1 ? generateCount + ' ' : ''}to Queue`
                        : generateCount > 1
                            ? `Generate ${generateCount} Tracks`
                            : instrumentalOnly
                                ? 'Generate Instrumental'
                                : 'Generate Track'
                    }
                </button>
            </div>

            {/* Reference Audio Region Selection Modal */}
            {refAudio && (
                <RefAudioRegionModal
                    isOpen={showRegionModal}
                    onClose={() => {
                        setShowRegionModal(false);
                        onClearPreviewAudio?.();
                    }}
                    audioUrl={api.getAudioUrl(refAudio.path)}
                    duration={refAudioDuration}
                    currentStartSec={refAudioStartSec}
                    onSelectRegion={(startSec) => setRefAudioStartSec(startSec)}
                    darkMode={darkMode}
                    previewPlaybackState={previewPlaybackState}
                    onPreviewSeek={onPreviewSeek}
                    onPreviewPlayPause={onPreviewPlayPause}
                />
            )}
        </div>
    );
};
