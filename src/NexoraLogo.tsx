import React from 'react';
import { Language } from './i18n';

interface NexoraLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  theme?: 'dark' | 'light'; // 'dark' = for dark backgrounds (white text), 'light' = for light backgrounds (dark text)
  showText?: boolean;
  showSubtitle?: boolean;
  subtitle?: string;
  lang?: Language;
  className?: string;
}

export const NexoraLogoIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 36,
  className = ''
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-transform duration-200 ${className}`}
    >
      <defs>
        <linearGradient id="nexora_g1" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id="nexora_g2" x1="40" y1="6" x2="8" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="50%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#1E1B4B" />
        </linearGradient>
        <linearGradient id="nexora_beam" x1="12" y1="8" x2="36" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F0F9FF" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#60A5FA" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.2" />
        </linearGradient>
        <filter id="nexora_glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#3B82F6" floodOpacity="0.35" />
        </filter>
      </defs>

      <rect
        x="2"
        y="2"
        width="44"
        height="44"
        rx="13"
        fill="#0F172A"
        stroke="url(#nexora_g1)"
        strokeWidth="1.5"
        strokeOpacity="0.6"
      />

      <circle cx="24" cy="24" r="15" stroke="url(#nexora_g1)" strokeWidth="0.8" strokeDasharray="2 3" strokeOpacity="0.25" />

      <path
        d="M13 35V13C13 11.8954 13.8954 11 15 11H17.5C18.6046 11 19.5 11.8954 19.5 13V35C19.5 36.1046 18.6046 37 17.5 37H15C13.8954 37 13 36.1046 13 35Z"
        fill="url(#nexora_g1)"
      />

      <path
        d="M16 12L31.8 35.2C32.4 36.1 33.6 36.5 34.6 36.1C35.5 35.7 36 34.8 36 33.8V13"
        stroke="url(#nexora_beam)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#nexora_glow)"
      />

      <path
        d="M28.5 35V13C28.5 11.8954 29.3954 11 30.5 11H33C34.1046 11 35 11.8954 35 13V35C35 36.1046 34.1046 37 33 37H30.5C29.3954 37 28.5 36.1046 28.5 35Z"
        fill="url(#nexora_g2)"
      />

      <circle cx="16.25" cy="14" r="2.2" fill="#FFFFFF" />
      <circle cx="31.75" cy="34" r="2.2" fill="#38BDF8" />
      <circle cx="24" cy="24" r="1.8" fill="#A5B4FC" />
    </svg>
  );
};

export const NexoraLogo: React.FC<NexoraLogoProps> = ({
  size = 'md',
  theme = 'dark',
  showText = true,
  showSubtitle = false,
  subtitle,
  lang = 'en',
  className = ''
}) => {
  const iconPixelSizes = {
    sm: 28,
    md: 36,
    lg: 44,
    xl: 52
  };

  const titleSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl'
  };

  const pmoBadgeSizes = {
    sm: 'text-[9px] px-1.5 py-0.5',
    md: 'text-[10px] px-2 py-0.5',
    lg: 'text-[11px] px-2.5 py-0.5',
    xl: 'text-xs px-3 py-1'
  };

  const textColor = theme === 'dark' ? 'text-white' : 'text-slate-900';
  const subtitleColor = theme === 'dark' ? 'text-slate-400' : 'text-slate-500';
  const isAr = lang === 'ar';

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      <NexoraLogoIcon size={iconPixelSizes[size]} />

      {showText && (
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <span
              className={`font-display font-extrabold tracking-tight ${titleSizes[size]} ${textColor} leading-none`}
            >
              {isAr ? 'نكسورا' : 'NEXORA'}
            </span>
            <span
              className={`font-bold rounded-md bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-xs shadow-blue-500/25 ${pmoBadgeSizes[size]} leading-none ${isAr ? '' : 'font-mono uppercase tracking-wider'}`}
            >
              {isAr ? 'مكتب المشاريع' : 'PMO'}
            </span>
          </div>
          {showSubtitle && (
            <span className={`text-[11px] font-medium mt-1 leading-tight ${subtitleColor}`}>
              {subtitle || (isAr ? 'مكتب إدارة المحافظ والمشاريع' : 'Portfolio Management Office')}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
