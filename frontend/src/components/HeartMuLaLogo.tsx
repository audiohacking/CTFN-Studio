import React from 'react';

interface HeartMuLaLogoProps {
    size?: number;
    className?: string;
    showText?: boolean;
    darkMode?: boolean;
}

export const HeartMuLaLogo: React.FC<HeartMuLaLogoProps> = ({
    size = 32,
    className = '',
    showText = false,
    darkMode = false
}) => {
    return (
        <div className={`flex items-center gap-2.5 ${className}`}>
            {/* Logo Icon */}
            <svg
                width={size}
                height={size}
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="shrink-0"
            >
                {/* Background circle */}
                <circle
                    cx="24"
                    cy="24"
                    r="24"
                    fill={darkMode ? '#1DB954' : 'url(#heartmula-gradient)'}
                />

                {/* Heart shape with sound waves integrated */}
                <g transform="translate(8, 10)">
                    {/* Main heart path */}
                    <path
                        d="M16 28C16 28 4 20 4 11C4 6.5 7.5 3 12 3C14.5 3 16.5 4 16 6C15.5 4 17.5 3 20 3C24.5 3 28 6.5 28 11C28 20 16 28 16 28Z"
                        fill="white"
                        fillOpacity="0.95"
                    />

                    {/* Sound wave bars inside heart */}
                    <rect x="10" y="10" width="2.5" height="8" rx="1.25" fill={darkMode ? '#1DB954' : '#6366f1'} />
                    <rect x="14.5" y="7" width="2.5" height="14" rx="1.25" fill={darkMode ? '#1DB954' : '#8b5cf6'} />
                    <rect x="19" y="9" width="2.5" height="10" rx="1.25" fill={darkMode ? '#1DB954' : '#a855f7'} />
                </g>

                {/* Gradient definition */}
                <defs>
                    <linearGradient id="heartmula-gradient" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#06b6d4" />
                        <stop offset="50%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                </defs>
            </svg>

            {/* Text */}
            {showText && (
                <span className={`font-bold text-lg tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                    Heart<span className={darkMode ? 'text-[#1DB954]' : 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-purple-500'}>MuLa</span>
                </span>
            )}
        </div>
    );
};

// Standalone icon version for favicon/smaller uses
export const HeartMuLaIcon: React.FC<{ size?: number; darkMode?: boolean }> = ({ size = 24, darkMode = false }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <circle
            cx="24"
            cy="24"
            r="24"
            fill={darkMode ? '#1DB954' : 'url(#heartmula-icon-gradient)'}
        />
        <g transform="translate(8, 10)">
            <path
                d="M16 28C16 28 4 20 4 11C4 6.5 7.5 3 12 3C14.5 3 16.5 4 16 6C15.5 4 17.5 3 20 3C24.5 3 28 6.5 28 11C28 20 16 28 16 28Z"
                fill="white"
                fillOpacity="0.95"
            />
            <rect x="10" y="10" width="2.5" height="8" rx="1.25" fill={darkMode ? '#1DB954' : '#6366f1'} />
            <rect x="14.5" y="7" width="2.5" height="14" rx="1.25" fill={darkMode ? '#1DB954' : '#8b5cf6'} />
            <rect x="19" y="9" width="2.5" height="10" rx="1.25" fill={darkMode ? '#1DB954' : '#a855f7'} />
        </g>
        <defs>
            <linearGradient id="heartmula-icon-gradient" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="50%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
        </defs>
    </svg>
);
