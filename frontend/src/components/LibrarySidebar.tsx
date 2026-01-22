import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ListMusic, Plus, ChevronLeft, Play, Pause, Trash2, Edit2, X, Check, Volume2 } from 'lucide-react';
import { api, type Playlist, type Job, type PlaylistWithSongs } from '../api';
import { AlbumCover, AlbumCoverLarge } from './AlbumCover';

interface LibrarySidebarProps {
    darkMode?: boolean;
    likedIds: Set<string>;
    onPlayTrack?: (job: Job) => void;
    onPauseTrack?: () => void;
    playingTrackId?: string;
    isTrackPlaying?: boolean;
    onRefreshLikes?: () => void;
    initialView?: 'library' | 'liked';
    onSelectTrack?: (job: Job) => void;
    selectedTrackId?: string;
    onToggleLike?: (jobId: string, isLiked: boolean) => void;
    onAddToPlaylist?: (job: Job) => void;
}

type ViewMode = 'library' | 'liked' | 'playlist';

export const LibrarySidebar: React.FC<LibrarySidebarProps> = ({
    darkMode = false,
    likedIds,
    onPlayTrack,
    onPauseTrack,
    playingTrackId,
    isTrackPlaying,
    onRefreshLikes,
    initialView = 'library',
    onSelectTrack,
    selectedTrackId,
    onToggleLike,
    onAddToPlaylist: _onAddToPlaylist
}) => {
    const [viewMode, setViewMode] = useState<ViewMode>(initialView);
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [likedSongs, setLikedSongs] = useState<Job[]>([]);
    const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistWithSongs | null>(null);
    const [loading, setLoading] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [editingPlaylist, setEditingPlaylist] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    const textClass = darkMode ? 'text-white' : 'text-slate-900';
    const mutedTextClass = darkMode ? 'text-[#b3b3b3]' : 'text-slate-500';

    useEffect(() => {
        if (initialView === 'liked' || initialView === 'library') {
            setViewMode(initialView);
            setSelectedPlaylist(null);
        }
    }, [initialView]);

    useEffect(() => {
        loadPlaylists();
    }, []);

    useEffect(() => {
        if (viewMode === 'liked') {
            loadLikedSongs();
        }
    }, [viewMode, likedIds]);

    const loadPlaylists = async () => {
        try {
            const data = await api.getPlaylists();
            setPlaylists(data);
        } catch (e) {
            console.error('Failed to load playlists', e);
        }
    };

    const loadLikedSongs = async () => {
        setLoading(true);
        try {
            const data = await api.getLikedSongs();
            setLikedSongs(data.songs);
        } catch (e) {
            console.error('Failed to load liked songs', e);
        } finally {
            setLoading(false);
        }
    };

    const loadPlaylist = async (playlistId: string) => {
        setLoading(true);
        try {
            const data = await api.getPlaylist(playlistId);
            setSelectedPlaylist(data);
            setViewMode('playlist');
        } catch (e) {
            console.error('Failed to load playlist', e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePlaylist = async () => {
        if (!newPlaylistName.trim()) return;
        try {
            await api.createPlaylist(newPlaylistName.trim());
            setNewPlaylistName('');
            setShowCreateModal(false);
            loadPlaylists();
        } catch (e) {
            console.error('Failed to create playlist', e);
        }
    };

    const handleDeletePlaylist = async (playlistId: string) => {
        if (!confirm('Delete this playlist?')) return;
        try {
            await api.deletePlaylist(playlistId);
            loadPlaylists();
            if (selectedPlaylist?.id === playlistId) {
                setViewMode('library');
                setSelectedPlaylist(null);
            }
        } catch (e) {
            console.error('Failed to delete playlist', e);
        }
    };

    const handleRenamePlaylist = async (playlistId: string) => {
        if (!editName.trim()) return;
        try {
            await api.updatePlaylist(playlistId, editName.trim());
            setEditingPlaylist(null);
            loadPlaylists();
            if (selectedPlaylist?.id === playlistId) {
                loadPlaylist(playlistId);
            }
        } catch (e) {
            console.error('Failed to rename playlist', e);
        }
    };

    const handleRemoveFromPlaylist = async (playlistId: string, jobId: string) => {
        try {
            await api.removeSongFromPlaylist(playlistId, jobId);
            loadPlaylist(playlistId);
            loadPlaylists();
        } catch (e) {
            console.error('Failed to remove from playlist', e);
        }
    };

    const handleUnlike = async (jobId: string) => {
        try {
            await api.unlikeSong(jobId);
            onRefreshLikes?.();
            loadLikedSongs();
        } catch (e) {
            console.error('Failed to unlike', e);
        }
    };

    // Track Card Component - matches HistoryFeed design
    const TrackCard: React.FC<{ song: Job; onRemove?: () => void; showRemove?: boolean }> = ({ song, onRemove, showRemove }) => {
        const isPlaying = playingTrackId === song.id && isTrackPlaying;
        const isSelected = selectedTrackId === song.id;

        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                layout
                transition={{ duration: 0.3, ease: "easeOut" }}
            >
                <div
                    className={`
                        group relative overflow-hidden rounded-lg transition-all duration-200 cursor-pointer
                        ${isPlaying
                            ? darkMode
                                ? 'bg-[#282828] ring-2 ring-[#1DB954]'
                                : 'bg-white/90 border border-green-400 shadow-xl shadow-green-500/10 ring-1 ring-green-400/30'
                            : isSelected
                                ? darkMode
                                    ? 'bg-[#282828] ring-1 ring-[#1DB954]/50'
                                    : 'bg-white/80 border border-cyan-400 shadow-xl shadow-cyan-500/10'
                                : darkMode
                                    ? 'bg-[#181818] hover:bg-[#282828]'
                                    : 'bg-white/40 border border-slate-200/50 hover:bg-white/60 hover:border-slate-300 hover:shadow-lg backdrop-blur-md'
                        }
                    `}
                    onClick={() => onSelectTrack?.(song)}
                >
                    <div className="p-4">
                        <div className="flex items-center gap-4">
                            {/* Album Cover with Play Button */}
                            <div className="relative group/cover shrink-0">
                                <AlbumCover seed={song.id} size="md" />

                                {song.status === 'completed' && song.audio_path && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (isPlaying) {
                                                onPauseTrack?.();
                                            } else {
                                                onPlayTrack?.(song);
                                            }
                                        }}
                                        className={`absolute inset-0 flex items-center justify-center rounded-md transition-all duration-200 ${
                                            isPlaying
                                                ? 'bg-black/40'
                                                : 'bg-black/0 hover:bg-black/40 opacity-0 group-hover/cover:opacity-100'
                                        }`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 ${
                                            darkMode ? 'bg-[#1DB954] text-black' : 'bg-white text-slate-900'
                                        }`}>
                                            {isPlaying ? (
                                                <Pause className="w-4 h-4" fill="currentColor" />
                                            ) : (
                                                <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                                            )}
                                        </div>
                                    </button>
                                )}

                                {isPlaying && (
                                    <div className="absolute -bottom-1 -right-1">
                                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${darkMode ? 'bg-[#1DB954]' : 'bg-green-500'}`}>
                                            <Volume2 className="w-2.5 h-2.5 text-white" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Title & Tags */}
                            <div className="flex-1 min-w-0">
                                <h3 className={`text-sm font-semibold truncate transition-colors ${
                                    isPlaying
                                        ? darkMode ? 'text-[#1DB954]' : 'text-green-600'
                                        : darkMode ? 'text-white' : 'text-slate-800'
                                }`}>
                                    {song.title || song.prompt || 'Untitled Track'}
                                </h3>
                                <p className={`text-xs truncate mt-0.5 ${mutedTextClass}`}>
                                    {song.tags || 'AI Generated'}
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                                {/* Like Button */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (showRemove) {
                                            handleUnlike(song.id);
                                        } else {
                                            onToggleLike?.(song.id, likedIds.has(song.id));
                                        }
                                    }}
                                    className={`p-1.5 rounded-full transition-all ${
                                        likedIds.has(song.id)
                                            ? darkMode ? 'text-[#1DB954]' : 'text-red-500'
                                            : darkMode ? 'text-[#727272] hover:text-[#1DB954] opacity-0 group-hover:opacity-100' : 'text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100'
                                    }`}
                                    title={likedIds.has(song.id) ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
                                >
                                    <Heart className="w-4 h-4" fill={likedIds.has(song.id) ? 'currentColor' : 'none'} />
                                </button>

                                {/* Remove from playlist button */}
                                {showRemove && onRemove && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onRemove(); }}
                                        className={`p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all ${
                                            darkMode ? 'text-[#727272] hover:text-red-400' : 'text-slate-300 hover:text-red-500'
                                        }`}
                                        title="Remove"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    };

    // Playlist Card Component
    const PlaylistCard: React.FC<{ playlist: Playlist }> = ({ playlist }) => (
        <div
            className={`group relative rounded-lg p-4 cursor-pointer transition-all ${
                darkMode ? 'bg-[#181818] hover:bg-[#282828]' : 'bg-white/40 border border-slate-200/50 hover:bg-white/60 hover:shadow-lg'
            }`}
            onClick={() => loadPlaylist(playlist.id)}
        >
            <div className="flex items-center gap-4">
                <AlbumCoverLarge seed={playlist.cover_seed || playlist.id} size="md" className="w-16 h-16 shrink-0" />
                <div className="flex-1 min-w-0">
                    {editingPlaylist === playlist.id ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <input
                                autoFocus
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleRenamePlaylist(playlist.id)}
                                className={`flex-1 px-2 py-1 text-sm rounded ${
                                    darkMode ? 'bg-[#404040] text-white' : 'bg-slate-100'
                                }`}
                            />
                            <button onClick={() => handleRenamePlaylist(playlist.id)} className="p-1">
                                <Check className="w-4 h-4 text-green-500" />
                            </button>
                            <button onClick={() => setEditingPlaylist(null)} className="p-1">
                                <X className="w-4 h-4 text-red-500" />
                            </button>
                        </div>
                    ) : (
                        <>
                            <h3 className={`font-semibold truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                                {playlist.name}
                            </h3>
                            <p className={`text-sm ${mutedTextClass}`}>
                                {playlist.song_count} song{playlist.song_count !== 1 ? 's' : ''}
                            </p>
                        </>
                    )}
                </div>
                <div
                    className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={() => { setEditingPlaylist(playlist.id); setEditName(playlist.name); }}
                        className={`p-2 rounded-full ${darkMode ? 'hover:bg-[#3E3E3E] text-[#b3b3b3]' : 'hover:bg-slate-100 text-slate-400'}`}
                    >
                        <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleDeletePlaylist(playlist.id)}
                        className={`p-2 rounded-full ${darkMode ? 'hover:bg-[#3E3E3E] text-red-400' : 'hover:bg-slate-100 text-red-500'}`}
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );

    // Liked songs view
    if (viewMode === 'liked') {
        return (
            <div className={`h-full flex flex-col overflow-hidden ${darkMode ? 'bg-[#121212]' : 'bg-slate-50'}`}>
                {/* Hero Header */}
                <div className={`px-8 pt-8 pb-6 shrink-0 ${darkMode ? 'bg-gradient-to-b from-[#533a8b] to-[#121212]' : 'bg-gradient-to-b from-purple-100 to-slate-50'}`}>
                    <button
                        onClick={() => setViewMode('library')}
                        className={`flex items-center gap-2 text-sm mb-6 ${darkMode ? 'text-white/70 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        <ChevronLeft className="w-5 h-5" />
                        Back to Library
                    </button>
                    <div className="flex items-end gap-6">
                        <div className={`w-32 h-32 rounded-lg shadow-2xl flex items-center justify-center bg-gradient-to-br ${
                            darkMode ? 'from-[#450af5] to-[#c4efd9]' : 'from-purple-500 to-cyan-300'
                        }`}>
                            <Heart className="w-16 h-16 text-white" fill="white" />
                        </div>
                        <div>
                            <p className={`text-xs font-semibold uppercase tracking-wide ${darkMode ? 'text-white/70' : 'text-slate-600'}`}>
                                Playlist
                            </p>
                            <h1 className={`text-4xl font-bold mt-1 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                Liked Songs
                            </h1>
                            <p className={`mt-2 ${darkMode ? 'text-white/70' : 'text-slate-600'}`}>
                                {likedSongs.length} song{likedSongs.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Track List */}
                <div className="flex-1 overflow-y-auto px-8 py-6 pb-32">
                    {loading ? (
                        <div className={`text-center py-12 ${mutedTextClass}`}>Loading...</div>
                    ) : likedSongs.length === 0 ? (
                        <div className={`text-center py-16 ${darkMode ? 'text-[#727272]' : 'text-slate-400'}`}>
                            <Heart className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <h3 className={`text-xl font-semibold mb-2 ${textClass}`}>Songs you like will appear here</h3>
                            <p>Save songs by tapping the heart icon</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <AnimatePresence initial={false}>
                                {likedSongs.map((song) => (
                                    <TrackCard
                                        key={song.id}
                                        song={song}
                                        showRemove
                                        onRemove={() => handleUnlike(song.id)}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Playlist detail view
    if (viewMode === 'playlist' && selectedPlaylist) {
        return (
            <div className={`h-full flex flex-col overflow-hidden ${darkMode ? 'bg-[#121212]' : 'bg-slate-50'}`}>
                {/* Hero Header */}
                <div className={`px-8 pt-8 pb-6 shrink-0 ${darkMode ? 'bg-gradient-to-b from-[#535353] to-[#121212]' : 'bg-gradient-to-b from-slate-200 to-slate-50'}`}>
                    <button
                        onClick={() => { setViewMode('library'); setSelectedPlaylist(null); }}
                        className={`flex items-center gap-2 text-sm mb-6 ${darkMode ? 'text-white/70 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        <ChevronLeft className="w-5 h-5" />
                        Back to Library
                    </button>
                    <div className="flex items-end gap-6">
                        <AlbumCoverLarge seed={selectedPlaylist.cover_seed || selectedPlaylist.id} size="xl" className="w-32 h-32 shadow-2xl" />
                        <div>
                            <p className={`text-xs font-semibold uppercase tracking-wide ${darkMode ? 'text-white/70' : 'text-slate-600'}`}>
                                Playlist
                            </p>
                            <h1 className={`text-4xl font-bold mt-1 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                {selectedPlaylist.name}
                            </h1>
                            {selectedPlaylist.description && (
                                <p className={`mt-1 ${darkMode ? 'text-white/70' : 'text-slate-600'}`}>
                                    {selectedPlaylist.description}
                                </p>
                            )}
                            <p className={`mt-2 ${darkMode ? 'text-white/70' : 'text-slate-600'}`}>
                                {selectedPlaylist.song_count} song{selectedPlaylist.song_count !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Track List */}
                <div className="flex-1 overflow-y-auto px-8 py-6 pb-32">
                    {loading ? (
                        <div className={`text-center py-12 ${mutedTextClass}`}>Loading...</div>
                    ) : selectedPlaylist.songs.length === 0 ? (
                        <div className={`text-center py-16 ${darkMode ? 'text-[#727272]' : 'text-slate-400'}`}>
                            <ListMusic className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <h3 className={`text-xl font-semibold mb-2 ${textClass}`}>This playlist is empty</h3>
                            <p>Add songs from your library</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <AnimatePresence initial={false}>
                                {selectedPlaylist.songs.map(({ job: song }) => (
                                    <TrackCard
                                        key={song.id}
                                        song={song}
                                        showRemove
                                        onRemove={() => handleRemoveFromPlaylist(selectedPlaylist.id, song.id)}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Library main view (playlists list)
    return (
        <div className={`h-full flex flex-col overflow-hidden ${darkMode ? 'bg-[#121212]' : 'bg-slate-50'}`}>
            {/* Header */}
            <div className={`px-8 pt-8 pb-4 shrink-0 ${darkMode ? 'bg-gradient-to-b from-[#1a1a1a] to-transparent' : ''}`}>
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className={`text-4xl font-bold tracking-tighter ${textClass}`}>Your Playlists</h1>
                        <p className={`${mutedTextClass} text-sm mt-1`}>Organize your music</p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-colors ${
                            darkMode
                                ? 'bg-white text-black hover:bg-white/90'
                                : 'bg-slate-900 text-white hover:bg-slate-800'
                        }`}
                    >
                        <Plus className="w-5 h-5" />
                        Create
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-8 pb-32">
                {/* Liked Songs Banner */}
                <div
                    onClick={() => setViewMode('liked')}
                    className={`mb-6 p-4 rounded-xl cursor-pointer transition-all flex items-center gap-4 ${
                        darkMode
                            ? 'bg-gradient-to-r from-[#450af5] to-[#8e2de2] hover:from-[#5011f5] hover:to-[#9e3de2]'
                            : 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600'
                    }`}
                >
                    <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                        <Heart className="w-6 h-6 text-white" fill="white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">Liked Songs</h2>
                        <p className="text-white/80 text-sm">{likedIds.size} song{likedIds.size !== 1 ? 's' : ''}</p>
                    </div>
                </div>

                {/* Playlists */}
                {playlists.length === 0 ? (
                    <div className={`text-center py-16 ${darkMode ? 'text-[#727272]' : 'text-slate-400'}`}>
                        <ListMusic className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <h3 className={`text-xl font-semibold mb-2 ${textClass}`}>Create your first playlist</h3>
                        <p className="mb-6">It's easy, we'll help you</p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className={`px-6 py-3 rounded-full font-semibold transition-colors ${
                                darkMode
                                    ? 'bg-white text-black hover:bg-white/90'
                                    : 'bg-slate-900 text-white hover:bg-slate-800'
                            }`}
                        >
                            Create Playlist
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {playlists.map((playlist) => (
                            <PlaylistCard key={playlist.id} playlist={playlist} />
                        ))}
                    </div>
                )}
            </div>

            {/* Create Playlist Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setShowCreateModal(false)} />
                    <div className={`relative p-8 rounded-2xl shadow-2xl w-full max-w-md ${darkMode ? 'bg-[#282828]' : 'bg-white'}`}>
                        <h3 className={`text-2xl font-bold mb-6 ${textClass}`}>Create Playlist</h3>
                        <input
                            autoFocus
                            type="text"
                            placeholder="My Playlist #1"
                            value={newPlaylistName}
                            onChange={(e) => setNewPlaylistName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
                            className={`w-full px-4 py-3 rounded-lg text-lg mb-6 ${
                                darkMode ? 'bg-[#404040] text-white placeholder-[#727272]' : 'bg-slate-100 placeholder-slate-400'
                            } outline-none focus:ring-2 ring-[#1DB954]`}
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className={`px-6 py-3 rounded-full font-semibold ${
                                    darkMode ? 'text-white hover:bg-[#404040]' : 'text-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreatePlaylist}
                                disabled={!newPlaylistName.trim()}
                                className={`px-8 py-3 rounded-full font-bold disabled:opacity-50 ${
                                    darkMode ? 'bg-[#1DB954] text-black hover:bg-[#1ed760]' : 'bg-cyan-500 text-white hover:bg-cyan-600'
                                }`}
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
