// Tailoring-studio illustration for the sign-in screens (inline SVG, brand colours, no external image):
// a dress form wearing a plum blouse + coral saree, a measuring tape, a pattern sheet with cutting lines and scissors,
// thread spools and a needle. Decorative: hidden from screen readers.
export default function AuthIllustration({ className }) {
    return (
        <svg className={className} viewBox="0 0 560 470" role="presentation" aria-hidden="true" focusable="false">
            <defs>
                <radialGradient id="ai-glow" cx="50%" cy="45%" r="55%">
                    <stop offset="0%" stopColor="#2bb38a" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#003c33" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="ai-form" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#f6efe4" />
                    <stop offset="100%" stopColor="#e3d6c3" />
                </linearGradient>
                <linearGradient id="ai-saree" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ff8e72" />
                    <stop offset="100%" stopColor="#e5603f" />
                </linearGradient>
                <linearGradient id="ai-blouse" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8a3462" />
                    <stop offset="100%" stopColor="#5e2042" />
                </linearGradient>
                <linearGradient id="ai-paper" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#f1f5f3" />
                </linearGradient>
                <filter id="ai-shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#00130f" floodOpacity="0.35" />
                </filter>
            </defs>

            {/* glow + floor */}
            <circle cx="280" cy="215" r="230" fill="url(#ai-glow)" />
            <ellipse cx="280" cy="436" rx="210" ry="16" fill="#00251f" opacity="0.55" />

            {/* pattern sheet (back, right) */}
            <g filter="url(#ai-shadow)" transform="rotate(8 430 190)">
                <rect x="352" y="88" width="160" height="200" rx="14" fill="url(#ai-paper)" />
                <path d="M384 122 C410 112 450 112 476 122 L486 168 C470 178 470 196 482 212 L470 258 L392 258 L380 212 C392 196 392 178 376 168 Z"
                    fill="none" stroke="#0b5a4d" strokeWidth="2.2" strokeDasharray="7 6" strokeLinejoin="round" />
                <line x1="430" y1="132" x2="430" y2="246" stroke="#ffad9b" strokeWidth="1.6" strokeDasharray="3 5" />
                <text x="374" y="280" fontFamily="'JetBrains Mono', monospace" fontSize="10" fill="#75758a">BLOUSE · FRONT</text>
            </g>

            {/* scissors on the sheet */}
            <g transform="translate(468 318) rotate(-28)">
                <path d="M0 0 L58 -10" stroke="#c9ced6" strokeWidth="6" strokeLinecap="round" />
                <path d="M0 0 L58 10" stroke="#e6e9ee" strokeWidth="6" strokeLinecap="round" />
                <circle cx="-12" cy="-12" r="11" fill="none" stroke="#eda100" strokeWidth="6" />
                <circle cx="-12" cy="12" r="11" fill="none" stroke="#eda100" strokeWidth="6" />
                <circle cx="2" cy="0" r="3" fill="#75758a" />
            </g>

            {/* dress form stand */}
            <g>
                <rect x="216" y="352" width="8" height="70" rx="4" fill="#c7b79f" />
                <path d="M220 418 L176 438 M220 418 L264 438 M220 418 L220 440" stroke="#c7b79f" strokeWidth="7" strokeLinecap="round" />
            </g>

            {/* dress form torso */}
            <g filter="url(#ai-shadow)">
                <rect x="207" y="70" width="26" height="26" rx="6" fill="url(#ai-form)" />
                <ellipse cx="220" cy="70" rx="17" ry="6" fill="#efe4d3" />
                <path d="M158 112 C176 96 264 96 282 112 L296 160 C298 196 270 214 268 240 C268 266 290 284 292 318 C292 342 262 356 220 356 C178 356 148 342 148 318 C150 284 172 266 172 240 C170 214 142 196 144 160 Z"
                    fill="url(#ai-form)" />
            </g>

            {/* blouse (bodice) */}
            <path d="M160 116 C178 102 262 102 280 116 L292 162 C292 186 272 200 266 214 L174 214 C168 200 148 186 148 162 Z"
                fill="url(#ai-blouse)" />
            <path d="M196 106 C206 132 234 132 244 106" fill="none" stroke="#eda100" strokeWidth="3" strokeLinecap="round" />
            {/* sleeves */}
            <path d="M160 116 L136 150 L150 162 L160 140 Z" fill="#6e264d" />
            <path d="M280 116 L304 150 L290 162 L280 140 Z" fill="#6e264d" />
            <path d="M136 150 L150 162 M304 150 L290 162" stroke="#eda100" strokeWidth="3" strokeLinecap="round" />

            {/* saree: pleats + drape over the shoulder */}
            <path d="M174 214 L266 214 C270 250 286 300 300 356 L140 356 C154 300 170 250 174 214 Z" fill="url(#ai-saree)" />
            <path d="M196 226 L186 354 M214 226 L210 354 M232 226 L236 354 M250 226 L262 354" stroke="#d94f2f" strokeWidth="2" opacity="0.55" />
            <path d="M146 342 C190 352 250 352 296 342 L300 356 L140 356 Z" fill="#eda100" />
            <path d="M150 350 C196 358 246 358 292 350" stroke="#fff3d6" strokeWidth="1.6" strokeDasharray="2 4" fill="none" />
            {/* pallu over the left shoulder */}
            <path d="M266 214 C250 180 236 140 258 108 L286 118 C276 150 290 196 312 236 C320 252 316 270 300 276 C292 252 280 232 266 214 Z"
                fill="#ff7759" />
            <path d="M286 118 C276 150 290 196 312 236" fill="none" stroke="#eda100" strokeWidth="4" strokeLinecap="round" />

            {/* measuring tape around the neck */}
            <path d="M196 98 C188 150 176 190 168 238" fill="none" stroke="#eda100" strokeWidth="10" strokeLinecap="round" />
            <path d="M244 98 C252 140 262 168 272 196" fill="none" stroke="#eda100" strokeWidth="10" strokeLinecap="round" />
            <path d="M196 98 C188 150 176 190 168 238" fill="none" stroke="#7a4f00" strokeWidth="10" strokeDasharray="1.5 7" />
            <path d="M244 98 C252 140 262 168 272 196" fill="none" stroke="#7a4f00" strokeWidth="10" strokeDasharray="1.5 7" />
            <path d="M196 98 C206 92 234 92 244 98" fill="none" stroke="#eda100" strokeWidth="10" strokeLinecap="round" />
            <rect x="160" y="236" width="16" height="12" rx="2" fill="#c98500" transform="rotate(10 168 242)" />

            {/* thread spools (front, left) */}
            <g filter="url(#ai-shadow)">
                <g transform="translate(70 360)">
                    <rect x="0" y="0" width="40" height="8" rx="2" fill="#d8c3a5" />
                    <rect x="4" y="8" width="32" height="42" rx="4" fill="#1f9d6b" />
                    <path d="M4 18 H36 M4 28 H36 M4 38 H36" stroke="#167a53" strokeWidth="1.5" />
                    <rect x="0" y="50" width="40" height="8" rx="2" fill="#d8c3a5" />
                </g>
                <g transform="translate(118 378)">
                    <rect x="0" y="0" width="34" height="7" rx="2" fill="#d8c3a5" />
                    <rect x="3" y="7" width="28" height="30" rx="4" fill="#eda100" />
                    <path d="M3 16 H31 M3 25 H31" stroke="#c98500" strokeWidth="1.5" />
                    <rect x="0" y="37" width="34" height="7" rx="2" fill="#d8c3a5" />
                </g>
                <g transform="translate(36 388)">
                    <rect x="0" y="0" width="30" height="6" rx="2" fill="#d8c3a5" />
                    <rect x="3" y="6" width="24" height="24" rx="4" fill="#ffad9b" />
                    <rect x="0" y="30" width="30" height="6" rx="2" fill="#d8c3a5" />
                </g>
            </g>
            {/* loose thread + needle */}
            <path d="M110 372 C150 330 120 300 160 290" fill="none" stroke="#1f9d6b" strokeWidth="2" strokeLinecap="round" />
            <g transform="translate(160 290) rotate(-40)">
                <path d="M0 0 L46 0" stroke="#e6e9ee" strokeWidth="3" strokeLinecap="round" />
                <ellipse cx="4" cy="0" rx="4" ry="1.6" fill="none" stroke="#75758a" strokeWidth="1" />
            </g>

            {/* sparkles */}
            <g fill="#ffd7cc">
                <path d="M96 120 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 Z" />
                <path d="M500 330 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 Z" opacity="0.8" />
                <path d="M330 52 l2.5 6 l6 2.5 l-6 2.5 l-2.5 6 l-2.5 -6 l-6 -2.5 l6 -2.5 Z" opacity="0.7" />
            </g>
        </svg>
    );
}
