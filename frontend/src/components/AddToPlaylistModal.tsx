import React, { useState, useEffect } from 'react';
import { X, Plus, ListMusic, Check } from 'lucide-react';
import { api, type Playlist, type Job } from '../api';
import { AlbumCover } from './AlbumCover';

interface AddToPlaylistModalProps {
    isOpen: boolean;
    onClose: () => void;
    song: Job | null;
    darkMode?: boolean;
    onPlaylistCreated?: () => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
    isOpen,
    onClose,
    song,
    darkMode = false,
    onPlaylistCreated
}) => {
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [addedTo, setAddedTo] = useState<Set<string>>(new Set());
    const [addingTo, setAddingTo] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadPlaylists();
            setAddedTo(new Set());
        }
    }, [isOpen]);

    const loadPlaylists = async () => {
        setLoading(true);
        try {
            const data = await api.getPlaylists();
            setPlaylists(data);
        } catch (e) {
            console.error('Failed to load playlists', e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePlaylist = async () => {
        if (!newPlaylistName.trim()) return;
        setCreating(true);
        try {
            const newPlaylist = await api.createPlaylist(newPlaylistName.trim());
            setPlaylists(prev => [newPlaylist, ...prev]);
            setNewPlaylistName('');
            onPlaylistCreated?.();
        } catch (e) {
            console.error('Failed to create playlist', e);
        } finally {
            setCreating(false);
        }
    };

    const handleAddToPlaylist = async (playlistId: string) => {
        if (!song || addingTo) return;
        setAddingTo(playlistId);
        try {
            await api.addSongToPlaylist(playlistId, song.id);
            setAddedTo(prev => new Set(prev).add(playlistId));
        } catch (e) {
            console.error('Failed to add to playlist', e);
        } finally {
            setAddingTo(null);
        }
    };

    if (!isOpen || !song) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className={`relative w-full max-w-md mx-4 rounded-xl shadow-2xl overflow-hidden ${
                darkMode ? 'bg-[#282828]' : 'bg-white'
            }`}>
                {/* Header */}
                <div className={`p-4 border-b ${darkMode ? 'border-[#404040]' : 'border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                        <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                            Add to Playlist
                        </h2>
                        <button
                            onClick={onClose}
                            className={`p-2 rounded-full transition-colors ${
                                darkMode ? 'hover:bg-[#404040] text-[#b3b3b3]' : 'hover:bg-slate-100 text-slate-500'
                            }`}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Song info */}
                    <div className="flex items-center gap-3 mt-3">
                        <AlbumCover seed={song.id} size="md" />
                        <div className="min-w-0">
                            <p className={`font-medium truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                {song.title || song.prompt || 'Untitled'}
                            </p>
                            <p className={`text-sm truncate ${darkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
                                {song.tags || 'AI Generated'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Create new playlist */}
                <div className={`p-4 border-b ${darkMode ? 'border-[#404040]' : 'border-slate-200'}`}>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="New playlist name..."
                            value={newPlaylistName}
                            onChange={(e) => setNewPlaylistName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                                darkMode
                                    ? 'bg-[#404040] text-white placeholder-[#727272] focus:ring-2 ring-[#1DB954]'
                                    : 'bg-slate-100 text-slate-900 placeholder-slate-400 focus:ring-2 ring-cyan-500'
                            } outline-none`}
                        />
                        <button
                            onClick={handleCreatePlaylist}
                            disabled={!newPlaylistName.trim() || creating}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${
                                darkMode
                                    ? 'bg-[#1DB954] text-black hover:bg-[#1ed760]'
                                    : 'bg-cyan-500 text-white hover:bg-cyan-600'
                            }`}
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Playlists list */}
                <div className="max-h-[300px] overflow-y-auto">
                    {loading ? (
                        <div className={`p-8 text-center ${darkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
                            Loading playlists...
                        </div>
                    ) : playlists.length === 0 ? (
                        <div className={`p-8 text-center ${darkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
                            <ListMusic className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No playlists yet</p>
                            <p className="text-sm mt-1">Create one above!</p>
                        </div>
                    ) : (
                        <div className="p-2">
                            {playlists.map((playlist) => {
                                const isAdded = addedTo.has(playlist.id);
                                const isAdding = addingTo === playlist.id;

                                return (
                                    <button
                                        key={playlist.id}
                                        onClick={() => !isAdded && handleAddToPlaylist(playlist.id)}
                                        disabled={isAdded || isAdding}
                                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                                            isAdded
                                                ? darkMode ? 'bg-[#1DB954]/20' : 'bg-green-50'
                                                : darkMode
                                                    ? 'hover:bg-[#404040]'
                                                    : 'hover:bg-slate-100'
                                        }`}
                                    >
                                        <AlbumCover seed={playlist.cover_seed || playlist.id} size="sm" />
                                        <div className="flex-1 text-left min-w-0">
                                            <p className={`font-medium truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                                {playlist.name}
                                            </p>
                                            <p className={`text-xs ${darkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
                                                {playlist.song_count} song{playlist.song_count !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                        {isAdded ? (
                                            <Check className={`w-5 h-5 ${darkMode ? 'text-[#1DB954]' : 'text-green-500'}`} />
                                        ) : isAdding ? (
                                            <div className={`w-5 h-5 border-2 border-t-transparent rounded-full animate-spin ${
                                                darkMode ? 'border-[#1DB954]' : 'border-cyan-500'
                                            }`} />
                                        ) : (
                                            <Plus className={`w-5 h-5 ${darkMode ? 'text-[#b3b3b3]' : 'text-slate-400'}`} />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
