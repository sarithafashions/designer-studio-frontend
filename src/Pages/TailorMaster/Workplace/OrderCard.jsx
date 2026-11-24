// One order (invoice) on the workplace with its items in the tailor master's stages.
// Buttons come from each item's availableActions: CUTTING → "Start cutting", ASSIGN_TAILOR → "Assign / Re-assign".
import { FiScissors, FiUserPlus, FiImage, FiChevronRight, FiAlertTriangle, FiCalendar } from "react-icons/fi";
import { Button, Badge } from "../../shared/components/ui.jsx";
import { ItemStatusBadge } from "../../shared/components/status.jsx";
import { measurementsOf } from "../../shared/lib/invoice.js";
import { formatDate } from "../../shared/lib/format.js";
import { dueInfo, itemLabel, canCut, canAssign } from "../lib/workplace.js";

export function DueBadge({ dueDate, daysOverdue }) {
    const d = dueInfo(dueDate, daysOverdue);
    const Icon = d.tone === "danger" ? FiAlertTriangle : FiCalendar;
    return (
        <span title={d.date ? `Delivery ${d.date}` : undefined}>
            <Badge tone={d.tone === "neutral" ? "neutral" : d.tone} icon={<Icon aria-hidden size={12} />}>
                {d.text}
                {d.date && d.tone !== "danger" ? ` · ${d.date}` : ""}
            </Badge>
        </span>
    );
}

export function ItemRow({ item, busy, onCut, onAssign, onOpen }) {
    const count = measurementsOf(item).length;
    return (
        <li className="tm-item">
            <button type="button" className="tm-thumb" onClick={() => onOpen(item)} title="Photo and measurements">
                {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <FiImage aria-hidden />}
            </button>
            <div className="tm-item-main">
                <button type="button" className="tm-item-name" onClick={() => onOpen(item)}>{itemLabel(item)}</button>
                <div className="tm-item-meta">
                    <ItemStatusBadge status={item.status} />
                    {item.tailor?.name && <span className="so-cell-sub">· {item.tailor.name}</span>}
                    <button type="button" className="tm-link" onClick={() => onOpen(item)}>
                        {count ? `${count} measurement${count === 1 ? "" : "s"}` : "No measurements"}
                    </button>
                </div>
            </div>
            <div className="tm-item-actions">
                {canCut(item) && (
                    <Button size="sm" disabled={busy} onClick={() => onCut([item])}>
                        <FiScissors aria-hidden /> Start cutting
                    </Button>
                )}
                {canAssign(item) && (
                    <Button size="sm" variant={item.tailor ? "secondary" : "primary"} disabled={busy} onClick={() => onAssign([item])}>
                        <FiUserPlus aria-hidden /> {item.tailor ? "Re-assign" : "Assign tailor"}
                    </Button>
                )}
            </div>
        </li>
    );
}

export default function OrderCard({ order, busy, onCut, onAssign, onOpenItem, onOpenOrder }) {
    const items = order.items || [];
    const toCut = items.filter(canCut);
    const toAssign = items.filter((i) => canAssign(i) && !i.tailor); // first assignment (cut, waiting for a tailor)
    return (
        <article className={`tm-order ${order.daysOverdue > 0 ? "late" : ""}`}>
            <header className="tm-order-head">
                <div style={{ minWidth: 0 }}>
                    <div className="tm-order-title">
                        <button type="button" className="tm-link so-mono" onClick={() => onOpenOrder(order)}>{order.invoiceId}</button>
                        <span className="tm-order-customer">{order.customerName || "Customer"}</span>
                    </div>
                    <div className="so-cell-sub">
                        Ordered {formatDate(order.invoiceDate)} · {items.length} item{items.length === 1 ? "" : "s"} here
                    </div>
                </div>
                <DueBadge dueDate={order.dueDate} daysOverdue={order.daysOverdue} />
            </header>

            <ul className="tm-items">
                {items.map((item) => (
                    <ItemRow key={item.itemUniqueId} item={item} busy={busy} onCut={onCut} onAssign={onAssign} onOpen={onOpenItem} />
                ))}
            </ul>

            <footer className="tm-order-foot">
                {toCut.length > 1 && (
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => onCut(toCut)}>
                        <FiScissors aria-hidden /> Start cutting all ({toCut.length})
                    </Button>
                )}
                {toAssign.length > 1 && (
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAssign(toAssign)}>
                        <FiUserPlus aria-hidden /> One tailor for all cut items ({toAssign.length})
                    </Button>
                )}
                <span className="tm-spacer" />
                <Button size="sm" variant="ghost" onClick={() => onOpenOrder(order)}>
                    View order <FiChevronRight aria-hidden />
                </Button>
            </footer>
        </article>
    );
}
