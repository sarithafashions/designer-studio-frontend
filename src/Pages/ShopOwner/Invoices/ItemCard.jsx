// One invoice item: image, measurements, workers, step actions (from availableActions) and its stage trace.
import { FiArrowRight, FiUserPlus, FiUserX, FiImage, FiCheckCircle } from "react-icons/fi";
import { Button } from "../../shared/components/ui.jsx";
import { ItemStatusBadge } from "../../shared/components/status.jsx";
import { ACTIONS } from "../../../api/production.js";
import { formatMoney, formatNumber, formatDateTime, formatDuration, humanize } from "../../shared/lib/format.js";
import { itemTimeline, measurementsOf, remainingSteps, movesTo } from "../../shared/lib/invoice.js";

const ASSIGN_ACTIONS = new Set(Object.values(ACTIONS));

export default function ItemCard({ item, work, workError, invoiceDate, nameOf, busy, onMove, onAssign, onUnassign, onComplete }) {
    const actions = work?.availableActions || [];
    const nextStatus = actions.find((a) => !ASSIGN_ACTIONS.has(a));
    const tailor = work?.tailor;
    const assistant = work?.shopAssistant;
    const measurements = measurementsOf(item);
    const steps = itemTimeline(item, invoiceDate);

    return (
        <article className="so-item">
            <div className="so-item-head">
                {item.imageUrl ? (
                    <a href={item.imageUrl} target="_blank" rel="noreferrer" title="Open image">
                        <img className="so-item-img" src={item.imageUrl} alt={item.itemName} loading="lazy" />
                    </a>
                ) : (
                    <div className="so-item-img" style={{ display: "grid", placeItems: "center", color: "var(--so-muted)" }} aria-hidden>
                        <FiImage />
                    </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <div className="so-item-title">{item.itemName}</div>
                        <ItemStatusBadge status={item.itemOrderStatus} material={!!item.material} />
                    </div>
                    <div className="so-cell-sub" style={{ marginTop: 2 }}>
                        {formatNumber(item.itemQuantity)} × {formatMoney(item.itemPrice)} ={" "}
                        <b style={{ color: "var(--so-primary)" }}>{formatMoney((item.itemQuantity || 0) * (item.itemPrice || 0))}</b>
                    </div>
                    <div className="so-people" style={{ marginTop: 6 }}>
                        <span>
                            Tailor: <b>{tailor?.name || (item.assignedTo ? nameOf(item.assignedTo) : "—")}</b>
                        </span>
                        <span>
                            Shop assistant:{" "}
                            <b>{assistant?.name || (item.assignedToWhichShopAssistant ? nameOf(item.assignedToWhichShopAssistant) : "—")}</b>
                        </span>
                    </div>
                </div>
            </div>

            {measurements.length > 0 && (
                <div className="so-chips" aria-label="Measurements">
                    {measurements.map((m) => (
                        <span className="so-chip" key={m.name}>
                            {m.name}: <b>{m.value || "—"}</b>
                            {m.unit ? ` ${m.unit}` : ""}
                        </span>
                    ))}
                </div>
            )}

            {(actions.length > 0 || workError) && (
                <div className="so-actions">
                    {nextStatus && (
                        <Button size="sm" disabled={busy} onClick={() => onMove(item, nextStatus)}>
                            Move to {humanize(movesTo(item.itemOrderStatus, nextStatus).at(-1))} <FiArrowRight aria-hidden />
                        </Button>
                    )}
                    {actions.includes(ACTIONS.ASSIGN_TAILOR) && (
                        <Button variant="secondary" size="sm" disabled={busy} onClick={() => onAssign(item, "tailor", tailor?.userId || item.assignedTo)}>
                            <FiUserPlus aria-hidden /> {item.assignedTo ? "Re-assign tailor" : "Assign tailor"}
                        </Button>
                    )}
                    {actions.includes(ACTIONS.ASSIGN_SHOP_ASSISTANT) && (
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={busy}
                            onClick={() => onAssign(item, "shopAssistant", assistant?.userId || item.assignedToWhichShopAssistant)}
                        >
                            <FiUserPlus aria-hidden /> {item.assignedToWhichShopAssistant ? "Re-assign shop assistant" : "Assign shop assistant"}
                        </Button>
                    )}
                    {actions.includes(ACTIONS.COMPLETE) && (
                        <Button variant="secondary" size="sm" disabled={busy} onClick={() => onComplete(item)}
                            title="The work is done but was not updated in the app">
                            <FiCheckCircle aria-hidden /> Mark complete
                        </Button>
                    )}
                    {actions.includes(ACTIONS.UNASSIGN_TAILOR) && (
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => onUnassign(item, "tailor")}>
                            <FiUserX aria-hidden /> Remove tailor
                        </Button>
                    )}
                    {actions.includes(ACTIONS.UNASSIGN_SHOP_ASSISTANT) && (
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => onUnassign(item, "shopAssistant")}>
                            <FiUserX aria-hidden /> Remove shop assistant
                        </Button>
                    )}
                    {workError && <span className="so-field-error" style={{ marginTop: 0 }}>Actions unavailable: {workError}</span>}
                </div>
            )}

            {item.material ? (
                <div className="so-cell-sub" style={{ marginTop: 8 }}>Material only: no production steps.</div>
            ) : (
            <details className="so-details">
                <summary>Stage history ({steps.length})</summary>
                <ol className="so-timeline" style={{ marginTop: 10 }}>
                    {steps.map((s, i) => (
                        <li key={`${s.action}-${i}`} className={s.end ? "" : "current"}>
                            <div className="so-tl-title">
                                {humanize(s.action)}
                                {s.markedByShopOwner && " (marked by shop owner)"}
                            </div>
                            {s.markedByShopOwner && remainingSteps(s.skippedFrom).length > 0 && (
                                <div className="so-tl-meta">Skipped: {remainingSteps(s.skippedFrom).join(", ")}</div>
                            )}
                            {s.note && <div className="so-tl-meta">Note: {s.note}</div>}
                            <div className="so-tl-meta">
                                {s.start ? formatDateTime(s.start) : "—"}
                                {" → "}
                                {s.end ? formatDateTime(s.end) : "now"}
                                {s.start && ` · ${formatDuration(s.start, s.end || new Date())}`}
                                {s.actorId && ` · by ${nameOf(s.actorId)}`}
                            </div>
                        </li>
                    ))}
                </ol>
            </details>
            )}
        </article>
    );
}
