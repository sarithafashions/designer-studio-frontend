// Shared building blocks for the SHOP_OWNER pages (styles in ../shopOwner.css).
import { useEffect, useRef } from "react";
import { FiArrowDownRight, FiArrowUpRight, FiMinus, FiX, FiAlertCircle, FiInbox } from "react-icons/fi";

/* ------------------------------------------------------------------ Button */
export function Button({ variant = "primary", size, className = "", children, ...props }) {
    const cls = ["so-btn", `so-btn-${variant}`, size === "sm" ? "so-btn-sm" : "", className].filter(Boolean).join(" ");
    return (
        <button type="button" className={cls} {...props}>
            {children}
        </button>
    );
}

/* ------------------------------------------------------------------ Card */
export function Card({ title, subtitle, actions, className = "", children }) {
    return (
        <section className={`so-card ${className}`}>
            {(title || actions) && (
                <div className="so-card-head">
                    <div>
                        {title && <h2 className="so-card-title">{title}</h2>}
                        {subtitle && <div className="so-card-sub">{subtitle}</div>}
                    </div>
                    {actions}
                </div>
            )}
            {children}
        </section>
    );
}

/* ------------------------------------------------------------------ Page header */
export function PageHeader({ eyebrow, title, subtitle, actions }) {
    return (
        <header className="so-page-head">
            <div>
                {eyebrow && <div className="so-eyebrow">{eyebrow}</div>}
                <h1 className="so-page-title">{title}</h1>
                {subtitle && <div className="so-page-sub">{subtitle}</div>}
            </div>
            {actions}
        </header>
    );
}

/* ------------------------------------------------------------------ Delta (% change)
 * goodWhen = "up" (sales) or "down" (expenses): picks green / red. Icon + sign, never colour alone. */
export function Delta({ value, goodWhen = "up" }) {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return <span className="so-delta so-delta-flat">New</span>;
    }
    const rounded = Math.round(value * 10) / 10;
    if (rounded === 0) {
        return (
            <span className="so-delta so-delta-flat">
                <FiMinus aria-hidden /> 0%
            </span>
        );
    }
    const up = rounded > 0;
    const good = goodWhen === "up" ? up : !up;
    const Icon = up ? FiArrowUpRight : FiArrowDownRight;
    return (
        <span className={`so-delta ${good ? "so-delta-good" : "so-delta-bad"}`}>
            <Icon aria-hidden /> {up ? "+" : ""}
            {Math.abs(rounded) >= 1000 ? ">999" : rounded}%
        </span>
    );
}

/* ------------------------------------------------------------------ KPI card */
/** variant="feature": deep-green card (design.md dark feature band) for a figure that is not like its neighbours. */
export function KpiCard({ label, value, icon, footer, loading, variant }) {
    return (
        <div className={`so-card so-kpi${variant === "feature" ? " so-kpi-feature" : ""}`}>
            <div className="so-kpi-label">
                {icon}
                {label}
            </div>
            {loading ? (
                <Skeleton height={30} width="70%" />
            ) : (
                <div className="so-kpi-value">{value}</div>
            )}
            <div className="so-kpi-foot">{loading ? <Skeleton height={12} width="50%" /> : footer}</div>
        </div>
    );
}

/* ------------------------------------------------------------------ Badge
 * tone: success | warning | info | danger | neutral */
export function Badge({ tone = "neutral", icon, children }) {
    return (
        <span className={`so-badge so-badge-${tone}`}>
            {icon}
            {children}
        </span>
    );
}

/* ------------------------------------------------------------------ Segmented control */
export function Segmented({ options, value, onChange, label }) {
    return (
        <div className="so-segmented" role="radiogroup" aria-label={label}>
            {options.map((o) => (
                <button
                    key={o.key}
                    type="button"
                    role="radio"
                    aria-checked={value === o.key}
                    className={value === o.key ? "active" : ""}
                    onClick={() => onChange(o.key)}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

/* ------------------------------------------------------------------ Tabs */
export function Tabs({ tabs, value, onChange }) {
    return (
        <div className="so-tabs" role="tablist">
            {tabs.map((t) => (
                <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={value === t.key}
                    className={`so-tab ${value === t.key ? "active" : ""}`}
                    onClick={() => onChange(t.key)}
                >
                    {t.label}
                    {t.count !== undefined && t.count !== null && <span className="so-tab-count">{t.count}</span>}
                </button>
            ))}
        </div>
    );
}

/* ------------------------------------------------------------------ Bar list (one hue, magnitude) */
/** rows: [{label, value, meta?, color?}] — a row colour overrides the list colour. */
export function BarList({ rows, format = (v) => v, emptyText = "Nothing to show for this period", color }) {
    const max = Math.max(0, ...rows.map((r) => Number(r.value) || 0));
    if (!rows.length || max === 0) return <EmptyState title={emptyText} compact />;
    return (
        <div className="so-barlist">
            {rows.map((r) => (
                <div className="so-barlist-row" key={r.label}>
                    <span className="so-barlist-label" title={r.label}>
                        {r.label}
                    </span>
                    <span className="so-barlist-value">
                        {format(r.value)}
                        {r.meta && <small>{r.meta}</small>}
                    </span>
                    <div className="so-barlist-track" aria-hidden>
                        <div
                            className="so-barlist-fill"
                            style={{ width: `${((Number(r.value) || 0) / max) * 100}%`, background: r.color || color }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}

/* ------------------------------------------------------------------ States */
export function Skeleton({ width = "100%", height = 14, style }) {
    return <div className="so-skeleton" style={{ width, height, ...style }} aria-hidden />;
}

export function EmptyState({ title = "Nothing here yet", message, action, compact }) {
    return (
        <div className={`so-empty ${compact ? "compact" : ""}`}>
            {!compact && (
                <span className="so-empty-icon" aria-hidden>
                    <FiInbox size={22} />
                </span>
            )}
            <div className="so-empty-title">{title}</div>
            {message && <div className="so-empty-msg">{message}</div>}
            {action && <div className="so-empty-action">{action}</div>}
        </div>
    );
}

export function ErrorBox({ message, onRetry }) {
    return (
        <div className="so-error-box" role="alert">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <FiAlertCircle aria-hidden /> {message || "Could not load this section."}
            </span>
            {onRetry && (
                <Button variant="secondary" size="sm" onClick={onRetry}>
                    Retry
                </Button>
            )}
        </div>
    );
}

/* ------------------------------------------------------------------ Modal (centered, Esc / backdrop closes) */
export function Modal({ open, title, onClose, footer, size, children }) {
    const panelRef = useRef(null);
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => e.key === "Escape" && onClose?.();
        document.addEventListener("keydown", onKey);
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        // Focus the dialog unless a field inside already took focus (autofocus).
        if (panelRef.current && !panelRef.current.contains(document.activeElement)) panelRef.current.focus();
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = previous;
        };
    }, [open, onClose]);

    if (!open) return null;
    return (
        <div className="so-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
            <div
                ref={panelRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label={typeof title === "string" ? title : undefined}
                className={`so-modal ${size === "lg" ? "so-modal-lg" : ""}`}
            >
                <div className="so-modal-head">
                    <h2 className="so-card-title">{title}</h2>
                    <button type="button" className="so-icon-btn" onClick={onClose} aria-label="Close">
                        <FiX />
                    </button>
                </div>
                <div className="so-modal-body">{children}</div>
                {footer && <div className="so-modal-foot">{footer}</div>}
            </div>
        </div>
    );
}
