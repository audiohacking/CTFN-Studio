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
            {/* Logo Icon - CTFN branding */}
            <img
                src="/ctfn-icon.png"
                alt="CTFN Studio"
                width={size}
                height={size}
                className="shrink-0 object-contain"
            />

            {/* Text */}
            {showText && (
                <span className={`font-bold text-lg tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                    CTFN Studio
                </span>
            )}
        </div>
    );
};

// Standalone icon version for favicon/smaller uses
export const HeartMuLaIcon: React.FC<{ size?: number; darkMode?: boolean }> = ({ size = 24 }) => (
    <img
        src="/ctfn-icon.png"
        alt="CTFN Studio"
        width={size}
        height={size}
        className="object-contain"
    />
);
