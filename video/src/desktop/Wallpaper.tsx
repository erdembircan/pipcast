// The desktop picture: our own soft folds of warm and cool silk, in the
// spirit of macOS's light wallpapers, drawn here so nothing of Apple's is
// copied.
import { SCREEN_H, SCREEN_W } from './geometry.ts'

export function Wallpaper() {
  return (
    <svg width={SCREEN_W} height={SCREEN_H} viewBox={`0 0 ${SCREEN_W} ${SCREEN_H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
      <defs>
        <linearGradient id="wp-ground" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4eee6" />
          <stop offset="0.3" stopColor="#dccfbf" />
          <stop offset="0.58" stopColor="#a39790" />
          <stop offset="0.82" stopColor="#77748a" />
          <stop offset="1" stopColor="#5a5f74" />
        </linearGradient>
        <linearGradient id="wp-fold-a" x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0" stopColor="#fbf7f1" />
          <stop offset="0.5" stopColor="#e5d9ca" />
          <stop offset="1" stopColor="#b8aba0" />
        </linearGradient>
        <linearGradient id="wp-fold-b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c9b8a6" />
          <stop offset="0.55" stopColor="#8f8483" />
          <stop offset="1" stopColor="#5d6176" />
        </linearGradient>
        <linearGradient id="wp-fold-c" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#9d9aac" />
          <stop offset="0.6" stopColor="#d9d6dd" />
          <stop offset="1" stopColor="#f1eef0" />
        </linearGradient>
        <filter id="wp-soft" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id="wp-softer" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
      </defs>
      <rect width={SCREEN_W} height={SCREEN_H} fill="url(#wp-ground)" />
      {/* The broad folds, back to front */}
      <path d="M-80 1060 C 160 760, 300 420, 560 260 C 820 100, 1000 -40, 1180 -80 L 1620 -80 L 1620 1060 Z" fill="url(#wp-fold-b)" opacity="0.55" filter="url(#wp-softer)" />
      <path d="M-120 820 C 120 600, 260 300, 470 140 C 640 10, 760 -40, 900 -80 L -120 -80 Z" fill="url(#wp-fold-a)" opacity="0.9" filter="url(#wp-soft)" />
      <path d="M330 1080 C 520 820, 760 620, 1020 520 C 1260 430, 1430 300, 1640 120 L 1640 1080 Z" fill="url(#wp-fold-c)" opacity="0.5" filter="url(#wp-soft)" />
      <path d="M760 1080 C 900 860, 1080 760, 1260 700 C 1400 650, 1520 560, 1640 440 L 1640 1080 Z" fill="#5f6378" opacity="0.45" filter="url(#wp-softer)" />
      {/* The bright edges where the silk turns */}
      <path d="M-120 820 C 120 600, 260 300, 470 140 C 640 10, 760 -40, 900 -80" fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="3" filter="url(#wp-soft)" />
      <path d="M-120 820 C 120 600, 260 300, 470 140 C 640 10, 760 -40, 900 -80" fill="none" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="1.2" />
      <path d="M330 1080 C 520 820, 760 620, 1020 520 C 1260 430, 1430 300, 1640 120" fill="none" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="2.4" filter="url(#wp-soft)" />
      <path d="M330 1080 C 520 820, 760 620, 1020 520 C 1260 430, 1430 300, 1640 120" fill="none" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="1" />
      <path d="M40 1080 C 260 860, 420 660, 640 520 C 860 380, 1080 260, 1300 -60" fill="none" stroke="#fff8ee" strokeOpacity="0.35" strokeWidth="2" filter="url(#wp-soft)" />
    </svg>
  )
}
