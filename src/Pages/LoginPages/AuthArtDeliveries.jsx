// "Due today" illustration (inline SVG, same style as AuthIllustration): a calendar page showing today, a finished
// blouse in a garment cover on a hanger, a gift bag with the studio tag, a receipt and a green "ready" tick.
// Decorative: hidden from screen readers. Gradient ids use the "dl-" prefix (several drawings can share a page).
export default function AuthArtDeliveries({ className }) {
    return (
        <svg className={className} viewBox="0 0 560 470" role="presentation" aria-hidden="true" focusable="false">
            <defs>
                <radialGradient id="dl-glow" cx="50%" cy="45%" r="55%">
                    <stop offset="0%" stopColor="#2bb38a" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#003c33" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="dl-cover" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f6efe4" stopOpacity="0.96" />
                    <stop offset="100%" stopColor="#e3d6c3" stopOpacity="0.96" />
                </linearGradient>
                <linearGradient id="dl-blouse" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8a3462" />
                    <stop offset="100%" stopColor="#5e2042" />
                </linearGradient>
                <linearGradient id="dl-bag" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ff8e72" />
                    <stop offset="100%" stopColor="#e5603f" />
                </linearGradient>
                <filter id="dl-shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#00130f" floodOpacity="0.35" />
                </filter>
            </defs>

            <circle cx="280" cy="215" r="230" fill="url(#dl-glow)" />
            <ellipse cx="280" cy="436" rx="210" ry="16" fill="#00251f" opacity="0.55" />

            {/* calendar page (left, tilted) */}
            <g filter="url(#dl-shadow)" transform="rotate(-8 130 170)">
                <rect x="58" y="92" width="150" height="160" rx="16" fill="#ffffff" />
                <path d="M58 108 a16 16 0 0 1 16 -16 h118 a16 16 0 0 1 16 16 v34 h-150 Z" fill="#ff7759" />
                <text x="133" y="125" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="15" fontWeight="600" fill="#fff" letterSpacing="2">NOV</text>
                <text x="133" y="212" textAnchor="middle" fontFamily="'Space Grotesk', sans-serif" fontSize="62" fontWeight="600" fill="#17171c">19</text>
                <rect x="98" y="224" width="70" height="18" rx="9" fill="#e8f3ef" />
                <text x="133" y="237" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="10" fontWeight="600" fill="#0d4f45" letterSpacing="1.5">TODAY</text>
                <circle cx="92" cy="92" r="6" fill="#c9ced6" />
                <circle cx="174" cy="92" r="6" fill="#c9ced6" />
            </g>

            {/* rail + hanger + garment cover with the finished blouse */}
            <rect x="214" y="58" width="236" height="8" rx="4" fill="#c7b79f" />
            <g filter="url(#dl-shadow)">
                <path d="M330 66 C330 54 344 54 344 66 C344 74 336 74 336 82" fill="none" stroke="#d8c3a5" strokeWidth="4" strokeLinecap="round" />
                <path d="M336 82 L282 112 L390 112 Z" fill="none" stroke="#d8c3a5" strokeWidth="4" strokeLinejoin="round" />
                <path d="M274 112 L398 112 L410 360 C410 372 402 378 390 378 L282 378 C270 378 262 372 262 360 Z" fill="url(#dl-cover)" />
                {/* window */}
                <rect x="290" y="134" width="92" height="150" rx="12" fill="#f4f7f6" opacity="0.9" />
                <path d="M304 150 C318 142 354 142 368 150 L376 186 C376 202 364 210 360 220 L312 220 C308 210 296 202 296 186 Z" fill="url(#dl-blouse)" />
                <path d="M322 146 C330 166 342 166 350 146" fill="none" stroke="#eda100" strokeWidth="3" strokeLinecap="round" />
                <path d="M312 220 L360 220 C364 240 368 258 370 276 L302 276 C304 258 308 240 312 220 Z" fill="#ff7759" />
                <path d="M302 270 L370 270 L370 276 L302 276 Z" fill="#eda100" />
                {/* zip */}
                <line x1="336" y1="296" x2="336" y2="362" stroke="#c7b79f" strokeWidth="2" strokeDasharray="3 3" />
                {/* tag */}
                <g transform="rotate(10 404 150)">
                    <line x1="398" y1="118" x2="404" y2="140" stroke="#c98500" strokeWidth="1.5" />
                    <rect x="390" y="138" width="34" height="46" rx="6" fill="#eda100" />
                    <circle cx="407" cy="147" r="3" fill="#fff6e5" />
                    <text x="407" y="172" textAnchor="middle" fontFamily="'Space Grotesk', sans-serif" fontSize="16" fontWeight="600" fill="#5e2042">S</text>
                </g>
            </g>

            {/* gift bag (front right) */}
            <g filter="url(#dl-shadow)">
                <path d="M428 300 C428 270 470 270 470 300" fill="none" stroke="#5e2042" strokeWidth="5" strokeLinecap="round" />
                <path d="M410 300 L488 300 L498 420 L400 420 Z" fill="url(#dl-bag)" />
                <rect x="410" y="300" width="78" height="14" fill="#d94f2f" opacity="0.5" />
                <circle cx="449" cy="360" r="20" fill="#fff6e5" />
                <text x="449" y="367" textAnchor="middle" fontFamily="'Space Grotesk', sans-serif" fontSize="20" fontWeight="600" fill="#e5603f">S</text>
            </g>

            {/* receipt (front left) */}
            <g filter="url(#dl-shadow)" transform="rotate(-6 150 350)">
                <path d="M98 300 H198 V408 l-10 -7 l-10 7 l-10 -7 l-10 7 l-10 -7 l-10 7 l-10 -7 l-10 7 l-10 -7 Z" fill="#ffffff" />
                <rect x="112" y="316" width="50" height="7" rx="3.5" fill="#17171c" opacity="0.8" />
                <rect x="112" y="334" width="72" height="5" rx="2.5" fill="#c9ced6" />
                <rect x="112" y="347" width="60" height="5" rx="2.5" fill="#c9ced6" />
                <rect x="112" y="360" width="66" height="5" rx="2.5" fill="#c9ced6" />
                <line x1="112" y1="374" x2="184" y2="374" stroke="#e5e7eb" strokeWidth="1.5" />
                <rect x="112" y="382" width="34" height="7" rx="3.5" fill="#1a7f4b" />
                <rect x="156" y="382" width="28" height="7" rx="3.5" fill="#17171c" opacity="0.8" />
            </g>

            {/* ready tick */}
            <g filter="url(#dl-shadow)">
                <circle cx="236" cy="300" r="26" fill="#1f9d6b" />
                <path d="M224 300 L233 309 L250 291" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </g>

            {/* sparkles */}
            <g fill="#ffd7cc">
                <path d="M480 112 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 Z" />
                <path d="M248 200 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 Z" opacity="0.8" />
                <path d="M520 250 l2.5 6 l6 2.5 l-6 2.5 l-2.5 6 l-2.5 -6 l-6 -2.5 l6 -2.5 Z" opacity="0.7" />
            </g>
        </svg>
    );
}
