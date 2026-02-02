import { HeartMuLaLogo } from './HeartMuLaLogo';
import type { StartupStatus, GPUStatus } from '../api';

interface StartupScreenProps {
    status: StartupStatus | null;
    darkMode: boolean;
    gpuStatus?: GPUStatus | null;
}

export function StartupScreen({ status, darkMode, gpuStatus }: StartupScreenProps) {
    const progress = status?.progress ?? 0;
    const message = status?.message ?? 'Initializing...';
    const currentStatus = status?.status ?? 'not_started';
    const isError = currentStatus === 'error';

    // Get status-specific styles
    const getStatusColor = () => {
        if (isError) return darkMode ? 'bg-red-500' : 'bg-red-500';
        return darkMode ? 'bg-[#1DB954]' : 'bg-gradient-to-r from-cyan-500 to-indigo-500';
    };

    // Get status label
    const getStatusLabel = () => {
        switch (currentStatus) {
            case 'not_started':
                return 'Starting...';
            case 'downloading':
                return 'Downloading Models';
            case 'loading':
                return 'Loading Models';
            case 'ready':
                return 'Ready';
            case 'error':
                return 'Error';
            default:
                return 'Initializing';
        }
    };

    return (
        <div className={`fixed inset-0 z-[200] flex flex-col items-center justify-center transition-colors duration-300 ${
            darkMode ? 'bg-[#121212]' : 'bg-slate-50'
        }`}>
            {/* Animated background gradient */}
            {!darkMode && (
                <div className="absolute inset-0 opacity-30">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-100 via-indigo-100 to-purple-100 animate-pulse" />
                </div>
            )}

            <div className="relative z-10 flex flex-col items-center max-w-md w-full px-8">
                {/* Logo with animation */}
                <div className={`mb-8 transform transition-transform duration-1000 ${
                    currentStatus === 'ready' ? 'scale-110' : 'scale-100'
                }`}>
                    <HeartMuLaLogo
                        size={80}
                        showText={false}
                        darkMode={darkMode}
                        className={currentStatus === 'loading' || currentStatus === 'downloading' ? 'animate-pulse' : ''}
                    />
                </div>

                {/* Title */}
                <h1 className={`text-2xl font-bold mb-2 ${
                    darkMode ? 'text-white' : 'text-slate-900'
                }`}>
                    CTFN Studio
                </h1>

                {/* Status Label */}
                <div className={`text-sm font-medium mb-6 px-3 py-1 rounded-full ${
                    isError
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : currentStatus === 'ready'
                            ? darkMode
                                ? 'bg-[#1DB954]/20 text-[#1DB954]'
                                : 'bg-cyan-100 text-cyan-700'
                            : darkMode
                                ? 'bg-[#282828] text-[#b3b3b3]'
                                : 'bg-slate-200 text-slate-600'
                }`}>
                    {getStatusLabel()}
                </div>

                {/* Progress Bar Container */}
                <div className={`w-full h-2 rounded-full overflow-hidden mb-4 ${
                    darkMode ? 'bg-[#282828]' : 'bg-slate-200'
                }`}>
                    {/* Progress Bar Fill */}
                    <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${getStatusColor()} ${
                            currentStatus === 'downloading' ? 'animate-pulse' : ''
                        }`}
                        style={{ width: `${Math.max(progress, currentStatus === 'downloading' ? 5 : 0)}%` }}
                    />
                </div>

                {/* Progress Percentage */}
                <div className={`text-lg font-semibold mb-2 ${
                    darkMode ? 'text-white' : 'text-slate-900'
                }`}>
                    {isError ? '' : `${progress}%`}
                </div>

                {/* Status Message */}
                <p className={`text-sm text-center mb-6 min-h-[40px] ${
                    isError
                        ? 'text-red-500'
                        : darkMode
                            ? 'text-[#b3b3b3]'
                            : 'text-slate-600'
                }`}>
                    {message}
                </p>

                {/* Error details */}
                {isError && status?.error && (
                    <div className={`w-full p-4 rounded-lg mb-6 text-sm ${
                        darkMode
                            ? 'bg-red-900/20 border border-red-800 text-red-400'
                            : 'bg-red-50 border border-red-200 text-red-700'
                    }`}>
                        <p className="font-medium mb-1">Error Details:</p>
                        <p className="opacity-80 break-words">{status.error}</p>
                    </div>
                )}

                {/* GPU Info */}
                {gpuStatus && gpuStatus.cuda_available && (
                    <div className={`w-full p-4 rounded-lg ${
                        darkMode ? 'bg-[#181818] border border-[#282828]' : 'bg-white border border-slate-200 shadow-sm'
                    }`}>
                        <div className={`text-xs uppercase tracking-wide mb-2 ${
                            darkMode ? 'text-[#b3b3b3]' : 'text-slate-500'
                        }`}>
                            Detected Hardware
                        </div>
                        {gpuStatus.gpus.map((gpu) => (
                            <div key={gpu.index} className="flex items-center gap-2 mb-1 last:mb-0">
                                <span className={`text-sm ${
                                    darkMode ? 'text-white' : 'text-slate-900'
                                }`}>
                                    {gpu.name}
                                </span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                    darkMode ? 'bg-[#282828] text-[#b3b3b3]' : 'bg-slate-100 text-slate-600'
                                }`}>
                                    {gpu.vram_gb} GB
                                </span>
                                {gpu.supports_flash_attention && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                                        darkMode ? 'bg-[#1DB954]/20 text-[#1DB954]' : 'bg-cyan-100 text-cyan-700'
                                    }`}>
                                        Flash OK
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Retry button for errors */}
                {isError && (
                    <button
                        onClick={() => window.location.reload()}
                        className={`mt-4 px-6 py-2 rounded-full font-medium transition-colors ${
                            darkMode
                                ? 'bg-[#1DB954] text-black hover:bg-[#1ed760]'
                                : 'bg-slate-900 text-white hover:bg-slate-800'
                        }`}
                    >
                        Retry
                    </button>
                )}
            </div>
        </div>
    );
}
