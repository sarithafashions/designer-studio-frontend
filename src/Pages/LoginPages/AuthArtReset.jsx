// "Reset password" illustration (inline SVG, same style as AuthIllustration): an open padlock beside a password card
// with the new password dots and a strength bar, a green shield tick and a spool of thread for the studio touch.
// Decorative: hidden from screen readers. Gradient ids use the "rs-" prefix (several drawings can share a page).
export default function AuthArtReset({ className }) {
    return (
        <svg className={className} viewBox="0 0 560 470" role="presentation" aria-hidden="true" focusable="false">
            <defs>
                <radialGradient id="rs-glow" cx="50%" cy="45%" r="55%">
                    <stop offset="0%" stopColor="#2bb38a" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#003c33" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="rs-lock" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#8a3462" />
                    <stop offset="100%" stopColor="#5e2042" />
                </linearGradient>
                <linearGradient id="rs-shackle" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#e3d6c3" />
                    <stop offset="100%" stopColor="#c7b79f" />
                </linearGradient>
                <filter id="rs-shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#00130f" floodOpacity="0.35" />
                </filter>
            </defs>

            <circle cx="280" cy="230" r="230" fill="url(#rs-glow)" />
            <ellipse cx="280" cy="436" rx="200" ry="16" fill="#00251f" opacity="0.55" />

            {/* password card (back right) */}
            <g filter="url(#rs-shadow)" transform="rotate(6 400 200)">
                <rect x="300" y="110" width="200" height="150" rx="18" fill="#ffffff" />
                <rect x="322" y="132" width="80" height="8" rx="4" fill="#17171c" opacity="0.8" />
                <rect x="322" y="156" width="156" height="40" rx="10" fill="#f4f4f6" stroke="#d9d9dd" />
                <g fill="#17171c">
                    <circle cx="340" cy="176" r="5" /><circle cx="356" cy="176" r="5" /><circle cx="372" cy="176" r="5" />
                    <circle cx="388" cy="176" r="5" /><circle cx="404" cy="176" r="5" /><circle cx="420" cy="176" r="5" />
                </g>
                <rect x="436" y="166" width="2.5" height="20" rx="1" fill="#9b60aa" />
                {/* strength bar */}
                <rect x="322" y="212" width="36" height="7" rx="3.5" fill="#1f9d6b" />
                <rect x="362" y="212" width="36" height="7" rx="3.5" fill="#1f9d6b" />
                <rect x="402" y="212" width="36" height="7" rx="3.5" fill="#1f9d6b" />
                <rect x="442" y="212" width="36" height="7" rx="3.5" fill="#e5e7eb" />
                <text x="322" y="242" fontFamily="'JetBrains Mono', monospace" fontSize="10" fontWeight="600" fill="#1a7f4b" letterSpacing="1">STRONG</text>
            </g>

            {/* open padlock (front left) */}
            <g filter="url(#rs-shadow)">
                <path d="M160 230 V170 C160 122 260 122 260 170 V182" fill="none" stroke="url(#rs-shackle)" strokeWidth="22" strokeLinecap="round" />
                <rect x="112" y="220" width="196" height="170" rx="26" fill="url(#rs-lock)" />
                <path d="M112 262 H308" stroke="#eda100" strokeWidth="4" opacity="0.9" />
                <circle cx="210" cy="314" r="20" fill="#fff6e5" />
                <path d="M204 326 L216 326 L212 352 L208 352 Z" fill="#fff6e5" />
                <circle cx="210" cy="314" r="7" fill="#5e2042" />
            </g>

            {/* green shield tick */}
            <g filter="url(#rs-shadow)" transform="translate(360 300)">
                <path d="M50 0 L96 16 V52 C96 82 74 102 50 112 C26 102 4 82 4 52 V16 Z" fill="#1f9d6b" />
                <path d="M30 56 L44 70 L72 40" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            </g>

            {/* spool of thread + loose thread (studio touch) */}
            <g filter="url(#rs-shadow)">
                <rect x="70" y="372" width="44" height="8" rx="3" fill="#d8c3a5" />
                <rect x="74" y="380" width="36" height="34" rx="5" fill="#ff7759" />
                <rect x="70" y="414" width="44" height="8" rx="3" fill="#d8c3a5" />
                <path d="M78 388 H106 M78 396 H106 M78 404 H106" stroke="#e5603f" strokeWidth="1.5" />
            </g>
            <path d="M110 392 C150 400 160 430 210 420" fill="none" stroke="#ff7759" strokeWidth="1.8" />

            {/* sparkles */}
            <g fill="#ffd7cc">
                <path d="M480 300 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 Z" />
                <path d="M90 140 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 Z" opacity="0.8" />
                <path d="M290 78 l2.5 6 l6 2.5 l-6 2.5 l-2.5 6 l-2.5 -6 l-6 -2.5 l6 -2.5 Z" opacity="0.7" />
            </g>
        </svg>
    );
}
