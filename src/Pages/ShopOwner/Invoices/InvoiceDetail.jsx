// Invoice detail: header + actions, items (step / assign / stage history), payment panel, customer details.
// Every change reloads the invoice; a 409 (changed meanwhile) reloads and asks to try again.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { FiArrowLeft, FiFileText, FiEdit2, FiTrash2, FiPhone, FiMail, FiCheckCircle, FiTruck } from "react-icons/fi";
import {
    getInvoice, getInvoiceAccount, recordPayment, applyDiscount, generateReceipt, editInvoice, deleteInvoice,
    openInvoicePdf, openReceiptPdf, openPaymentReceiptPdf,
} from "../../../api/invoices.js";
import {
    getWorkItem, updateItemStatus, assignTailor, assignShopAssistant, unassignTailor, unassignShopAssistant, completeItem, completeAllItems,
} from "../../../api/production.js";
import { listShopEmployees } from "../../../api/employees.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { toast } from "../../../utils/toast.js";
import { Card, Button, ErrorBox, Skeleton, EmptyState } from "../../shared/components/ui.jsx";
import { StageBadge, PaymentBadge, OverdueBadge } from "../../shared/components/status.jsx";
import { formatDate, formatDateTime, formatDueDate, humanize } from "../../shared/lib/format.js";
import { daysOverdue, isConflict, remainingSteps, movesTo } from "../../shared/lib/invoice.js";
import ItemCard from "./ItemCard.jsx";
import PaymentPanel from "./PaymentPanel.jsx";
import { PaymentModal, DiscountModal, AssignModal, EditDetailsModal, DeleteModal } from "./InvoiceModals.jsx";
import InvoiceWizard from "./wizard/InvoiceWizard.jsx";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Confirmation for "mark complete" with an optional note. Resolves { ok, note }. */
const confirmComplete = (title, html, confirmButtonText) =>
    Swal.fire({
        title,
        html,
        input: "text",
        inputPlaceholder: "Note (optional), e.g. Ravi finished it on Monday",
        inputAttributes: { maxlength: "200", "aria-label": "Note (optional)" },
        showCancelButton: true,
        confirmButtonText,
        cancelButtonText: "Cancel",
        reverseButtons: true,
        confirmButtonColor: "#17171c",
    }).then((r) => ({ ok: r.isConfirmed, note: (r.value || "").trim() }));

const confirm = (title, text, confirmButtonText = "Yes") =>
    Swal.fire({ title, text, showCancelButton: true, confirmButtonText, cancelButtonText: "Cancel", reverseButtons: true, confirmButtonColor: "#17171c" })
        .then((r) => r.isConfirmed);

export default function InvoiceDetail() {
    const { invoiceId } = useParams();
    const navigate = useNavigate();

    const [invoice, setInvoice] = useState(null);
    const [loadError, setLoadError] = useState("");
    const [account, setAccount] = useState({ data: null, error: "" });
    const [work, setWork] = useState({}); // itemUniqueId -> { data, error }
    const [people, setPeople] = useState({});
    const [busy, setBusy] = useState(false);
    const [modal, setModal] = useState(null); // { type, ... }
    const [pdfLoading, setPdfLoading] = useState(null); //loading state for the PDF download loading

    const load = useCallback(async () => {
        setLoadError("");
        let inv;
        try {
            inv = await getInvoice(invoiceId);
        } catch (err) {
            setLoadError(getErrorMessage(err, "Could not load the invoice"));
            return;
        }
        setInvoice(inv);
        const items = inv.items || [];
        const [acc, works] = await Promise.allSettled([
            getInvoiceAccount(invoiceId),
            Promise.allSettled(items.map((it) => getWorkItem(invoiceId, it.itemUniqueId))),
        ]);
        setAccount(acc.status === "fulfilled" ? { data: acc.value, error: "" } : { data: null, error: getErrorMessage(acc.reason) });
        const w = {};
        if (works.status === "fulfilled") {
            works.value.forEach((r, i) => {
                w[items[i].itemUniqueId] = r.status === "fulfilled" ? { data: r.value } : { error: getErrorMessage(r.reason) };
            });
        }
        setWork(w);
    }, [invoiceId]);

    useEffect(() => {
        load();
    }, [load]);

    // Employee names for history entries (who acted).
    useEffect(() => {
        listShopEmployees()
            .then((list) => {
                const map = {};
                list.forEach((e) => (map[e.userId] = e.name));
                const me = localStorage.getItem("userId");
                if (me) map[me] = map[me] || `${localStorage.getItem("username") || "Shop owner"} (you)`;
                setPeople(map);
            })
            .catch(() => {});
    }, []);

    const nameOf = useCallback(
        (userId) => {
            if (!userId) return "—";
            if (people[userId]) return people[userId];
            for (const w of Object.values(work)) {
                if (w.data?.tailor?.userId === userId) return w.data.tailor.name;
                if (w.data?.shopAssistant?.userId === userId) return w.data.shopAssistant.name;
            }
            return "Staff member";
        },
        [people, work],
    );

    /** Run a change: success toast + reload; 409 -> reload and ask to retry; other errors -> toast. */
    const run = async (fn, success) => {
        setBusy(true);
        try {
            const result = await fn();
            if (success) toast.success(success);
            await load();
            return result;
        } catch (err) {
            if (isConflict(err)) {
                toast.warning("This invoice just changed", "We reloaded it — please check and try again.");
                await load();
            } else {
                toast.error("Could not save", getErrorMessage(err));
            }
            throw err;
        } finally {
            setBusy(false);
        }
    };
    const quiet = (promise) => promise.catch(() => undefined);
    // const openPdf = (fn) => fn().catch((err) => toast.error("Could not open the PDF", getErrorMessage(err)));
    const openPdf = async (keyOrFn, maybeFn) => {
        const isOneArg = typeof keyOrFn === "function";
        const key = isOneArg ? "default" : keyOrFn;
        const fn = isOneArg ? keyOrFn : maybeFn;

        if (pdfLoading) return;
        setPdfLoading(key);
        try {
            await fn();
        } catch (err) {
            console.error(err);
            toast.error("Could not open the PDF", getErrorMessage(err));
        } finally {
            setPdfLoading(null);
        }
    };

    const stats = useMemo(() => {
        const items = (invoice?.items || []).filter((i) => !i.material); // materials have no production steps
        const done = items.filter((i) => i.itemOrderStatus === "ORDER_COMPLETED").length;
        return { total: items.length, done };
    }, [invoice]);

    if (loadError) {
        return (
            <>
                <BackLink onClick={() => navigate("/shopOwner/invoices")} />
                <ErrorBox message={loadError} onRetry={load} />
            </>
        );
    }
    if (!invoice) {
        return (
            <div className="so-stack">
                <Skeleton height={28} width="40%" />
                <Skeleton height={140} />
                <Skeleton height={320} />
            </div>
        );
    }

    const delivered = !!invoice.receiptNo;
    const balance = account.data?.balanceDue ?? invoice.balanceDue;
    const allDone = stats.total > 0 && stats.done === stats.total;
    const canDeliver = !delivered && allDone && balance <= 0.004;
    const deliverHint = !allDone
        ? `${stats.total - stats.done} of ${stats.total} items still in production`
        : balance > 0
          ? "Collect the balance first"
          : "";
    const late = daysOverdue(invoice.expectedDeliveryDate, invoice.stage);
    // ---- actions
    const onMove = async (item, status) => {
        // hemming & ironing is one step on screen: moving on from hemming finishes the item (ironing, then completed)
        const moves = movesTo(item.itemOrderStatus, status);
        const target = humanize(moves.at(-1));
        if (!(await confirm(`Move ${item.itemName} to ${target}?`, "This is recorded as done by you (shop owner).", "Move")))
            return;
        quiet(run(async () => {
            for (const to of moves) await updateItemStatus(invoiceId, item.itemUniqueId, to);
        }, `${item.itemName}: ${target}`));
    };
    const onUnassign = async (item, kind) => {
        const role = kind === "tailor" ? "tailor" : "shop assistant";
        if (!(await confirm(`Remove the ${role} from ${item.itemName}?`, "The item goes back one step.", "Remove"))) return;
        quiet(
            run(
                () => (kind === "tailor" ? unassignTailor : unassignShopAssistant)(invoiceId, item.itemUniqueId),
                `${role.charAt(0).toUpperCase() + role.slice(1)} removed`,
            ),
        );
    };
    // ---- mark complete (work done but not updated in the app)
    const onComplete = async (item) => {
        const skipped = remainingSteps(item.itemOrderStatus);
        const { ok, note } = await confirmComplete(
            `Mark ${item.itemName} as completed?`,
            `It is at <b>${esc(humanize(item.itemOrderStatus) || "the start")}</b>.` +
                (skipped.length ? ` The remaining steps (${esc(skipped.join(", "))}) are skipped.` : "") +
                "<br/>Recorded as done by you (shop owner). This can't be undone.",
            "Mark complete",
        );
        if (!ok) return;
        quiet(run(() => completeItem(invoiceId, item.itemUniqueId, note), `${item.itemName} marked completed`));
    };
    const onCompleteAll = async () => {
        const open = (invoice.items || []).filter((i) => i.itemOrderStatus !== "ORDER_COMPLETED");
        const list = open.map((i) => `<li><b>${esc(i.itemName)}</b> — ${esc(humanize(i.itemOrderStatus) || "not started")}</li>`).join("");
        const { ok, note } = await confirmComplete(
            `Mark all ${open.length} item${open.length === 1 ? "" : "s"} as completed?`,
            `<ul style="text-align:left;margin:0 0 8px;padding-left:18px">${list}</ul>` +
                "Their remaining steps are skipped. Recorded as done by you (shop owner). This can't be undone.",
            "Mark all complete",
        );
        if (!ok) return;
        try {
            const res = await run(() => completeAllItems(invoiceId, note));
            const failed = res?.failed || [];
            if (failed.length) {
                Swal.fire({
                    icon: "warning",
                    title: `${res.completed.length} completed, ${failed.length} not`,
                    html: `<ul style="text-align:left;padding-left:18px">${failed
                        .map((f) => `<li><b>${esc(f.itemName || f.itemUniqueId)}</b>: ${esc(f.reason)}</li>`)
                        .join("")}</ul>`,
                    confirmButtonColor: "#17171c",
                });
            } else {
                toast.success(`${res.completed.length} item${res.completed.length === 1 ? "" : "s"} marked completed`);
            }
        } catch {
            /* run() already showed the error */
        }
    };
    const openItems = (invoice.items || []).filter((i) => i.itemOrderStatus !== "ORDER_COMPLETED").length;

    const submitAssign = (userId) =>
        quiet(
            run(
                () => (modal.kind === "tailor" ? assignTailor : assignShopAssistant)(invoiceId, modal.item.itemUniqueId, userId),
                "Assigned",
            ).then(() => setModal(null)),
        );

    const submitPayment = (body) =>
        quiet(
            run(() => recordPayment(invoiceId, body), "Payment recorded").then(async (acc) => {
                setModal(null);
                const no = acc?.paymentReceipt?.paymentReceiptNo;
                if (no && (await confirm("Payment recorded", `Payment receipt ${no} was created. Open it?`, "Open receipt"))) {
                    openPdf(no, () => openPaymentReceiptPdf(no));
                }
            }),
        );
    const submitDiscount = (body) => quiet(run(() => applyDiscount(invoiceId, body), "Discount applied").then(() => setModal(null)));
    const submitEdit = (changes) => quiet(run(() => editInvoice(invoiceId, changes), "Invoice updated").then(() => setModal(null)));
    const submitDelete = async (reason) => {
        setBusy(true);
        try {
            await deleteInvoice(invoiceId, reason);
            toast.success("Invoice deleted");
            navigate("/shopOwner/invoices?tab=deleted", { replace: true });
        } catch (err) {
            toast.error("Could not delete", getErrorMessage(err));
            if (isConflict(err)) load();
        } finally {
            setBusy(false);
        }
    };
    const onDeliver = async () => {
        if (!(await confirm("Deliver this order?", "This generates the final receipt. The invoice can't be edited or deleted after this.", "Deliver")))
            return;
        quiet(
            run(() => generateReceipt(invoiceId), "Delivered — receipt generated").then((receipt) => {
                if (receipt?.receiptNo) openPdf("receipt", () => openReceiptPdf(receipt.receiptNo));
            }),
        );
    };

    return (
        <>
            {/* Back keeps the list filters when we came from the list; a direct link goes to the list. */}
            <BackLink onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/shopOwner/invoices"))} />

            <header className="so-page-head" style={{ alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                    <div className="so-eyebrow">Invoice</div>
                    <h1 className="so-page-title so-mono" style={{ fontFamily: "var(--so-font-display)" }}>{invoice.invoiceId}</h1>
                    <div className="so-badges" style={{ marginTop: 8 }}>
                        <StageBadge stage={invoice.stage} />
                        <PaymentBadge status={account.data?.paymentStatus || invoice.paymentStatus} />
                        <OverdueBadge days={late} />
                        <span className="so-cell-sub">
                            {stats.total ? `${stats.done}/${stats.total} items completed` : "Material only"}
                        </span>
                    </div>
                </div>
                <div className="so-actions">
                    <Button
                        variant="secondary"
                        disabled={pdfLoading === "invoice"}
                        onClick={() => openPdf("invoice", () => openInvoicePdf(invoiceId))}
                    >
                        <FiFileText aria-hidden /> {pdfLoading === "invoice" ? "Opening PDF..." : "Invoice PDF"}
                    </Button>
                    <Button variant="secondary" disabled={busy} onClick={() => setModal({ type: "edit" })}>
                        <FiEdit2 aria-hidden /> Edit details
                    </Button>
                    {!delivered && (
                        <Button variant="secondary" disabled={busy} onClick={() => setModal({ type: "items" })}>
                            <FiEdit2 aria-hidden /> Edit items
                        </Button>
                    )}
                    {!delivered && (
                        <Button variant="ghost" disabled={busy} onClick={() => setModal({ type: "delete" })} style={{ color: "var(--so-danger)" }}>
                            <FiTrash2 aria-hidden /> Delete
                        </Button>
                    )}
                </div>
            </header>

            {delivered && (
                <div className="so-delivered" role="status">
                    <FiTruck aria-hidden className="so-delivered-icon" />
                    <div className="so-delivered-text">
                        <div className="so-delivered-title">
                            {invoice.deliveredAt ? `Delivered on ${formatDateTime(invoice.deliveredAt)}` : "Delivered"}
                        </div>
                        <div className="so-cell-sub">
                            Receipt <span className="so-mono">{invoice.receiptNo}</span>
                            {!invoice.deliveredAt && " · delivery date not recorded"}
                        </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => openPdf(() => openReceiptPdf(invoice.receiptNo))}>
                        <FiFileText aria-hidden /> Receipt PDF
                    </Button>
                </div>
            )}

            <div className="so-grid so-grid-main">
                <div className="so-stack">
                    <Card
                        title="Items"
                        subtitle={`${stats.total} item${stats.total === 1 ? "" : "s"} · ${stats.done} completed`}
                        actions={
                            !delivered && openItems > 0 && (
                                <Button variant="secondary" size="sm" disabled={busy} onClick={onCompleteAll}
                                    title="All the work is done but was not updated in the app">
                                    <FiCheckCircle aria-hidden /> Mark all complete ({openItems})
                                </Button>
                            )
                        }
                    >
                        <div className="so-stack" style={{ gap: 12 }}>
                            {(invoice.items || []).map((item) => (
                                <ItemCard
                                    key={item.itemUniqueId}
                                    item={item}
                                    work={work[item.itemUniqueId]?.data}
                                    workError={work[item.itemUniqueId]?.error}
                                    invoiceDate={invoice.invoiceDate}
                                    nameOf={nameOf}
                                    busy={busy}
                                    onMove={onMove}
                                    onAssign={(it, kind, currentId) => setModal({ type: "assign", item: it, kind, currentId })}
                                    onUnassign={onUnassign}
                                    onComplete={onComplete}
                                />
                            ))}
                        </div>
                    </Card>
                </div>

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
                            {invoice.customer?.customerId && <span className="so-cell-sub so-mono">{invoice.customer.customerId}</span>}
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

                    <PaymentPanel
                        invoice={invoice}
                        account={account.data}
                        accountError={account.error}
                        busy={busy}
                        canDeliver={canDeliver}
                        deliverHint={deliverHint}
                        onPay={() => setModal({ type: "pay" })}
                        onDiscount={() => setModal({ type: "discount" })}
                        onDeliver={onDeliver}
                        onOpenPaymentReceipt={(no) => openPdf(no, () => openPaymentReceiptPdf(no))}
                        onOpenReceipt={() => openPdf("receipt", () => openReceiptPdf(invoice.receiptNo))}
                    />
                </div>
            </div>

            <PaymentModal open={modal?.type === "pay"} balanceDue={balance} onClose={() => setModal(null)} onSubmit={submitPayment} />
            <DiscountModal
                open={modal?.type === "discount"}
                currentDiscount={account.data?.discount ?? invoice.discount}
                taxableAmount={account.data?.taxableAmount ?? invoice.taxableAmount}
                onClose={() => setModal(null)}
                onSubmit={submitDiscount}
            />
            <AssignModal
                open={modal?.type === "assign"}
                kind={modal?.kind}
                itemName={modal?.item?.itemName}
                currentId={modal?.currentId}
                onClose={() => setModal(null)}
                onSubmit={submitAssign}
            />
            <EditDetailsModal open={modal?.type === "edit"} invoice={invoice} onClose={() => setModal(null)} onSubmit={submitEdit} />
            <InvoiceWizard
                open={modal?.type === "items"}
                mode="edit"
                invoice={invoice}
                onClose={() => setModal(null)}
                onDone={() => load()}
            />
            <DeleteModal open={modal?.type === "delete"} invoiceId={invoice.invoiceId} onClose={() => setModal(null)} onSubmit={submitDelete} />
        </>
    );
}

function BackLink({ onClick }) {
    return (
        <button type="button" className="so-back" onClick={onClick}>
            <FiArrowLeft aria-hidden /> Back to invoices
        </button>
    );
}
