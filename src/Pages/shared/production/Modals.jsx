// Tailor master popups: measurements (read-only), track status (9 steps), design image, assign tailor.
import { useEffect, useState } from "react";
import { FiCheck, FiUser, FiImage } from "react-icons/fi";
import { Modal, Button, EmptyState, ErrorBox, Skeleton } from "../components/ui.jsx";
import { ItemStatusBadge } from "../components/status.jsx";
import { fetchAssignableTailors } from "../../../utils/workQueue.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import noImage from "../../../assets/no-images.png";
import { measurementView, trackSteps, workTimeline, stepTimes } from "./desk.js";
import { formatDateTime, formatDuration } from "../lib/format.js";

/** Read-only measurements of one item (template fields first) and its notes. */
export function MeasurementsModal({ item, onClose }) {
    if (!item) return null;
    const { rows, notes } = measurementView(item);
    return (
        <Modal open title={`Measurements: ${item.itemName || "Garment"}`} onClose={onClose}
            footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
            <p className="so-hint" style={{ marginTop: 0 }}>Recorded garment measurements (inches / cm)</p>
            {rows.length === 0 ? (
                <EmptyState compact title="No measurements recorded" />
            ) : (
                <div className="tm-measure-grid">
                    {rows.map((m) => (
                        <div key={m.name} className="tm-measure-cell">
                            <span className="tm-measure-name">{m.name}</span>
                            <span className="tm-measure-value">
                                {m.value === "" || m.value === null ? "—" : m.value}
                                {m.unit && m.value !== "" ? ` ${m.unit}` : ""}
                            </span>
                        </div>
                    ))}
                </div>
            )}
            <div className="tm-notes">
                <span className="tm-measure-name">Notes / remarks / custom requests</span>
                <div>{notes || <span className="so-cell-sub">No special instructions recorded.</span>}</div>
            </div>
        </Modal>
    );
}

/** The item's place in the 9-step order flow, with when each reached step started and how long it took (or "so far"). */
export function TrackStatusModal({ item, customerName, invoiceId, invoiceDate, onClose }) {
    if (!item) return null;
    const times = stepTimes(workTimeline(item, invoiceDate));
    // Delivered is the end of the flow: show it as done, not as "now · … so far".
    const finished = item.itemOrderStatus === "ORDER_DELIVERED";
    return (
        <Modal open title="Order status" onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
            <dl className="so-dl" style={{ marginBottom: 16 }}>
                <dt>Customer</dt>
                <dd>{customerName || "—"}</dd>
                <dt>Invoice</dt>
                <dd className="so-mono">{invoiceId}</dd>
                <dt>Item</dt>
                <dd>{item.itemName}</dd>
                <dt>Now</dt>
                <dd><ItemStatusBadge status={item.itemOrderStatus} /></dd>
            </dl>
            <ol className="tm-track">
                {trackSteps(item.itemOrderStatus).map((step) => {
                    const s = finished && step.state === "current" ? { ...step, state: "done" } : step;
                    const t = times[s.key];
                    return (
                        <li key={s.key} className={`tm-track-step ${s.state}`}>
                            <span className="tm-track-dot" aria-hidden>{s.state === "done" ? <FiCheck size={12} /> : null}</span>
                            <div>
                                <div className="tm-track-title">
                                    {s.label}
                                    {s.state === "current" && <span className="so-cell-sub"> · now</span>}
                                </div>
                                {s.state !== "todo" && t?.start ? (
                                    <div className="tm-track-time">
                                        {formatDateTime(t.start)}
                                        {s.state === "current"
                                            ? ` · ${formatDuration(t.start, new Date()) || "just now"} so far`
                                            : t.end ? ` · took ${formatDuration(t.start, t.end) || "under a minute"}` : ""}
                                    </div>
                                ) : (
                                    <div className="so-cell-sub">{s.description}</div>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ol>
        </Modal>
    );
}

/** Reference / design photo of an item (placeholder when there is none or it fails to load). */
export function DesignModal({ item, onClose }) {
    if (!item) return null;
    return (
        <Modal open title={`${item.itemName} design`} onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
            {item.imageUrl ? (
                <a href={item.imageUrl} target="_blank" rel="noreferrer" title="Open full size">
                    <img className="tm-design" src={item.imageUrl} alt={`${item.itemName} design`}
                        onError={(e) => { e.currentTarget.src = noImage; }} />
                </a>
            ) : (
                <div className="tm-design-empty">
                    <FiImage aria-hidden /> No design photo for this item
                </div>
            )}
        </Modal>
    );
}

/**
 * Assign / re-assign a tailor to ONE item.
 * @param target   { invoice, item } or null
 * @param onSubmit (tailor {userId, name}) => Promise
 */
export function AssignTailorModal({ target, onClose, onSubmit }) {
    const [state, setState] = useState({ loading: true, tailors: [], error: "" });
    const [selected, setSelected] = useState("");
    const [saving, setSaving] = useState(false);
    const open = !!target;
    const current = target?.item?.assignedTo || "";

    useEffect(() => {
        if (!open) return;
        setSelected("");
        setSaving(false);
        setState({ loading: true, tailors: [], error: "" });
        fetchAssignableTailors()
            .then((tailors) => setState({ loading: false, tailors, error: "" }))
            .catch((err) => setState({ loading: false, tailors: [], error: getErrorMessage(err, "Failed to fetch tailors. Please try again.") }));
    }, [open]);

    if (!open) return null;
    const { invoice, item } = target;
    const currentName = item.assignedTailorName || state.tailors.find((t) => t.userId === current)?.name;
    const tailor = state.tailors.find((t) => t.userId === selected);
    const submit = async () => {
        if (!tailor) return;
        setSaving(true);
        try {
            await onSubmit(tailor);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal open title={current ? "Re-assign tailor" : "Assign tailor"} onClose={saving ? undefined : onClose}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button onClick={submit} disabled={saving || !tailor}>
                        {saving ? "Assigning…" : tailor ? `Assign to ${tailor.name}` : "Select a tailor"}
                    </Button>
                </>
            }>
            <dl className="so-dl" style={{ marginBottom: 12 }}>
                <dt>Invoice</dt>
                <dd className="so-mono">{invoice.invoiceId}</dd>
                <dt>Customer</dt>
                <dd>{invoice.customerName || "—"}</dd>
                <dt>Item</dt>
                <dd>{item.itemName}{item.itemQuantity > 1 ? ` ×${item.itemQuantity}` : ""}</dd>
            </dl>
            {current && (
                <div className="so-note" style={{ marginBottom: 12 }}>
                    This item is already assigned to <b>{currentName || "a tailor"}</b>. The new tailor starts again from “Tailor assigned”.
                </div>
            )}
            {state.loading ? (
                <div className="so-stack" style={{ gap: 8 }}>
                    <Skeleton height={44} />
                    <Skeleton height={44} />
                </div>
            ) : state.error ? (
                <ErrorBox message={state.error} />
            ) : state.tailors.length === 0 ? (
                <EmptyState compact title="No tailors available" message="There are no tailors registered in the shop." />
            ) : (
                <div className="tm-pick" role="radiogroup" aria-label="Select tailor">
                    {state.tailors.map((t) => {
                        const isCurrent = t.userId === current;
                        const on = t.userId === selected;
                        return (
                            <button key={t.userId} type="button" role="radio" aria-checked={on} disabled={isCurrent}
                                className={`tm-pick-row ${on ? "on" : ""}`} onClick={() => setSelected(t.userId)}>
                                <span className="tm-pick-icon" aria-hidden>{on ? <FiCheck /> : <FiUser />}</span>
                                <span className="tm-pick-name">
                                    {t.name || "Tailor"}
                                    {isCurrent && <span className="so-cell-sub"> · current</span>}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </Modal>
    );
}
