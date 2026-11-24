// A deleted (archived) invoice, read-only: deletion note + everything the invoice had (GET /reports/deleted-invoices/{id}).
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft, FiTrash2 } from "react-icons/fi";
import { getDeletedInvoice } from "../../../api/reports.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { Card, Badge, ErrorBox, Skeleton, EmptyState } from "../../shared/components/ui.jsx";
import { PaymentBadge, ItemStatusBadge } from "../../shared/components/status.jsx";
import { formatMoney, formatNumber, formatDate, formatDateTime, formatDueDate } from "../../shared/lib/format.js";
import { measurementsOf } from "../../shared/lib/invoice.js";

export default function DeletedInvoiceDetail() {
    const { archiveId } = useParams();
    const navigate = useNavigate();
    const [state, setState] = useState({ loading: true, data: null, error: "" });

    const load = useCallback(() => {
        setState({ loading: true, data: null, error: "" });
        getDeletedInvoice(archiveId)
            .then((data) => setState({ loading: false, data, error: "" }))
            .catch((err) => setState({ loading: false, data: null, error: getErrorMessage(err, "Could not load the deleted invoice") }));
    }, [archiveId]);
    useEffect(() => load(), [load]);

    const back = (
        <button type="button" className="so-back" onClick={() => navigate("/shopOwner/invoices?tab=deleted")}>
            <FiArrowLeft aria-hidden /> Back to deleted invoices
        </button>
    );

    if (state.error) return <>{back}<ErrorBox message={state.error} onRetry={load} /></>;
    if (state.loading) return <>{back}<Skeleton height={300} /></>;

    const d = state.data;
    const inv = d.invoice || {};
    const items = inv.items || [];
    const payments = inv.paymentHistories || [];
    const gst = (inv.cgstAmount || 0) + (inv.sgstAmount || 0) + (inv.igstAmount || 0);

    return (
        <>
            {back}
            <header className="so-page-head" style={{ alignItems: "flex-start" }}>
                <div>
                    <div className="so-eyebrow">Deleted invoice</div>
                    <h1 className="so-page-title so-mono" style={{ fontFamily: "var(--so-font-display)" }}>{inv.invoiceId || "—"}</h1>
                    <div className="so-badges" style={{ marginTop: 8 }}>
                        <Badge tone="danger" icon={<FiTrash2 aria-hidden size={12} />}>Deleted</Badge>
                        <PaymentBadge status={inv.paymentStatus} />
                    </div>
                </div>
            </header>

            <Card className="" title="Why it was deleted">
                <div className="so-note">{d.reason || "No reason given"}</div>
                <div className="so-cell-sub" style={{ marginTop: 8 }}>
                    {formatDateTime(d.deletedAt)} · by {d.deletedByName || d.deletedBy || "—"}
                </div>
            </Card>

            <div className="so-grid so-grid-main" style={{ marginTop: 16 }}>
                <Card title="Items" subtitle={`${items.length} item${items.length === 1 ? "" : "s"} at the time of deletion`}>
                    {items.length === 0 ? (
                        <EmptyState title="No items" compact />
                    ) : (
                        <div className="so-stack" style={{ gap: 12 }}>
                            {items.map((item, i) => {
                                const ms = measurementsOf(item);
                                return (
                                    <article className="so-item" key={item.itemUniqueId || i}>
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                                            <div>
                                                <div className="so-item-title">{item.itemName}</div>
                                                <div className="so-cell-sub">
                                                    {formatNumber(item.itemQuantity)} × {formatMoney(item.itemPrice)}
                                                </div>
                                            </div>
                                            <ItemStatusBadge status={item.itemOrderStatus} material={!!item.material} />
                                        </div>
                                        {ms.length > 0 && (
                                            <div className="so-chips">
                                                {ms.map((m) => (
                                                    <span className="so-chip" key={m.name}>
                                                        {m.name}: <b>{m.value || "—"}</b>
                                                        {m.unit ? ` ${m.unit}` : ""}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </Card>

                <div className="so-stack">
                    <Card title="Customer">
                        <div className="so-cell-main" style={{ fontSize: 16 }}>{inv.customer?.name || "—"}</div>
                        <div className="so-cell-sub">{inv.customer?.phone}</div>
                        {inv.customer?.email && <div className="so-cell-sub">{inv.customer.email}</div>}
                        <dl className="so-dl" style={{ marginTop: 16 }}>
                            <dt>Invoice date</dt>
                            <dd>{formatDate(inv.invoiceDate)}</dd>
                            <dt>Expected delivery</dt>
                            <dd>{formatDueDate(inv.expectedDeliveryDate)}</dd>
                        </dl>
                        {inv.notes && <div className="so-note" style={{ marginTop: 12 }}>{inv.notes}</div>}
                    </Card>

                    <Card title="Amounts">
                        <dl className="so-dl">
                            <dt>Items total</dt>
                            <dd>{formatMoney(inv.totalAmount)}</dd>
                            {inv.discount > 0 && (
                                <>
                                    <dt>Discount</dt>
                                    <dd>− {formatMoney(inv.discount)}</dd>
                                </>
                            )}
                            <dt>GST</dt>
                            <dd>{formatMoney(gst)}</dd>
                            <dt className="so-dl-total">Total</dt>
                            <dd className="so-dl-total">{formatMoney(inv.totalAmountWithGST)}</dd>
                            <dt>Paid</dt>
                            <dd>{formatMoney(inv.advancePaid)}</dd>
                            <dt>Balance</dt>
                            <dd>{formatMoney(inv.balanceDue)}</dd>
                        </dl>
                        {payments.length > 0 && (
                            <>
                                <h3 className="so-card-title" style={{ fontSize: 14, margin: "20px 0 8px" }}>Payments</h3>
                                <div className="so-list">
                                    {payments.map((p, i) => (
                                        <div className="so-list-row" key={i}>
                                            <div className="so-list-main">
                                                <div className="so-list-title">{formatMoney(p.amount)}</div>
                                                <div className="so-list-meta">
                                                    {p.paidVia || "—"} · {formatDateTime(p.paidAt)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </Card>
                </div>
            </div>
        </>
    );
}
