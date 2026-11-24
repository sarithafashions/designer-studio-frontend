// "Where work waits" illustration (inline SVG, same style as AuthIllustration): a sewing machine stitching coral
// fabric, a stage track above it (cut ✓ · stitch ✓ · iron · ready) with a stopwatch on the waiting stage, and an iron.
// Decorative: hidden from screen readers. Gradient ids use the "wf-" prefix (several drawings can share a page).
export default function AuthArtWorkflow({ className }) {
    return (
        <svg className={className} viewBox="0 0 560 470" role="presentation" aria-hidden="true" focusable="false">
            <defs>
                <radialGradient id="wf-glow" cx="50%" cy="45%" r="55%">
                    <stop offset="0%" stopColor="#2bb38a" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#003c33" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="wf-machine" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#f6efe4" />
                    <stop offset="100%" stopColor="#e3d6c3" />
                </linearGradient>
                <linearGradient id="wf-fabric" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#ff8e72" />
                    <stop offset="100%" stopColor="#e5603f" />
                </linearGradient>
                <filter id="wf-shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#00130f" floodOpacity="0.35" />
                </filter>
            </defs>

            <circle cx="280" cy="230" r="230" fill="url(#wf-glow)" />
            <ellipse cx="280" cy="436" rx="210" ry="16" fill="#00251f" opacity="0.55" />

            {/* stage track */}
            <g filter="url(#wf-shadow)">
                <rect x="70" y="58" width="420" height="96" rx="20" fill="#ffffff" />
            </g>
            <line x1="122" y1="96" x2="438" y2="96" stroke="#e5e7eb" strokeWidth="6" strokeLinecap="round" />
            <line x1="122" y1="96" x2="332" y2="96" stroke="#1f9d6b" strokeWidth="6" strokeLinecap="round" />
            {/* cut (done) */}
            <circle cx="122" cy="96" r="18" fill="#1f9d6b" />
            <path d="M114 96 L120 102 L131 90" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* stitch (done) */}
            <circle cx="227" cy="96" r="18" fill="#1f9d6b" />
            <path d="M219 96 L225 102 L236 90" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* iron (waiting, current) */}
            <circle cx="332" cy="96" r="24" fill="#fff6e5" />
            <circle cx="332" cy="96" r="18" fill="#eda100" />
            <circle cx="332" cy="96" r="6" fill="#fff" />
            {/* ready (to do) */}
            <circle cx="438" cy="96" r="18" fill="#ffffff" stroke="#c9ced6" strokeWidth="3" />
            <g fontFamily="'JetBrains Mono', monospace" fontSize="10" fill="#75758a" textAnchor="middle" letterSpacing="1">
                <text x="122" y="138">CUT</text>
                <text x="227" y="138">STITCH</text>
                <text x="332" y="138" fill="#9a5b00" fontWeight="600">IRON</text>
                <text x="438" y="138">READY</text>
            </g>
            {/* stopwatch on the waiting stage */}
            <g transform="translate(370 150)" filter="url(#wf-shadow)">
                <rect x="-6" y="-26" width="12" height="9" rx="2" fill="#ff7759" />
                <circle cx="0" cy="4" r="24" fill="#ff7759" />
                <circle cx="0" cy="4" r="18" fill="#fff" />
                <path d="M0 4 L0 -8 M0 4 L9 9" stroke="#17171c" strokeWidth="2.5" strokeLinecap="round" />
            </g>

            {/* sewing machine */}
            <g filter="url(#wf-shadow)">
                {/* base */}
                <rect x="96" y="352" width="300" height="34" rx="10" fill="#d8c3a5" />
                {/* pillar + arm */}
                <path d="M300 352 L300 228 C300 210 314 200 332 200 L352 200 C370 200 382 212 382 230 L382 352 Z" fill="url(#wf-machine)" />
                <path d="M150 228 C150 212 162 200 178 200 L340 200 L340 252 L196 252 L196 290 L150 290 Z" fill="url(#wf-machine)" />
                {/* head + needle */}
                <rect x="150" y="286" width="46" height="22" rx="6" fill="#e3d6c3" />
                <line x1="166" y1="308" x2="166" y2="340" stroke="#75758a" strokeWidth="3" strokeLinecap="round" />
                <rect x="156" y="336" width="22" height="6" rx="3" fill="#c9ced6" />
                {/* plum stripe + dial */}
                <path d="M196 214 L360 214" stroke="#6e264d" strokeWidth="8" strokeLinecap="round" />
                <circle cx="356" cy="282" r="16" fill="#6e264d" />
                <circle cx="356" cy="282" r="6" fill="#eda100" />
                {/* hand wheel */}
                <circle cx="392" cy="252" r="22" fill="#c7b79f" />
                <circle cx="392" cy="252" r="9" fill="#a8977e" />
                {/* spool on top */}
                <rect x="262" y="178" width="20" height="5" rx="2" fill="#d8c3a5" />
                <rect x="264" y="183" width="16" height="14" rx="3" fill="#1f9d6b" />
                <path d="M272 183 C240 170 200 180 172 286" fill="none" stroke="#1f9d6b" strokeWidth="1.6" />
            </g>

            {/* fabric under the needle with a stitch line */}
            <path d="M70 352 C120 336 200 344 250 340 C300 336 340 346 380 352 L380 364 L70 364 Z" fill="url(#wf-fabric)" />
            <path d="M84 350 C130 338 200 346 166 342" fill="none" stroke="#fff3d6" strokeWidth="2" strokeDasharray="5 5" />

            {/* iron (right) */}
            <g filter="url(#wf-shadow)" transform="translate(420 330)">
                <path d="M0 50 C0 18 28 0 70 0 L96 0 C104 0 108 8 104 16 L96 50 Z" fill="#ffffff" />
                <path d="M0 50 L96 50 L92 62 L4 62 Z" fill="#c9ced6" />
                <path d="M34 0 C34 -22 82 -22 82 0" fill="none" stroke="#5e2042" strokeWidth="9" strokeLinecap="round" />
                <circle cx="62" cy="28" r="7" fill="#eda100" />
                {/* steam */}
                <path d="M-10 20 C-20 10 -2 2 -12 -8 M-26 30 C-36 20 -18 12 -28 2" fill="none" stroke="#ffd7cc" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
            </g>

            {/* sparkles */}
            <g fill="#ffd7cc">
                <path d="M520 190 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 Z" />
                <path d="M60 250 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 Z" opacity="0.8" />
            </g>
        </svg>
    );
}
