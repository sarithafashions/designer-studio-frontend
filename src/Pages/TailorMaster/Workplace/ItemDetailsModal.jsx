// One item in full: reference photo, every measurement (for cutting) and its stage history.
import { FiImage } from "react-icons/fi";
import { Modal, Button } from "../../shared/components/ui.jsx";
import { ItemStatusBadge } from "../../shared/components/status.jsx";
import { measurementsOf } from "../../shared/lib/invoice.js";
import { formatDateTime, formatDuration, humanize } from "../../shared/lib/format.js";
import { itemLabel, workItemTimeline } from "../lib/workplace.js";

export function MeasurementTable({ item }) {
    const rows = measurementsOf(item);
    if (!rows.length) return <div className="so-hint">No measurements for this item.</div>;
    return (
        <table className="tm-measure">
            <tbody>
                {rows.map((m) => (
                    <tr key={m.name}>
                        <th scope="row">{m.name}</th>
                        <td>
                            <b>{m.value || "—"}</b>
                            {m.unit ? ` ${m.unit}` : ""}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export function StageHistory({ item, invoiceDate }) {
    const people = {};
    if (item.tailor?.userId) people[item.tailor.userId] = item.tailor.name;
    if (item.shopAssistant?.userId) people[item.shopAssistant.userId] = item.shopAssistant.name;
    const steps = workItemTimeline(item, invoiceDate);
    return (
        <ol className="so-timeline">
            {steps.map((s, i) => (
                <li key={`${s.action}-${i}`} className={s.end ? "" : "current"}>
                    <div className="so-tl-title">{humanize(s.action)}</div>
                    <div className="so-tl-meta">
                        {s.start ? formatDateTime(s.start) : "—"}
                        {s.start && ` · ${formatDuration(s.start, s.end || new Date())}${s.end ? "" : " so far"}`}
                        {s.actorId && people[s.actorId] && ` · ${people[s.actorId]}`}
                    </div>
                </li>
            ))}
        </ol>
    );
}

export default function ItemDetailsModal({ item, invoiceDate, onClose }) {
    if (!item) return null;
    return (
        <Modal open={!!item} size="lg" title={itemLabel(item)} onClose={onClose}
            footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
            <div className="tm-detail">
                <div className="tm-detail-photo">
                    {item.imageUrl ? (
                        <a href={item.imageUrl} target="_blank" rel="noreferrer" title="Open the photo">
                            <img src={item.imageUrl} alt={item.itemName} />
                        </a>
                    ) : (
                        <div className="tm-photo-empty"><FiImage aria-hidden /> No photo</div>
                    )}
                </div>
                <div style={{ minWidth: 0 }}>
                    <div className="so-badges" style={{ marginBottom: 8 }}>
                        <ItemStatusBadge status={item.status} />
                        <span className="so-cell-sub so-mono">{item.invoiceId}</span>
                        {item.customerName && <span className="so-cell-sub">· {item.customerName}</span>}
                    </div>
                    {item.tailor?.name && <div className="so-cell-sub" style={{ marginBottom: 8 }}>Tailor: <b>{item.tailor.name}</b></div>}
                    <h3 className="tm-sub">Measurements</h3>
                    <MeasurementTable item={item} />
                </div>
            </div>
            <h3 className="tm-sub" style={{ marginTop: 16 }}>Stage history</h3>
            <StageHistory item={item} invoiceDate={invoiceDate || item.invoiceDate} />
        </Modal>
    );
}
