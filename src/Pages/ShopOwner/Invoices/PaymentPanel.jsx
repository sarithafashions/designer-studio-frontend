// Amounts, payments (each with its payment receipt) and the payment / discount / deliver actions.
import { FiPlus, FiPercent, FiFileText, FiTruck } from "react-icons/fi";
import { Card, Button, EmptyState } from "../../shared/components/ui.jsx";
import { PaymentBadge } from "../../shared/components/status.jsx";
import { formatMoney, formatDateTime } from "../../shared/lib/format.js";

export default function PaymentPanel({ invoice, account, accountError, busy, canDeliver, deliverHint, onPay, onDiscount, onDeliver, onOpenPaymentReceipt }) {
    const a = account || invoice;
    const delivered = !!invoice.receiptNo;
    // GST split: amounts from the account (after any discount), rates from the invoice.
    const rate = (r) => (r ? ` (${Number(r).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%)` : "");
    const taxes = [
        { key: "cgst", label: `CGST${rate(invoice.cgstRate)}`, amount: a.cgstAmount || 0, rate: invoice.cgstRate },
        { key: "sgst", label: `SGST${rate(invoice.sgstRate)}`, amount: a.sgstAmount || 0, rate: invoice.sgstRate },
        { key: "igst", label: `IGST${rate(invoice.igstRate)}`, amount: a.igstAmount || 0, rate: invoice.igstRate },
    ].filter((t) => t.amount > 0 || t.rate > 0);
    const taxable = a.taxableAmount ?? Math.max(0, (a.totalAmount || 0) - (a.discount || 0));
    const payments = account?.payments || [];

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

            {!delivered && (
                <div className="so-actions" style={{ marginTop: 16 }}>
                    <Button size="sm" disabled={busy || !(a.balanceDue > 0)} onClick={onPay}>
                        <FiPlus aria-hidden /> Record payment
                    </Button>
                    <Button variant="secondary" size="sm" disabled={busy || !(a.balanceDue > 0)} onClick={onDiscount}>
                        <FiPercent aria-hidden /> Discount
                    </Button>
                </div>
            )}

            {/* Once delivered, the final receipt is opened from the "Delivered" banner at the top of the page. */}
            {!delivered && (
                <div style={{ marginTop: 16 }}>
                    <Button variant={canDeliver ? "primary" : "secondary"} size="sm" disabled={busy || !canDeliver} onClick={onDeliver}>
                        <FiTruck aria-hidden /> Deliver &amp; generate receipt
                    </Button>
                    {!canDeliver && deliverHint && <div className="so-hint" style={{ marginTop: 6 }}>{deliverHint}</div>}
                </div>
            )}

            <hr className="so-card-divider" />
            <h3 className="so-card-title" style={{ fontSize: 14, margin: "0 0 8px" }}>
                Payment history
            </h3>
            {accountError ? (
                <div className="so-hint">Could not load payments: {accountError}</div>
            ) : payments.length === 0 ? (
                <EmptyState title="No payments yet" compact />
            ) : (
                <div className="so-list">
                    {payments.map((p, i) => (
                        <div className="so-list-row" key={`${p.paymentReceiptNo || i}-${p.paidAt}`}>
                            <div className="so-list-main">
                                <div className="so-list-title">{formatMoney(p.amount)}</div>
                                <div className="so-list-meta">
                                    {p.paidVia || "—"} · {formatDateTime(p.paidAt)}
                                    {p.transactionId ? ` · ${p.transactionId}` : ""}
                                </div>
                            </div>
                            {p.paymentReceiptNo ? (
                                <Button variant="ghost" size="sm" onClick={() => onOpenPaymentReceipt(p.paymentReceiptNo)} title="Open payment receipt">
                                    <FiFileText aria-hidden /> Receipt
                                </Button>
                            ) : (
                                <span className="so-list-meta">Advance</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}
