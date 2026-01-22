import React from 'react';
import { X, Clock, Settings, FileText, Tag, Heart, ListPlus } from 'lucide-react';
import type { Job } from '../api';
import { AlbumCoverLarge } from './AlbumCover';

interface TrackDetailsSidebarProps {
    track: Job | null;
    onClose: () => void;
    darkMode?: boolean;
    isLiked?: boolean;
    onToggleLike?: () => void;
    onAddToPlaylist?: () => void;
}

export const TrackDetailsSidebar: React.FC<TrackDetailsSidebarProps> = ({
    track,
    onClose,
    darkMode = false,
    isLiked = false,
    onToggleLike,
    onAddToPlaylist
}) => {
    if (!track) return null;

    const formatDuration = (ms?: number) => {
        if (!ms) return 'Unknown';
        const secs = Math.floor(ms / 1000);
        const mins = Math.floor(secs / 60);
        const remainingSecs = secs % 60;
        return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
    };

    return (
        <>
            {/* Desktop backdrop - none needed */}
            {/* Mobile: full screen, no backdrop needed since it's full screen */}
            <div className={`
                fixed md:relative inset-0 md:inset-auto z-50 md:z-auto
                w-full md:w-[320px] h-full flex flex-col transition-colors duration-300
                ${darkMode ? 'bg-[#121212] md:border-l md:border-[#282828]' : 'bg-white md:border-l md:border-slate-200'}
            `}>
            {/* Header */}
            <div className={`p-4 flex items-center justify-between border-b ${darkMode ? 'border-[#282828]' : 'border-slate-100'}`}>
                <h2 className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                    Now Playing
                </h2>
                <button
                    onClick={onClose}
                    className={`p-2 md:p-1.5 rounded-full transition-colors ${darkMode ? 'bg-[#282828] md:bg-transparent hover:bg-[#383838] md:hover:bg-[#282828] text-white md:text-[#b3b3b3] hover:text-white' : 'bg-slate-100 md:bg-transparent hover:bg-slate-200 md:hover:bg-slate-100 text-slate-600 md:text-slate-400 hover:text-slate-800 md:hover:text-slate-600'}`}
                >
                    <X className="w-5 h-5 md:w-4 md:h-4" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24 md:pb-4">
                {/* Track Art & Title */}
                <div className="text-center">
                    <AlbumCoverLarge seed={track.id} size="xl" className="mx-auto mb-4" />
                    <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                        {track.title || track.prompt || 'Untitled Track'}
                    </h3>
                    <p className={`text-sm mt-1 ${darkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
                        AI Generated
                    </p>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-center gap-3 mt-4">
                        <button
                            onClick={onToggleLike}
                            className={`p-3 rounded-full border transition-all ${
                                isLiked
                                    ? darkMode
                                        ? 'border-[#1DB954] text-[#1DB954] bg-[#1DB954]/10'
                                        : 'border-red-500 text-red-500 bg-red-50'
                                    : darkMode
                                        ? 'border-[#404040] text-[#b3b3b3] hover:border-[#1DB954] hover:text-[#1DB954]'
                                        : 'border-slate-200 text-slate-400 hover:border-red-500 hover:text-red-500'
                            }`}
                            title={isLiked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
                        >
                            <Heart className="w-5 h-5" fill={isLiked ? 'currentColor' : 'none'} />
                        </button>
                        <button
                            onClick={onAddToPlaylist}
                            className={`p-3 rounded-full border transition-all ${
                                darkMode
                                    ? 'border-[#404040] text-[#b3b3b3] hover:border-white hover:text-white'
                                    : 'border-slate-200 text-slate-400 hover:border-slate-400 hover:text-slate-600'
                            }`}
                            title="Add to Playlist"
                        >
                            <ListPlus className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Tags */}
                {track.tags && (
                    <div>
                        <div className={`flex items-center gap-2 mb-3 ${darkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
                            <Tag className="w-4 h-4" />
                            <span className="text-xs font-semibold uppercase tracking-wide">Style</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {track.tags.split(',').map((tag, idx) => (
                                <span
                                    key={idx}
                                    className={`text-xs px-3 py-1.5 rounded-full ${darkMode ? 'bg-[#282828] text-[#b3b3b3]' : 'bg-slate-100 text-slate-600'}`}
                                >
                                    {tag.trim()}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Settings */}
                <div>
                    <div className={`flex items-center gap-2 mb-3 ${darkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
                        <Settings className="w-4 h-4" />
                        <span className="text-xs font-semibold uppercase tracking-wide">Settings</span>
                    </div>
                    <div className={`rounded-lg p-3 space-y-2 ${darkMode ? 'bg-[#282828]' : 'bg-slate-50'}`}>
                        <div className="flex justify-between text-sm">
                            <span className={darkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}>Duration</span>
                            <span className={darkMode ? 'text-white' : 'text-slate-800'}>{formatDuration(track.duration_ms)}</span>
                        </div>
                        {track.seed && (
                            <div className="flex justify-between text-sm">
                                <span className={darkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}>Seed</span>
                                <span className={`font-mono text-xs ${darkMode ? 'text-white' : 'text-slate-800'}`}>{track.seed}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-sm">
                            <span className={darkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}>Created</span>
                            <span className={darkMode ? 'text-white' : 'text-slate-800'}>
                                {new Date(track.created_at + "Z").toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Lyrics */}
                {track.lyrics && (
                    <div>
                        <div className={`flex items-center gap-2 mb-3 ${darkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
                            <FileText className="w-4 h-4" />
                            <span className="text-xs font-semibold uppercase tracking-wide">Lyrics</span>
                        </div>
                        <div className={`rounded-lg p-4 text-sm leading-relaxed whitespace-pre-line ${darkMode ? 'bg-[#282828] text-[#b3b3b3]' : 'bg-slate-50 text-slate-600'}`}>
                            {track.lyrics}
                        </div>
                    </div>
                )}

                {/* Prompt */}
                {track.prompt && (
                    <div>
                        <div className={`flex items-center gap-2 mb-3 ${darkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
                            <Clock className="w-4 h-4" />
                            <span className="text-xs font-semibold uppercase tracking-wide">Prompt</span>
                        </div>
                        <p className={`text-sm ${darkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
                            {track.prompt}
                        </p>
                    </div>
                )}
            </div>
        </div>
        </>
    );
};
