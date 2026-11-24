// "Forgot password" illustration (inline SVG, same style as AuthIllustration): an open envelope with the reset-link
// letter rising out of it, a gold key, a "10 min" timer chip and a paper plane on a dashed trail.
// Decorative: hidden from screen readers. Gradient ids use the "fg-" prefix (several drawings can share a page).
export default function AuthArtForgot({ className }) {
    return (
        <svg className={className} viewBox="0 0 560 470" role="presentation" aria-hidden="true" focusable="false">
            <defs>
                <radialGradient id="fg-glow" cx="50%" cy="45%" r="55%">
                    <stop offset="0%" stopColor="#2bb38a" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#003c33" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="fg-env" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff8e72" />
                    <stop offset="100%" stopColor="#e5603f" />
                </linearGradient>
                <linearGradient id="fg-flap" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffad9b" />
                    <stop offset="100%" stopColor="#ff7759" />
                </linearGradient>
                <filter id="fg-shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#00130f" floodOpacity="0.35" />
                </filter>
            </defs>

            <circle cx="280" cy="230" r="230" fill="url(#fg-glow)" />
            <ellipse cx="280" cy="436" rx="200" ry="16" fill="#00251f" opacity="0.55" />

            {/* paper plane on a dashed trail (top left) */}
            <path d="M70 200 C110 120 170 110 210 92" fill="none" stroke="#ffd7cc" strokeWidth="2.5" strokeDasharray="6 8" strokeLinecap="round" opacity="0.7" />
            <g filter="url(#fg-shadow)" transform="translate(212 70) rotate(-12)">
                <path d="M0 22 L56 0 L40 46 Z" fill="#ffffff" />
                <path d="M0 22 L56 0 L22 30 Z" fill="#e3d6c3" />
                <path d="M22 30 L26 44 L32 34 Z" fill="#c7b79f" />
            </g>

            {/* envelope back */}
            <g filter="url(#fg-shadow)">
                <path d="M150 230 L280 150 L410 230 L410 390 C410 400 402 408 392 408 L168 408 C158 408 150 400 150 390 Z" fill="#c94f33" />
            </g>

            {/* letter with the reset link */}
            <g filter="url(#fg-shadow)">
                <rect x="186" y="130" width="188" height="200" rx="14" fill="#ffffff" />
                <rect x="210" y="156" width="64" height="9" rx="4.5" fill="#17171c" opacity="0.85" />
                <rect x="210" y="178" width="140" height="6" rx="3" fill="#c9ced6" />
                <rect x="210" y="192" width="118" height="6" rx="3" fill="#c9ced6" />
                <rect x="210" y="216" width="140" height="34" rx="17" fill="#0d4f45" />
                <rect x="232" y="229" width="70" height="8" rx="4" fill="#ffffff" opacity="0.9" />
                <path d="M318 233 h14 m-5 -5 l5 5 l-5 5" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </g>

            {/* envelope front */}
            <path d="M150 240 L280 324 L410 240 L410 390 C410 400 402 408 392 408 L168 408 C158 408 150 400 150 390 Z" fill="url(#fg-env)" />
            <path d="M150 400 L262 314 M410 400 L298 314" stroke="#d94f2f" strokeWidth="2" opacity="0.6" />
            <circle cx="280" cy="336" r="20" fill="#fff6e5" />
            <text x="280" y="343" textAnchor="middle" fontFamily="'Space Grotesk', sans-serif" fontSize="19" fontWeight="600" fill="#e5603f">S</text>

            {/* gold key (right) */}
            <g filter="url(#fg-shadow)" transform="translate(430 300) rotate(-35)">
                <circle cx="0" cy="0" r="26" fill="#eda100" />
                <circle cx="0" cy="0" r="10" fill="#003c33" />
                <rect x="22" y="-6" width="78" height="12" rx="6" fill="#eda100" />
                <rect x="72" y="4" width="10" height="18" rx="3" fill="#eda100" />
                <rect x="88" y="4" width="10" height="13" rx="3" fill="#eda100" />
            </g>

            {/* 10-minute timer chip (left) */}
            <g filter="url(#fg-shadow)">
                <rect x="70" y="300" width="106" height="44" rx="22" fill="#ffffff" />
                <circle cx="96" cy="322" r="12" fill="none" stroke="#1f9d6b" strokeWidth="3" />
                <path d="M96 315 V322 L101 326" fill="none" stroke="#1f9d6b" strokeWidth="2.5" strokeLinecap="round" />
                <text x="116" y="328" fontFamily="'JetBrains Mono', monospace" fontSize="14" fontWeight="600" fill="#17171c">10m</text>
            </g>

            {/* sparkles */}
            <g fill="#ffd7cc">
                <path d="M470 120 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 Z" />
                <path d="M120 400 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 Z" opacity="0.8" />
                <path d="M400 168 l2.5 6 l6 2.5 l-6 2.5 l-2.5 6 l-2.5 -6 l-6 -2.5 l6 -2.5 Z" opacity="0.7" />
            </g>
        </svg>
    );
}
