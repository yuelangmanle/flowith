// ─── Flowith SVG Icon System ──────────────────────────────────
// Replaces all emoji icons with clean, consistent SVG icons.

import React from "react";

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const ic = (d: string, vb = "0 0 24 24") =>
  ({ size = 16, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox={vb} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
      <path d={d} fillRule="evenodd" clipRule="evenodd" fill="currentColor" />
    </svg>
  );

// ─── Provider Icons ───────────────────────────────────────────

export const OpenAIIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <circle cx="12" cy="12" r="10" stroke="#10a37f" strokeWidth="2" fill="none"/>
    <path d="M15.5 9.5c-.5-1.5-2-2.5-3.5-2.5s-3 1-3.5 2.5c-.5 1.5 0 3 1 4l2.5 1.5 2.5-1.5c1-1 1.5-2.5 1-4z" fill="#10a37f"/>
  </svg>
);

export const AnthropicIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <rect x="3" y="3" width="18" height="18" rx="4" stroke="#d97706" strokeWidth="2" fill="none"/>
    <path d="M8 16l4-8 4 8M9.5 13h5" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const GeminiIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M12 2L15 8.5L22 12L15 15.5L12 22L9 15.5L2 12L9 8.5L12 2Z" fill="#4285f4"/>
  </svg>
);

export const DeepSeekIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <circle cx="12" cy="12" r="9" stroke="#7c3aed" strokeWidth="2" fill="none"/>
    <circle cx="12" cy="12" r="3" fill="#7c3aed"/>
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const QwenIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <rect x="4" y="4" width="16" height="16" rx="3" stroke="#eab308" strokeWidth="2" fill="none"/>
    <path d="M8 8h8M8 12h6M8 16h4" stroke="#eab308" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const MoonshotIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="#6366f1"/>
  </svg>
);

export const OllamaIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <circle cx="12" cy="12" r="10" stroke="#16a34a" strokeWidth="2" fill="none"/>
    <circle cx="9" cy="10" r="1.5" fill="#16a34a"/>
    <circle cx="15" cy="10" r="1.5" fill="#16a34a"/>
    <path d="M8 15c1 2 3 3 4 3s3-1 4-3" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
  </svg>
);

export const MiMoIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <circle cx="12" cy="12" r="10" stroke="#3b82f6" strokeWidth="2" fill="none"/>
    <path d="M8 14l2-4 2 4 2-4 2 4" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const CustomIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <circle cx="12" cy="12" r="10" stroke="#94a3b8" strokeWidth="2" fill="none"/>
    <circle cx="12" cy="12" r="3" fill="#94a3b8"/>
  </svg>
);

// ─── UI Icons ─────────────────────────────────────────────────

export const UserIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <circle cx="12" cy="8" r="4" fill="currentColor"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="currentColor" opacity="0.7"/>
  </svg>
);

export const BotIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <rect x="4" y="6" width="16" height="14" rx="3" fill="currentColor"/>
    <circle cx="9" cy="13" r="1.5" fill="white"/>
    <circle cx="15" cy="13" r="1.5" fill="white"/>
    <rect x="10" y="2" width="4" height="4" rx="2" fill="currentColor"/>
  </svg>
);

export const ChatIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M4 4h16a2 2 0 012 2v10a2 2 0 01-2 2H8l-4 4V6a2 2 0 012-2z" fill="currentColor"/>
  </svg>
);

export const BrainIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M12 2a7 7 0 00-4.95 11.95L12 22l4.95-8.05A7 7 0 0012 2z" fill="currentColor" opacity="0.8"/>
    <circle cx="12" cy="9" r="3" fill="white" opacity="0.9"/>
    <path d="M12 7v4M10 9h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

export const ZapIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor"/>
  </svg>
);

export const EyeIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" fill="none"/>
    <circle cx="12" cy="12" r="3" fill="currentColor"/>
  </svg>
);

export const FileIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" fill="currentColor" opacity="0.8"/>
    <path d="M14 2v6h6" fill="currentColor"/>
  </svg>
);

export const LinkIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
  </svg>
);

export const RocketIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" fill="currentColor"/>
    <path d="M12 13l-2-2 6.3-6.3a2.12 2.12 0 013 3L13 14" fill="currentColor" opacity="0.7"/>
    <path d="M12 13l2 2-4.87 4.87a1 1 0 01-.77.27l-2.36-.2-.2-2.36a1 1 0 01.27-.77L12 13z" fill="currentColor"/>
  </svg>
);

export const DocIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" fill="currentColor" opacity="0.7"/>
    <path d="M14 2v6h6" fill="currentColor"/>
    <path d="M8 13h8M8 17h6M8 9h2" stroke="white" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

export const BarChartIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <rect x="3" y="12" width="4" height="9" rx="1" fill="currentColor" opacity="0.6"/>
    <rect x="10" y="6" width="4" height="15" rx="1" fill="currentColor" opacity="0.8"/>
    <rect x="17" y="3" width="4" height="18" rx="1" fill="currentColor"/>
  </svg>
);

export const SunIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <circle cx="12" cy="12" r="5" fill="currentColor"/>
    <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </g>
  </svg>
);

export const MoonIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="currentColor"/>
  </svg>
);

// ─── Provider Icon Map ────────────────────────────────────────

export const PROVIDER_ICONS: Record<string, React.FC<IconProps>> = {
  "openai": OpenAIIcon,
  "anthropic": AnthropicIcon,
  "gemini": GeminiIcon,
  "deepseek": DeepSeekIcon,
  "qwen": QwenIcon,
  "moonshot": MoonshotIcon,
  "ollama": OllamaIcon,
  "xiaomi-mimo": MiMoIcon,
  "openai-compatible": CustomIcon,
};

export function getProviderIconComponent(type: string): React.FC<IconProps> {
  return PROVIDER_ICONS[type] ?? CustomIcon;
}
