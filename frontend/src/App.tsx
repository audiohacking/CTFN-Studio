import { useState, useEffect } from 'react';
import { api, type LLMModel } from './api';
import type { Job } from './api';
import { ComposerSidebar } from './components/ComposerSidebar';
import type { CompositionData } from './components/ComposerSidebar';
import { HistoryFeed } from './components/HistoryFeed';
import { BottomPlayer, type PreviewAudio, type PreviewPlaybackState } from './components/BottomPlayer';
import { TrackDetailsSidebar } from './components/TrackDetailsSidebar';
import { LibrarySidebar } from './components/LibrarySidebar';
import { AddToPlaylistModal } from './components/AddToPlaylistModal';
import { Moon, Sun, PanelRightOpen, PanelLeftClose, PanelLeftOpen, Heart, ListMusic, Home, Plus, X } from 'lucide-react';
import { HeartMuLaLogo } from './components/HeartMuLaLogo';

type ActiveSection = 'home' | 'favourites' | 'playlists';

function App() {
  const [lyricsModels, setLyricsModels] = useState<LLMModel[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [history, setHistory] = useState<Job[]>([]);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [parentJob, setParentJob] = useState<Job | undefined>(undefined);
  const [reimportData, setReimportData] = useState<{ lyrics?: string; tags?: string; topic?: string } | undefined>(undefined);
  const [isGenerating, setIsGenerating] = useState(false);
  const [queuedJobs, setQueuedJobs] = useState<Map<string, number>>(new Map());
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
  const [playingTrack, setPlayingTrack] = useState<Job | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pauseTrigger, setPauseTrigger] = useState(0);
  const [playTrigger, setPlayTrigger] = useState(0);
  const [showTrackDetails, setShowTrackDetails] = useState(() => {
    // Start with sidebar hidden on mobile
    return window.matchMedia('(min-width: 768px)').matches;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState<ActiveSection>('home');
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [playlistModalSong, setPlaylistModalSong] = useState<Job | null>(null);
  const [selectedLibraryTrack, setSelectedLibraryTrack] = useState<Job | null>(null);
  const [selectedHomeTrack, setSelectedHomeTrack] = useState<Job | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('heartmula_dark_mode');
    return saved ? saved === 'true' : false; // Default to light mode
  });
  const [mobileComposerOpen, setMobileComposerOpen] = useState(false);
  const [previewAudio, setPreviewAudio] = useState<PreviewAudio | null>(null);
  const [previewPlaybackState, setPreviewPlaybackState] = useState<PreviewPlaybackState>({ isPlaying: false, currentTime: 0, duration: 0 });
  const [previewSeekTo, setPreviewSeekTo] = useState<number | undefined>(undefined);
  const [previewPlayPauseTrigger, setPreviewPlayPauseTrigger] = useState(0);

  // Handler for previewing reference audio in the bottom player
  const handlePreviewRefAudio = (url: string, filename: string) => {
    setPreviewAudio({
      url,
      filename,
      onClose: () => setPreviewAudio(null)
    });
  };

  // Clear preview audio (return to normal track mode)
  const handleClearPreviewAudio = () => {
    setPreviewAudio(null);
  };

  // Handlers for modal to control the bottom player
  const handlePreviewSeek = (time: number) => {
    setPreviewSeekTo(time);
  };

  const handlePreviewPlayPause = () => {
    setPreviewPlayPauseTrigger(prev => prev + 1);
  };

  // Apply dark mode class to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('heartmula_dark_mode', darkMode.toString());
  }, [darkMode]);

  // Update sidebar when playing track changes (desktop only)
  useEffect(() => {
    if (playingTrack) {
      // Only auto-show sidebar on desktop (md breakpoint = 768px)
      const isDesktop = window.matchMedia('(min-width: 768px)').matches;
      if (isDesktop) {
        setSelectedHomeTrack(playingTrack);
      }
    }
  }, [playingTrack?.id]);

  // Initial Load with retry
  useEffect(() => {
    const loadModelsAndLanguages = async (retries = 3) => {
      try {
        const [models, langs] = await Promise.all([
          api.getLyricsModels(),
          api.getLanguages()
        ]);
        setLyricsModels(models);
        setLanguages(langs);
      } catch (e) {
        console.error("Failed to load models/languages:", e);
        if (retries > 0) {
          setTimeout(() => loadModelsAndLanguages(retries - 1), 1000);
        }
      }
    };
    loadModelsAndLanguages();
    refreshHistory();
    loadLikedIds();
  }, []);

  const loadLikedIds = async () => {
    try {
      const ids = await api.getLikedSongIds();
      setLikedIds(new Set(ids));
    } catch (e) {
      console.error("Failed to load liked songs:", e);
    }
  };

  const handleToggleLike = async (jobId: string, isCurrentlyLiked: boolean) => {
    try {
      if (isCurrentlyLiked) {
        await api.unlikeSong(jobId);
        setLikedIds(prev => {
          const next = new Set(prev);
          next.delete(jobId);
          return next;
        });
      } else {
        await api.likeSong(jobId);
        setLikedIds(prev => new Set(prev).add(jobId));
      }
    } catch (e) {
      console.error("Failed to toggle like:", e);
    }
  };

  // SSE Connection
  useEffect(() => {
    const evtSource = api.connectToEvents((e) => {
      try {
        const type = e.type;
        const data = JSON.parse(e.data);

        if (type === 'job_update') {
          if (data.status === 'completed') {
            setQueuedJobs(prev => {
              const next = new Map(prev);
              next.delete(data.job_id);
              return next;
            });
            setQueuedJobs(prev => {
              if (prev.size === 0) setIsGenerating(false);
              return prev;
            });
            if (currentJobId === data.job_id) setCurrentJobId(null);
            refreshHistory();
          } else if (data.status === 'failed') {
            setQueuedJobs(prev => {
              const next = new Map(prev);
              next.delete(data.job_id);
              if (next.size === 0) setIsGenerating(false);
              return next;
            });
            if (currentJobId === data.job_id) setCurrentJobId(null);
            alert(`Generation Failed: ${data.error || "Unknown error"}`);
            refreshHistory();
          } else if (data.status === 'processing') {
            setCurrentJobId(data.job_id);
            setIsGenerating(true);
            setQueuedJobs(prev => {
              const next = new Map(prev);
              next.delete(data.job_id);
              return next;
            });
            refreshHistory();
          }
        }

        if (type === 'job_queued') {
          setQueuedJobs(prev => {
            const next = new Map(prev);
            next.set(data.job_id, data.position);
            return next;
          });
          refreshHistory();
        }

        if (type === 'job_queue') {
          setQueuedJobs(prev => {
            const next = new Map(prev);
            if (next.has(data.job_id)) {
              next.set(data.job_id, data.position);
            }
            return next;
          });
        }

        if (type === 'job_progress') {
          window.dispatchEvent(new CustomEvent('heartmula_progress', { detail: data }));
        }
      } catch (err) {
        console.error("SSE Parse Error", err);
      }
    });

    return () => evtSource.close();
  }, []);

  const refreshHistory = async () => {
    try {
      const jobs = await api.getHistory();
      const sorted = jobs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setHistory(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(sorted)) return sorted;
        return prev;
      });
    } catch (e) {
      console.error("Failed to fetch history", e);
    }
  };

  const handleGenerateMusic = async (data: CompositionData) => {
    try {
      const { job_id } = await api.generateJob(
        data.topic,
        data.durationMs,
        data.lyrics,
        data.tags,
        data.cfgScale,
        parentJob?.id,
        data.seed,  // Use custom seed from sidebar (or parent's seed if extending)
        data.refAudioId,
        data.styleInfluence,
        data.refAudioStartSec
      );
      setQueuedJobs(prev => {
        const next = new Map(prev);
        next.set(job_id, prev.size + 1);
        return next;
      });
      setParentJob(undefined);
      refreshHistory();
    } catch (e: any) {
      alert("Generation failed: " + e.message);
    }
  };

  const handleGenerateLyrics = async (topic: string, modelId: string, provider: string, language: string, currentLyrics?: string) => {
    setIsGeneratingLyrics(true);
    try {
      const result = await api.generateLyrics(topic, modelId, provider, currentLyrics, language);
      return result;
    } finally {
      setIsGeneratingLyrics(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    if (!confirm("Are you sure you want to stop generation?")) return;
    try {
      await api.cancelJob(jobId);
      setIsGenerating(false);
      setCurrentJobId(null);
    } catch (e) {
      console.error("Failed to cancel", e);
      alert("Failed to cancel job");
    }
  };

  const handleExtendJob = (job: Job) => {
    setParentJob(job);
    setReimportData(undefined);
    setActiveSection('home');
  };

  const handleReimportJob = (job: Job) => {
    setReimportData({ lyrics: job.lyrics, tags: job.tags, topic: job.prompt });
    setParentJob(undefined);
    setActiveSection('home');
  };

  const handleClearReimport = () => setReimportData(undefined);
  const handleClearParentJob = () => setParentJob(undefined);

  const handleRetryJob = async (job: Job) => {
    try {
      const { job_id } = await api.generateJob(
        job.prompt,
        job.duration_ms || 30000,
        job.lyrics,
        job.tags,
        1.5,
        undefined,
        job.seed
      );
      setQueuedJobs(prev => {
        const next = new Map(prev);
        next.set(job_id, prev.size + 1);
        return next;
      });
      refreshHistory();
    } catch (e: any) {
      alert("Retry failed: " + e.message);
    }
  };

  const handlePlayTrack = (job: Job) => {
    if (job.status === 'completed' && job.audio_path) {
      setPlayingTrack(job);
      setPlayTrigger(p => p + 1);
    }
  };

  const completedTracks = history.filter(j => j.status === 'completed' && j.audio_path);
  const lastCompletedTrack = completedTracks[0] || null;
  const displayTrack = playingTrack || lastCompletedTrack;

  const handleNextTrack = () => {
    if (!playingTrack || completedTracks.length === 0) return;
    const currentIndex = completedTracks.findIndex(t => t.id === playingTrack.id);
    const nextIndex = (currentIndex + 1) % completedTracks.length;
    setPlayingTrack(completedTracks[nextIndex]);
  };

  const handlePrevTrack = () => {
    if (!playingTrack || completedTracks.length === 0) return;
    const currentIndex = completedTracks.findIndex(t => t.id === playingTrack.id);
    const prevIndex = currentIndex <= 0 ? completedTracks.length - 1 : currentIndex - 1;
    setPlayingTrack(completedTracks[prevIndex]);
  };

  const navItems = [
    { id: 'home' as const, label: 'Home', icon: Home },
    { id: 'favourites' as const, label: 'Favourites', icon: Heart },
    { id: 'playlists' as const, label: 'Playlists', icon: ListMusic },
  ];

  return (
    <div className={`h-screen w-full flex flex-col overflow-hidden font-sans transition-colors duration-300 ${darkMode ? 'bg-[#121212] text-white' : 'bg-slate-50 text-slate-900'}`}>
      {/* Header */}
      <header className={`h-14 flex items-center justify-between px-2 sm:px-4 border-b flex-shrink-0 ${darkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'}`}>
        {/* Left: Logo & Collapse Toggle */}
        <div className="flex items-center gap-1 sm:gap-3">
          {activeSection === 'home' && (
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`hidden md:flex p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-[#282828] text-[#b3b3b3] hover:text-white' : 'hover:bg-slate-100 text-slate-500'}`}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>
          )}
          <HeartMuLaLogo size={28} showText className="hidden sm:flex" darkMode={darkMode} />
          <HeartMuLaLogo size={28} showText={false} className="sm:hidden" darkMode={darkMode} />
        </div>

        {/* Center: Navigation Tabs */}
        <nav className="flex items-center gap-0.5 sm:gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-full font-medium text-sm transition-all ${
                  isActive
                    ? darkMode
                      ? 'bg-white text-black'
                      : 'bg-slate-900 text-white'
                    : darkMode
                      ? 'text-[#b3b3b3] hover:text-white hover:bg-[#282828]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Dark Mode Toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className={`p-2 rounded-full transition-all ${darkMode ? 'bg-[#282828] hover:bg-[#3E3E3E] text-[#1DB954]' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden pb-20 sm:pb-24">
        {/* Left Sidebar: Composer - Desktop (collapsible, hidden on favourites/playlists) */}
        {activeSection === 'home' && (
          <aside
            className={`hidden md:block h-full flex-shrink-0 transition-all duration-300 overflow-hidden ${
              darkMode ? 'bg-[#121212] border-r border-[#282828]' : 'bg-white border-r border-slate-200'
            } ${sidebarCollapsed ? 'w-0' : 'w-[380px]'}`}
          >
            <div className="w-[380px] h-full">
              <ComposerSidebar
                onGenerate={handleGenerateMusic}
                isGenerating={isGenerating}
                lyricsModels={lyricsModels}
                languages={languages}
                onGenerateLyrics={handleGenerateLyrics}
                isGeneratingLyrics={isGeneratingLyrics}
                currentJobId={currentJobId || undefined}
                onCancel={handleCancelJob}
                parentJob={parentJob}
                onClearParentJob={handleClearParentJob}
                reimportData={reimportData}
                onClearReimport={handleClearReimport}
                darkMode={darkMode}
                onPreviewRefAudio={handlePreviewRefAudio}
                onClearPreviewAudio={handleClearPreviewAudio}
                previewPlaybackState={previewAudio ? previewPlaybackState : undefined}
                onPreviewSeek={handlePreviewSeek}
                onPreviewPlayPause={handlePreviewPlayPause}
              />
            </div>
          </aside>
        )}

        {/* Mobile Composer Overlay - Full Screen */}
        {activeSection === 'home' && mobileComposerOpen && (
          <div className="md:hidden fixed inset-0 z-50">
            {/* Full screen sidebar */}
            <aside className={`relative w-full h-full ${darkMode ? 'bg-[#121212]' : 'bg-white'}`}>
              <button
                onClick={() => setMobileComposerOpen(false)}
                className={`absolute top-3 right-3 z-10 p-2 rounded-full ${darkMode ? 'bg-[#282828] text-white hover:bg-[#383838]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                <X className="w-5 h-5" />
              </button>
              <ComposerSidebar
                onGenerate={(data) => {
                  handleGenerateMusic(data);
                  setMobileComposerOpen(false);
                }}
                isGenerating={isGenerating}
                lyricsModels={lyricsModels}
                languages={languages}
                onGenerateLyrics={handleGenerateLyrics}
                isGeneratingLyrics={isGeneratingLyrics}
                currentJobId={currentJobId || undefined}
                onCancel={handleCancelJob}
                parentJob={parentJob}
                onClearParentJob={handleClearParentJob}
                reimportData={reimportData}
                onClearReimport={handleClearReimport}
                darkMode={darkMode}
                onPreviewRefAudio={handlePreviewRefAudio}
                onClearPreviewAudio={handleClearPreviewAudio}
                previewPlaybackState={previewAudio ? previewPlaybackState : undefined}
                onPreviewSeek={handlePreviewSeek}
                onPreviewPlayPause={handlePreviewPlayPause}
              />
            </aside>
          </div>
        )}

        {/* Main Content Area */}
        <main className={`flex-1 h-full relative overflow-hidden ${darkMode ? 'bg-[#121212]' : ''}`}>
          {!darkMode && <div className="absolute inset-0 mesh-bg opacity-30 -z-10" />}

          {/* Toggle Details Button */}
          {(() => {
            const shouldShowButton = (activeSection === 'favourites' || activeSection === 'playlists')
              ? selectedLibraryTrack && !showTrackDetails
              : playingTrack && !showTrackDetails;

            if (!shouldShowButton) return null;

            return (
              <button
                onClick={() => setShowTrackDetails(true)}
                className={`absolute top-4 right-4 z-20 p-2 rounded-full transition-all ${darkMode ? 'bg-[#282828] hover:bg-[#3E3E3E] text-[#b3b3b3] hover:text-white' : 'bg-white hover:bg-slate-100 text-slate-500 shadow-lg'}`}
                title="Show track details"
              >
                <PanelRightOpen className="w-5 h-5" />
              </button>
            );
          })()}

          {/* Content based on active section */}
          {activeSection === 'home' && (
            <HistoryFeed
              history={history}
              currentJobId={currentJobId}
              onRefresh={refreshHistory}
              onExtend={handleExtendJob}
              onReimport={handleReimportJob}
              onRetry={handleRetryJob}
              onPlayTrack={handlePlayTrack}
              onPauseTrack={() => setPauseTrigger(p => p + 1)}
              playingTrackId={playingTrack?.id}
              isTrackPlaying={isPlaying}
              queuedJobs={queuedJobs}
              darkMode={darkMode}
              likedIds={likedIds}
              onToggleLike={handleToggleLike}
              onAddToPlaylist={(job) => setPlaylistModalSong(job)}
              onSelectTrack={(job) => {
                setSelectedHomeTrack(job);
                // Only auto-show sidebar on desktop
                const isDesktop = window.matchMedia('(min-width: 768px)').matches;
                if (isDesktop) {
                  setShowTrackDetails(true);
                }
              }}
              selectedTrackId={selectedHomeTrack?.id}
            />
          )}

          {(activeSection === 'favourites' || activeSection === 'playlists') && (
            <div className="h-full">
              <LibrarySidebar
                darkMode={darkMode}
                likedIds={likedIds}
                onPlayTrack={handlePlayTrack}
                onPauseTrack={() => setPauseTrigger(p => p + 1)}
                playingTrackId={playingTrack?.id}
                isTrackPlaying={isPlaying}
                onRefreshLikes={loadLikedIds}
                initialView={activeSection === 'favourites' ? 'liked' : 'library'}
                onSelectTrack={(track) => setSelectedLibraryTrack(track)}
                selectedTrackId={selectedLibraryTrack?.id}
                onToggleLike={handleToggleLike}
                onAddToPlaylist={(job) => setPlaylistModalSong(job)}
              />
            </div>
          )}
        </main>

        {/* Right Sidebar: Track Details */}
        {(() => {
          // Determine which track to show in sidebar
          const trackForSidebar = (activeSection === 'favourites' || activeSection === 'playlists')
            ? selectedLibraryTrack
            : (selectedHomeTrack || playingTrack);

          if (!trackForSidebar || !showTrackDetails) return null;

          return (
            <TrackDetailsSidebar
              track={trackForSidebar}
              onClose={() => {
                setShowTrackDetails(false);
                setSelectedLibraryTrack(null);
                setSelectedHomeTrack(null);
              }}
              darkMode={darkMode}
              isLiked={likedIds.has(trackForSidebar.id)}
              onToggleLike={() => handleToggleLike(trackForSidebar.id, likedIds.has(trackForSidebar.id))}
              onAddToPlaylist={() => setPlaylistModalSong(trackForSidebar)}
            />
          );
        })()}
      </div>

      {/* Mobile Floating Action Button - Create New Track */}
      {activeSection === 'home' && (
        <button
          onClick={() => setMobileComposerOpen(true)}
          className={`md:hidden fixed bottom-28 right-4 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95 ${
            darkMode
              ? 'bg-[#1DB954] text-black hover:bg-[#1ed760]'
              : 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-cyan-500/25'
          }`}
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Bottom Player */}
      <BottomPlayer
        currentTrack={displayTrack}
        onNext={handleNextTrack}
        onPrev={handlePrevTrack}
        darkMode={darkMode}
        onPlayStateChange={setIsPlaying}
        pauseTrigger={pauseTrigger}
        playTrigger={playTrigger}
        isLiked={displayTrack ? likedIds.has(displayTrack.id) : false}
        onToggleLike={() => displayTrack && handleToggleLike(displayTrack.id, likedIds.has(displayTrack.id))}
        onAddToPlaylist={() => displayTrack && setPlaylistModalSong(displayTrack)}
        onTrackClick={(track) => {
          setSelectedHomeTrack(track);
          setShowTrackDetails(true);
        }}
        previewAudio={previewAudio}
        onPreviewPlaybackChange={setPreviewPlaybackState}
        previewSeekTo={previewSeekTo}
        previewPlayPauseTrigger={previewPlayPauseTrigger}
      />

      {/* Add to Playlist Modal */}
      <AddToPlaylistModal
        isOpen={playlistModalSong !== null}
        onClose={() => setPlaylistModalSong(null)}
        song={playlistModalSong}
        darkMode={darkMode}
      />
    </div>
  );
}

export default App;
