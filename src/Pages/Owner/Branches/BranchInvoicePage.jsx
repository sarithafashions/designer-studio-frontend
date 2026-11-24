// Platform owner: one invoice of a branch, read only (GET /invoices/{invoiceId}?shopId=…).
// Opened from the branch page (Orders, Receipts, Deliveries rows). Same look as the shop owner's invoice page:
// header with stage / payment badges and PDFs, the delivered banner, items with their status (Track shows the
// step timings), customer card and the payment card (GST split, payment receipts with their PDFs).
// No edit, payment or status actions.
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FiArrowLeft, FiFileText, FiTruck, FiPhone, FiMail, FiActivity } from "react-icons/fi";
import { getBranchInvoice, openBranchInvoicePdf, openBranchReceiptPdf, listBranchPaymentReceipts, openBranchPaymentReceiptPdf } from "../../../api/owner.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { toast } from "../../../utils/toast.js";
import { Card, Button, ErrorBox, Skeleton, EmptyState } from "../../shared/components/ui.jsx";
import { StageBadge, PaymentBadge, OverdueBadge, ItemStatusBadge } from "../../shared/components/status.jsx";
import { TrackStatusModal } from "../../shared/production/Modals.jsx";
import { formatMoney, formatDate, formatDateTime, formatDueDate, formatNumber } from "../../shared/lib/format.js";
import { daysOverdue } from "../../shared/lib/invoice.js";

const BACK_TABS = ["orders", "receipts", "deliveries"];

/**
 * Item for the Track popup: invoice items keep their steps in assignmentHistory (the popup reads `history`), and a
 * delivered order is recorded on the invoice, not on the items, so delivery is added as the last step.
 */
const trackItem = (item, invoice) => {
    const history = (item.assignmentHistory || [])
        .filter((e) => e && e.action && e.timestamp)
        .map((e) => ({ action: e.action, timestamp: e.timestamp, userId: e.tailorId || null }));
    if (!invoice.receiptNo) return { ...item, history };
    if (invoice.deliveredAt) history.push({ action: "ORDER_DELIVERED", timestamp: invoice.deliveredAt, userId: null });
    return { ...item, history, itemOrderStatus: "ORDER_DELIVERED" };
};

export default function BranchInvoicePage() {
    const { shopId, invoiceId } = useParams();
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const from = BACK_TABS.includes(params.get("from")) ? params.get("from") : "orders";
    const [state, setState] = useState({ loading: true, invoice: null, error: "" });
    const [slips, setSlips] = useState({ loading: true, list: [], error: "" });
    const [track, setTrack] = useState(null);
    const [pdfBusy, setPdfBusy] = useState("");

    const load = useCallback(() => {
        setState({ loading: true, invoice: null, error: "" });
        getBranchInvoice(invoiceId, shopId)
            .then((invoice) => setState({ loading: false, invoice, error: "" }))
            .catch((err) => setState({ loading: false, invoice: null, error: getErrorMessage(err, "Could not load the invoice.") }));
        setSlips({ loading: true, list: [], error: "" });
        listBranchPaymentReceipts(invoiceId, shopId)
            .then((list) => setSlips({ loading: false, list: Array.isArray(list) ? list : list?.content || [], error: "" }))
            .catch((err) => setSlips({ loading: false, list: [], error: getErrorMessage(err, "Could not load the payment receipts.") }));
    }, [invoiceId, shopId]);
    useEffect(() => {
        load();
    }, [load]);

    const back = () => navigate(`/owner/branches/${encodeURIComponent(shopId)}${from === "orders" ? "" : `?tab=${from}`}`);
    const openPdf = async (key, open) => {
        setPdfBusy(key);
        try {
            await open();
        } catch (err) {
            toast.error("Could not open the PDF", getErrorMessage(err));
        } finally {
            setPdfBusy("");
        }
    };

    const backLink = (
        <button type="button" className="so-back" onClick={back}>
            <FiArrowLeft aria-hidden /> Back to the branch
        </button>
    );

    if (state.loading) {
        return (
            <>
                {backLink}
                <Skeleton height={60} style={{ marginBottom: 16 }} />
                <div className="so-grid so-grid-main"><Skeleton height={320} /><Skeleton height={320} /></div>
            </>
        );
    }
    if (state.error || !state.invoice) {
        return (
            <>
                {backLink}
                {state.error ? <ErrorBox message={state.error} onRetry={load} /> : <EmptyState title="Invoice not found" />}
            </>
        );
    }

    const invoice = state.invoice;
    const items = invoice.items || [];
    const workItems = items.filter((i) => !i.material); // materials have no production steps
    const done = workItems.filter((i) => ["ORDER_COMPLETED", "ORDER_DELIVERED"].includes(i.itemOrderStatus)).length;
    const delivered = !!invoice.receiptNo;
    const late = daysOverdue(invoice.expectedDeliveryDate, invoice.stage);

    return (
        <>
            {backLink}

            <header className="so-page-head" style={{ alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                    <div className="so-eyebrow">Invoice · view only</div>
                    <h1 className="so-page-title so-mono" style={{ fontFamily: "var(--so-font-display)" }}>{invoice.invoiceId}</h1>
                    <div className="so-badges" style={{ marginTop: 8 }}>
                        <StageBadge stage={invoice.stage} />
                        <PaymentBadge status={invoice.paymentStatus} />
                        <OverdueBadge days={late} />
                        <span className="so-cell-sub">{workItems.length ? `${done}/${workItems.length} items completed` : "Material only"}</span>
                    </div>
                </div>
                <div className="so-actions">
                    <Button variant="secondary" disabled={pdfBusy === "invoice"}
                        onClick={() => openPdf("invoice", () => openBranchInvoicePdf(invoice.invoiceId, shopId))}>
                        <FiFileText aria-hidden /> {pdfBusy === "invoice" ? "Opening PDF..." : "Invoice PDF"}
                    </Button>
                </div>
            </header>

            {delivered && (
                <div className="so-delivered" role="status">
                    <FiTruck aria-hidden className="so-delivered-icon" />
                    <div className="so-delivered-text">
                        <div className="so-delivered-title">
                            {invoice.deliveredAt ? `Delivered on ${formatDateTime(invoice.deliveredAt)}` : "Delivered"}
                        </div>
                        <div className="so-cell-sub">Receipt <span className="so-mono">{invoice.receiptNo}</span></div>
                    </div>
                    <Button variant="secondary" size="sm" disabled={pdfBusy === "receipt"}
                        onClick={() => openPdf("receipt", () => openBranchReceiptPdf(invoice.receiptNo))}>
                        <FiFileText aria-hidden /> Receipt PDF
                    </Button>
                </div>
            )}

            <div className="so-grid so-grid-main" style={{ alignItems: "start" }}>
                <Card title="Items" subtitle={`${items.length} item${items.length === 1 ? "" : "s"} · ${done} of ${workItems.length} completed`}>
                    {!items.length ? (
                        <EmptyState title="No items" compact />
                    ) : (
                        <div className="so-table-wrap">
                            <table className="so-table">
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        <th className="so-num">Qty</th>
                                        <th className="so-num">Price</th>
                                        <th>Status</th>
                                        <th aria-label="Track" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((it, i) => (
                                        <tr key={it.itemUniqueId || i}>
                                            <td><div className="so-cell-main">{it.itemName || "Item"}</div></td>
                                            <td className="so-num">{formatNumber(it.itemQuantity)}</td>
                                            <td className="so-num">{formatMoney(it.itemPrice)}</td>
                                            <td><ItemStatusBadge status={it.itemOrderStatus} material={!!it.material} /></td>
                                            <td>
                                                {!it.material && (
                                                    <Button variant="ghost" size="sm" onClick={() => setTrack(trackItem(it, invoice))}>
                                                        <FiActivity aria-hidden /> Track
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>

                <div className="so-stack">
                    <Card title="Customer">
                        <div className="so-cell-main" style={{ fontSize: 16 }}>{invoice.customer?.name || "—"}</div>
                        <div className="so-stack" style={{ gap: 4, marginTop: 6, fontSize: 13 }}>
                            {invoice.customer?.phone && (
                                <a href={`tel:${invoice.customer.phone}`} style={{ color: "var(--so-ink)", display: "inline-flex", gap: 6, alignItems: "center" }}>
                                    <FiPhone aria-hidden /> {invoice.customer.phone}
                                </a>
                            )}
                            {invoice.customer?.email && (
                                <a href={`mailto:${invoice.customer.email}`} style={{ color: "var(--so-ink)", display: "inline-flex", gap: 6, alignItems: "center" }}>
                                    <FiMail aria-hidden /> {invoice.customer.email}
                                </a>
                            )}
                        </div>
                        <dl className="so-dl" style={{ marginTop: 16 }}>
                            <dt>Invoice date</dt>
                            <dd>{formatDate(invoice.invoiceDate)}</dd>
                            <dt>Expected delivery</dt>
                            <dd>{formatDueDate(invoice.expectedDeliveryDate)}</dd>
                            {delivered && (
                                <>
                                    <dt>Delivered on</dt>
                                    <dd>{invoice.deliveredAt ? formatDateTime(invoice.deliveredAt) : "Not recorded"}</dd>
                                    <dt>Receipt</dt>
                                    <dd className="so-mono">{invoice.receiptNo}</dd>
                                </>
                            )}
                        </dl>
                        {invoice.notes && <div className="so-note" style={{ marginTop: 12 }}>{invoice.notes}</div>}
                    </Card>

                    <PaymentCard invoice={invoice} slips={slips} pdfBusy={pdfBusy}
                        onOpenSlip={(no) => openPdf(no, () => openBranchPaymentReceiptPdf(no, shopId))} />
                </div>
            </div>

            <TrackStatusModal item={track} invoiceId={invoice.invoiceId} customerName={invoice.customer?.name}
                invoiceDate={invoice.invoiceDate} onClose={() => setTrack(null)} />
        </>
    );
}

/**
 * Amounts with the GST split, then the payment receipts (one per payment, each with its PDF). If they cannot be
 * loaded, the payments from the invoice's own history are listed instead (without PDFs).
 */
function PaymentCard({ invoice: a, slips, pdfBusy, onOpenSlip }) {
    const rate = (r) => (r ? ` (${Number(r).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%)` : "");
    const taxes = [
        { key: "cgst", label: `CGST${rate(a.cgstRate)}`, amount: a.cgstAmount || 0, rate: a.cgstRate },
        { key: "sgst", label: `SGST${rate(a.sgstRate)}`, amount: a.sgstAmount || 0, rate: a.sgstRate },
        { key: "igst", label: `IGST${rate(a.igstRate)}`, amount: a.igstAmount || 0, rate: a.igstRate },
    ].filter((t) => t.amount > 0 || t.rate > 0);
    const taxable = a.taxableAmount ?? Math.max(0, (a.totalAmount || 0) - (a.discount || 0));
    const payments = (a.paymentHistories || []).filter((p) => !p.discountApplied && Number(p.amount) > 0);

    return (
        <Card title="Payment" actions={<PaymentBadge status={a.paymentStatus} />}>
            <dl className="so-dl">
                <dt>Items total</dt>
                <dd>{formatMoney(a.totalAmount)}</dd>
                {a.discount > 0 && (
                    <>
                        <dt>Discount</dt>
                        <dd>− {formatMoney(a.discount)}</dd>
                        <dt>Taxable amount</dt>
                        <dd>{formatMoney(taxable)}</dd>
                    </>
                )}
                {taxes.length ? (
                    taxes.map((t) => (
                        <div key={t.key} style={{ display: "contents" }}>
                            <dt>{t.label}</dt>
                            <dd>{formatMoney(t.amount)}</dd>
                        </div>
                    ))
                ) : (
                    <>
                        <dt>GST</dt>
                        <dd>{formatMoney(0)}</dd>
                    </>
                )}
                <dt className="so-dl-total">Total</dt>
                <dd className="so-dl-total">{formatMoney(a.totalAmountWithGST)}</dd>
                <dt>Paid</dt>
                <dd>{formatMoney(a.advancePaid)}</dd>
                <dt style={{ fontWeight: 600, color: "var(--so-primary)" }}>Balance due</dt>
                <dd style={{ fontWeight: 600, color: a.balanceDue > 0 ? "var(--so-danger)" : "var(--so-success)" }}>
                    {formatMoney(a.balanceDue)}
                </dd>
            </dl>

            <h3 className="so-card-title" style={{ fontSize: 14, margin: "18px 0 8px" }}>
                Payment receipts ({slips.error ? payments.length : slips.list.length})
            </h3>
            {slips.loading ? (
                <Skeleton height={60} />
            ) : !slips.error ? (
                !slips.list.length ? (
                    <EmptyState title="No payments yet" compact />
                ) : (
                    <div className="so-list">
                        {slips.list.map((p) => (
                            <div className="so-list-row" key={p.paymentReceiptNo}>
                                <div className="so-list-main">
                                    <div className="so-list-title">{formatMoney(p.amount)}</div>
                                    <div className="so-list-meta">
                                        <span className="so-mono">{p.paymentReceiptNo}</span> · {p.paidVia || "Not recorded"} · {formatDateTime(p.paidAt)}
                                        {p.receivedBy ? ` · by ${p.receivedBy}` : ""}
                                    </div>
                                </div>
                                <div className="so-list-side">
                                    <Button variant="ghost" size="sm" disabled={pdfBusy === p.paymentReceiptNo}
                                        onClick={() => onOpenSlip(p.paymentReceiptNo)} title="Open payment receipt">
                                        <FiFileText aria-hidden /> PDF
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            ) : !payments.length ? (
                <EmptyState title="No payments yet" compact />
            ) : (
                <div className="so-list">
                    {payments.map((p, i) => (
                        <div className="so-list-row" key={`${p.paidAt}-${i}`}>
                            <div className="so-list-main">
                                <div className="so-list-title">{formatMoney(p.amount)}</div>
                                <div className="so-list-meta">{p.paidVia || "Not recorded"} · {formatDateTime(p.paidAt)}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}
