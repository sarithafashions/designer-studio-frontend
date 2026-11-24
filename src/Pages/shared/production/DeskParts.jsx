// Building blocks of the tailor master screens: job card (one item), design thumbnail, urgency badge, filter pills.
import { useState } from "react";
import { FiCheckSquare, FiSquare, FiScissors, FiUserPlus, FiActivity, FiMaximize2, FiImage } from "react-icons/fi";
import { Button, Badge } from "../components/ui.jsx";
import { ItemStatusBadge } from "../components/status.jsx";
import { ACTIONS } from "../../../api/production.js";
import { formatDate } from "../lib/format.js";
import { urgencyOf, stageLabel } from "./desk.js";

export function UrgencyBadge({ date }) {
    const u = urgencyOf(date);
    return (
        <span title={u.title}>
            <Badge tone={u.tone}>{u.label}</Badge>
        </span>
    );
}

/**
 * Small design photo of an item (placeholder icon when there is none / it fails to load); click opens the full design.
 * size: px of the square thumbnail.
 */
export function DesignThumb({ item, onOpen, size = 56 }) {
    const [failed, setFailed] = useState(false);
    const has = Boolean(item.imageUrl) && !failed;
    return (
        <button type="button" className={`tm-thumb-btn ${has ? "" : "empty"}`} style={{ width: size, height: size }}
            onClick={(e) => { e.stopPropagation(); onOpen(item); }}
            title={has ? "Open the design photo" : "No design photo"} aria-label={`Design photo of ${item.itemName}`}>
            {has ? <img src={item.imageUrl} alt="" loading="lazy" onError={() => setFailed(true)} /> : <FiImage aria-hidden />}
        </button>
    );
}

/**
 * One item as a job card.
 * Buttons: Measurements · Track (optional) · Mark cut (ORDER_ACCEPTED) or Assign / Re-assign tailor.
 * onDesign (optional) shows the design photo next to the item name.
 * action (optional) {label, icon, onClick(invoice, item)} replaces Mark cut / Assign (e.g. the tailor's "Start stitching").
 * The checkbox selects this one item: onToggle(invoice, item).
 */
export function JobCard({ invoice, item, checked, onToggle, busy, onMeasurements, onDesign, onTrack, onMarkCut, onAssign, action }) {
    const isNew = item.itemOrderStatus === "ORDER_ACCEPTED";
    const canAssign = (item.availableActions || []).includes(ACTIONS.ASSIGN_TAILOR);
    return (
        <article className={`tm-job ${checked ? "selected" : ""}`}>
            <div className="tm-job-top">
                {onToggle && (
                    <button type="button" className="tm-check" onClick={() => onToggle(invoice, item)} aria-pressed={checked}
                        aria-label={`Select ${item.itemName} of ${invoice.invoiceId}`}>
                        {checked ? <FiCheckSquare /> : <FiSquare />}
                    </button>
                )}
                <span className="so-mono tm-job-inv">#{invoice.invoiceId}</span>
                <span className="tm-spacer" />
                <UrgencyBadge date={invoice.expectedDeliveryDate} />
            </div>
            <div className={`tm-job-body ${onDesign ? "with-thumb" : ""}`}>
                {onDesign && <DesignThumb item={item} onOpen={onDesign} />}
                <div style={{ minWidth: 0 }}>
                    <div className="tm-job-name">
                        {item.itemName}
                        {item.itemQuantity > 1 && <span className="tm-qty">×{item.itemQuantity}</span>}
                    </div>
                    <div className="so-cell-sub">{invoice.customerName || "Customer"}</div>
                    <div className="tm-job-badges">
                        <ItemStatusBadge status={item.itemOrderStatus} />
                        <span className="so-cell-sub">{stageLabel(item.itemOrderStatus)}</span>
                    </div>
                </div>
            </div>
            <div className="tm-job-meta">
                <span>Ordered {formatDate(invoice.invoiceDate)}</span>
                <span>
                    {item.assignedTailorName ? <>Tailor: <b>{item.assignedTailorName}</b></>
                        : item.assignedShopAssistantName ? <>Assistant: <b>{item.assignedShopAssistantName}</b></>
                            : "No staff assigned"}
                </span>
            </div>
            <div className="tm-job-actions">
                <Button variant="ghost" size="sm" onClick={() => onMeasurements(item)}>
                    <FiMaximize2 aria-hidden /> Measurements
                </Button>
                {onTrack && (
                    <Button variant="ghost" size="sm" onClick={() => onTrack(invoice, item)}>
                        <FiActivity aria-hidden /> Track
                    </Button>
                )}
                <span className="tm-spacer" />
                {action ? (
                    <Button size="sm" disabled={busy} onClick={() => action.onClick(invoice, item)}>
                        {action.icon} {action.label}
                    </Button>
                ) : isNew ? (
                    <Button size="sm" disabled={busy} onClick={() => onMarkCut(invoice, item)}>
                        <FiScissors aria-hidden /> Mark cut
                    </Button>
                ) : onAssign ? (
                    <Button size="sm" variant={item.assignedTo ? "secondary" : "primary"} disabled={busy || !canAssign}
                        title={canAssign ? undefined : "A tailor can be assigned after cutting (and before a shop assistant is assigned)"}
                        onClick={() => onAssign(invoice, item)}>
                        <FiUserPlus aria-hidden /> {item.assignedTailorName ? `Tailor: ${item.assignedTailorName}` : "Assign tailor"}
                    </Button>
                ) : null}
            </div>
        </article>
    );
}

/**
 * Instant filter pills (design.md button-pill-outline; active = filled near-black).
 * options: [{key, label, count?}]. Clicking applies at once — no Apply button.
 */
export function FilterPills({ options, value, onChange, label }) {
    return (
        <div className="tm-pills" role="radiogroup" aria-label={label}>
            {options.map((o) => (
                <button key={o.key} type="button" role="radio" aria-checked={value === o.key}
                    className={`tm-pill ${value === o.key ? "on" : ""}`} onClick={() => onChange(o.key)}>
                    {o.label}
                    {o.count !== undefined && <span className="tm-pill-count">{o.count}</span>}
                </button>
            ))}
        </div>
    );
}
