// Form fields and pagination for the SHOP_OWNER pages.
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

export function Field({ label, hint, error, htmlFor, children, style }) {
    return (
        <div className="so-field" style={style}>
            {label && (
                <label className="so-label" htmlFor={htmlFor}>
                    {label}
                </label>
            )}
            {children}
            {error ? <div className="so-field-error">{error}</div> : hint ? <div className="so-hint">{hint}</div> : null}
        </div>
    );
}

export function Input({ invalid, className = "", ...props }) {
    return <input className={`so-input ${className}`} aria-invalid={invalid ? "true" : undefined} {...props} />;
}

export function Select({ options, invalid, className = "", placeholder, ...props }) {
    return (
        <select className={`so-input so-select ${className}`} aria-invalid={invalid ? "true" : undefined} {...props}>
            {placeholder !== undefined && <option value="">{placeholder}</option>}
            {options.map((o) =>
                typeof o === "string" ? (
                    <option key={o} value={o}>
                        {o}
                    </option>
                ) : (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ),
            )}
        </select>
    );
}

export function Textarea({ invalid, className = "", ...props }) {
    return <textarea className={`so-input so-textarea ${className}`} aria-invalid={invalid ? "true" : undefined} {...props} />;
}

/** Pager for a PaginatedResponse ({pageNumber, totalPages, totalElements}). pageNumber is 0-based. */
export function Pagination({ page, onChange, pageSize }) {
    if (!page || !page.totalElements) return null;
    const current = page.pageNumber || 0;
    const totalPages = page.totalPages || 1;
    const first = current * pageSize + 1;
    const last = Math.min(page.totalElements, first + (page.content?.length || 0) - 1);
    return (
        <div className="so-pager">
            <span>
                {first}–{last} of {page.totalElements}
            </span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button
                    type="button"
                    className="so-icon-btn"
                    aria-label="Previous page"
                    disabled={current === 0}
                    onClick={() => onChange(current - 1)}
                >
                    <FiChevronLeft />
                </button>
                <span>
                    Page {current + 1} of {totalPages}
                </span>
                <button
                    type="button"
                    className="so-icon-btn"
                    aria-label="Next page"
                    disabled={current + 1 >= totalPages}
                    onClick={() => onChange(current + 1)}
                >
                    <FiChevronRight />
                </button>
            </div>
        </div>
    );
}
