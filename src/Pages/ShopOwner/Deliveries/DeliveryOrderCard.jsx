// One open order on the Deliveries page (overdue / due / expected), as a two-column ticket:
// left = status, customer, items and contact tools; right = money and the one main action.
import { useNavigate } from "react-router-dom";
import {
    FiPhone, FiMessageCircle, FiExternalLink, FiCreditCard, FiCheckCircle, FiTruck, FiCalendar, FiCircle,
} from "react-icons/fi";
import { Button } from "../../shared/components/ui.jsx";
import { ItemProgress } from "../../shared/components/status.jsx";
import { formatMoney, formatDate, humanize } from "../../shared/lib/format.js";
import { telLink, whatsappLink } from "../lib/deliveries.js";

export default function DeliveryOrderCard({ order, shopName, busy, onCollect, onCompleteAll, onDeliver, onReschedule }) {
    const navigate = useNavigate();
    const open = () => navigate(`/shopOwner/invoices/${encodeURIComponent(order.invoiceId)}`);
    const tel = telLink(order.customerPhone);
    const wa = whatsappLink(order, shopName);
    const paid = !(order.balanceDue > 0.004);
    const late = order.daysOverdue > 0;

    // The one main action, then (only when both are needed) a second one.
    const collect = (
        <Button key="collect" size="sm" disabled={busy} onClick={() => onCollect(order)}>
            <FiCreditCard aria-hidden /> Collect {formatMoney(order.balanceDue)}
        </Button>
    );
    const deliver = (
        <Button key="deliver" size="sm" disabled={busy} onClick={() => onDeliver(order)}>
            <FiTruck aria-hidden /> Deliver &amp; receipt
        </Button>
    );
    const complete = (primary) => (
        <Button key="complete" variant={primary ? "primary" : "secondary"} size="sm" disabled={busy} onClick={() => onCompleteAll(order)}>
            <FiCheckCircle aria-hidden /> Mark all complete
        </Button>
    );
    const buttons = !paid ? [collect, !order.ready && complete(false)] : order.ready ? [deliver] : [complete(true)];
    const note = order.ready
        ? paid ? "Ready and paid — hand it over." : "Ready — collect the balance before handing it over."
        : paid ? "Paid — waiting on production." : "Delivery unlocks when the items are done and paid.";

    return (
        <article className="so-dt">
            <div className="so-dt-main">
                <div className="so-dt-eyebrow">
                    {late ? (
                        <span className="late">{order.daysOverdue} day{order.daysOverdue === 1 ? "" : "s"} late</span>
                    ) : null}
                    {late && <span className="sep">·</span>}
                    <span className={order.ready ? "ready" : ""}>{order.ready ? "Ready" : "In production"}</span>
                    <span className="sep">·</span>
                    <span>Due {formatDate(order.expectedDeliveryDate)}</span>
                </div>

                <div>
                    <div className="so-dt-name">{order.customerName || "Customer"}</div>
                    <div className="so-dt-contact">
                        <span>{order.customerPhone || "No phone"}</span>
                        <button type="button" className="so-dt-link so-mono" onClick={open} title="Open invoice">
                            {order.invoiceId}
                        </button>
                    </div>
                </div>

                <ul className="so-dt-items" aria-label="Items">
                    {(order.items || []).map((i, idx) => {
                        const done = i.status === "ORDER_COMPLETED";
                        return (
                            <li key={`${i.itemName}-${idx}`} className={done ? "done" : ""}>
                                {done ? <FiCheckCircle aria-label="Done" size={13} /> : <FiCircle aria-label="Not done" size={13} />}
                                <span>
                                    {i.itemName}
                                    {i.itemQuantity && i.itemQuantity !== 1 ? ` ×${i.itemQuantity}` : ""}
                                </span>
                                <span className="so-dt-step">{i.material ? "Material" : done ? "Done" : humanize(i.status)}</span>
                            </li>
                        );
                    })}
                </ul>
                <ItemProgress completed={order.completedItemCount} total={order.itemCount} />

                <div className="so-dt-tools">
                    {tel && (
                        <a className="so-btn so-btn-ghost so-btn-sm" href={tel}>
                            <FiPhone aria-hidden /> Call
                        </a>
                    )}
                    {wa && (
                        <a className="so-btn so-btn-ghost so-btn-sm" href={wa} target="_blank" rel="noreferrer">
                            <FiMessageCircle aria-hidden /> WhatsApp
                        </a>
                    )}
                    <Button variant="ghost" size="sm" onClick={open}>
                        <FiExternalLink aria-hidden /> Open
                    </Button>
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => onReschedule(order)}>
                        <FiCalendar aria-hidden /> Change date
                    </Button>
                </div>
            </div>

            <aside className="so-dt-side" aria-label="Payment">
                <div className="so-dt-label">{paid ? "Paid in full" : "Balance due"}</div>
                <div className="so-dt-amount">{formatMoney(paid ? order.totalAmountWithGST : order.balanceDue)}</div>
                {!paid && <div className="so-dt-of">of {formatMoney(order.totalAmountWithGST)}</div>}
                <div className="so-dt-note">{note}</div>
                <div className="so-dt-buttons">{buttons.filter(Boolean)}</div>
            </aside>
        </article>
    );
}
