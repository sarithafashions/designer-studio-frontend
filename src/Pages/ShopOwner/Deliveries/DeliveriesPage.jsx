// Deliveries for one day, with one-click actions (call / WhatsApp, collect, mark complete, deliver, change date).
// GET /reports/deliveries?date= — the selected date picks the view:
//   today  → Overdue + Due + Delivered
//   future → only the orders expected on that date
//   past   → only what was delivered on that date
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import {
    FiChevronLeft, FiChevronRight, FiRefreshCw, FiDownload, FiSearch, FiCalendar, FiPackage, FiClock,
    FiAlertTriangle, FiCheckCircle, FiCreditCard, FiFileText, FiInfo,
} from "react-icons/fi";
import { getDeliveries } from "../../../api/reports.js";
import { recordPayment, generateReceipt, editInvoice, openReceiptPdf, openPaymentReceiptPdf } from "../../../api/invoices.js";
import { completeAllItems } from "../../../api/production.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { toast } from "../../../utils/toast.js";
import { PageHeader, Card, KpiCard, Button, Segmented, Tabs, EmptyState, ErrorBox, Skeleton, Modal } from "../../shared/components/ui.jsx";
import { Field } from "../../shared/components/form.jsx";
import DateField from "../../shared/components/DateField.jsx";
import { PaymentModal } from "../Invoices/InvoiceModals.jsx";
import { PaymentBadge } from "../../shared/components/status.jsx";
import DeliveryOrderCard from "./DeliveryOrderCard.jsx";
import ExportButton from "../../shared/components/ExportButton.jsx";
import { exportXlsx, exportFileName } from "../../shared/lib/exportXlsx.js";
import { todayIST, addDays } from "../../shared/lib/period.js";
import { formatMoney, formatDate, formatDateTime, parseDueDate, humanize, formatAmount } from "../../shared/lib/format.js";
import { isConflict } from "../../shared/lib/invoice.js";
import { QUICK_FILTERS, filterOrders, searchDelivered, exportRows, viewOf, balanceOf, deliveredValue } from "../lib/deliveries.js";

const AUTO_REFRESH_MS = 5 * 60 * 1000;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
/** "4:05 pm" in IST (the day is the page's selected date). */
const timeOf = (value) => {
    const d = value ? new Date(value) : null;
    return d && !Number.isNaN(d.getTime())
        ? d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" })
        : "—";
};
const PAYMENT_LABEL = { Dues: "Unpaid", Partial: "Partly paid", Paid: "Paid" };
const itemNames = (items) => (items || []).map((i) => `${i.itemName}${i.itemQuantity && i.itemQuantity !== 1 ? ` ×${i.itemQuantity}` : ""}`).join(", ");

/** Excel columns for the list on screen (open orders, or delivered receipts). */
const exportColumns = (section) =>
    section === "delivered"
        ? [
              { header: "Delivered at", value: (r) => r.deliveredAt, type: "datetime" },
              { header: "Invoice no.", value: (r) => r.invoiceId },
              { header: "Invoice date", value: (r) => r.invoiceDate, type: "date" },
              { header: "Customer", value: (r) => r.customerName },
              { header: "Phone", value: (r) => r.customerPhone },
              { header: "Items", value: (r) => itemNames(r.items) },
              { header: "Amount (with GST)", value: (r) => r.totalAmountWithGST, type: "money" },
              { header: "Payment", value: () => "Paid" },
              { header: "Receipt no.", value: (r) => r.receiptNo },
          ]
        : [
              { header: "Invoice no.", value: (r) => r.invoiceId },
              { header: "Customer", value: (r) => r.customerName },
              { header: "Phone", value: (r) => r.customerPhone },
              { header: "Expected delivery", value: (r) => parseDueDate(r.expectedDeliveryDate) || r.expectedDeliveryDate, type: "date" },
              ...(section === "overdue" ? [{ header: "Days overdue", value: (r) => r.daysOverdue, type: "number" }] : []),
              { header: "Status", value: (r) => (r.ready ? "Ready" : "In production") },
              { header: "Items", value: (r) => (r.items || []).map((i) => `${i.itemName} (${humanize(i.status)})`).join(", ") },
              { header: "Items done", value: (r) => `${r.completedItemCount ?? 0} of ${r.itemCount ?? 0}` },
              { header: "Amount (with GST)", value: (r) => r.totalAmountWithGST, type: "money" },
              { header: "Balance due", value: (r) => r.balanceDue, type: "money" },
              { header: "Payment", value: (r) => PAYMENT_LABEL[r.paymentStatus] || r.paymentStatus },
          ];

const weekday = (ymd) => new Date(`${ymd}T12:00:00+05:30`).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short" });

export default function DeliveriesPage() {
    const navigate = useNavigate();
    const shopName = localStorage.getItem("shopName") || "our shop";
    const today = todayIST();
    const tomorrow = addDays(today, 1);
    const [date, setDate] = useState(today);
    const [state, setState] = useState({ loading: true, data: null, error: "" });
    const [search, setSearch] = useState("");
    const [quick, setQuick] = useState("all");
    const [busy, setBusy] = useState(false);
    const [modal, setModal] = useState(null); // {type: "pay" | "reschedule", order}
    const [tab, setTab] = useState("due"); // today view: "overdue" | "due" | "delivered"
    const listRef = useRef(null);
    const view = viewOf(date, today);
    // Which list is on screen: today → the chosen tab; a future date → expected (due); a past date → delivered.
    const section = view === "today" ? tab : view === "future" ? "due" : "delivered";

    // ---- loading
    const load = useCallback(
        (silent = false) => {
            if (!silent) setState((s) => ({ ...s, loading: true, error: "" }));
            return getDeliveries({ date })
                .then((data) => setState({ loading: false, data, error: "" }))
                .catch((err) => !silent && setState({ loading: false, data: null, error: getErrorMessage(err, "Could not load deliveries") }));
        },
        [date],
    );
    useEffect(() => {
        load();
    }, [load]);

    // Auto-refresh (today and future only — a past day doesn't change) while visible and nothing is being edited.
    const idle = !busy && !modal && view !== "past";
    useEffect(() => {
        if (!idle) return undefined;
        const t = setInterval(() => {
            if (document.visibilityState === "visible") load(true);
        }, AUTO_REFRESH_MS);
        return () => clearInterval(t);
    }, [idle, load]);

    const refresh = () => load(true);

    // ---- derived
    const data = state.data;
    const s = data?.summary;
    const overdue = useMemo(() => filterOrders(data?.overdue, search, quick), [data, search, quick]);
    const due = useMemo(() => filterOrders(data?.due, search, quick), [data, search, quick]);
    const dueReady = due.filter((o) => o.ready);
    const dueProduction = due.filter((o) => !o.ready);
    const delivered = useMemo(() => searchDelivered(data?.delivered, search), [data, search]);
    const dateText = `${weekday(date)}, ${formatDate(date)}`;
    const dayLabel = view === "today" ? "today" : date === tomorrow ? "tomorrow" : `on ${formatDate(date)}`;
    const filtering = search.trim() || (view !== "past" && quick !== "all");
    const subtitle =
        view === "today" ? `Today · ${dateText} · refreshes every 5 minutes`
            : view === "future" ? `Upcoming · ${dateText} · orders expected on this date`
                : `Past · ${dateText} · orders delivered on this date`;

    const openInvoice = (invoiceId) => navigate(`/shopOwner/invoices/${encodeURIComponent(invoiceId)}`);

    // KPI tile click: open that tab (today view), apply its quick filter and scroll to the list.
    const jump = (key, filter = "all") => {
        if (view === "today") setTab(key);
        setQuick(filter);
        setTimeout(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    };
    const tabs = [
        { key: "overdue", label: "Overdue", count: overdue.length },
        { key: "due", label: "Due today", count: due.length },
        { key: "delivered", label: "Delivered", count: delivered.length },
    ];

    // ---- actions (each reloads the day; a 409 reloads and asks to retry)
    const act = async (fn, success) => {
        setBusy(true);
        try {
            const result = await fn();
            if (success) toast.success(success);
            refresh();
            return result;
        } catch (err) {
            if (isConflict(err)) {
                toast.warning("This order just changed", "We reloaded it — please check and try again.");
                refresh();
            } else {
                toast.error("Could not save", getErrorMessage(err));
            }
            throw err;
        } finally {
            setBusy(false);
        }
    };
    const quiet = (p) => p.catch(() => undefined);

    const onCompleteAll = async (order) => {
        const open = (order.items || []).filter((i) => i.status !== "ORDER_COMPLETED");
        const r = await Swal.fire({
            title: `Mark ${open.length} item${open.length === 1 ? "" : "s"} as completed?`,
            html:
                `<div style="text-align:left"><b>${esc(order.customerName)}</b> · ${esc(order.invoiceId)}<ul style="margin:8px 0;padding-left:18px">` +
                open.map((i) => `<li>${esc(i.itemName)} — ${esc(humanize(i.status))}</li>`).join("") +
                "</ul>Their remaining steps are skipped. Recorded as done by you (shop owner). This can't be undone.</div>",
            input: "text",
            inputPlaceholder: "Note (optional)",
            inputAttributes: { maxlength: "200", "aria-label": "Note (optional)" },
            showCancelButton: true,
            confirmButtonText: "Mark all complete",
            reverseButtons: true,
            confirmButtonColor: "#17171c",
        });
        if (!r.isConfirmed) return;
        quiet(
            act(() => completeAllItems(order.invoiceId, (r.value || "").trim())).then((res) => {
                const failed = res?.failed || [];
                if (failed.length) {
                    Swal.fire({ icon: "warning", title: `${res.completed.length} completed, ${failed.length} not`,
                        text: failed.map((f) => `${f.itemName || f.itemUniqueId}: ${f.reason}`).join("\n"), confirmButtonColor: "#17171c" });
                } else {
                    toast.success(`${order.customerName || order.invoiceId}: all items completed`);
                }
            }),
        );
    };

    const onDeliver = async (order) => {
        const expected = parseDueDate(order.expectedDeliveryDate);
        const early = expected && expected > today;
        const r = await Swal.fire({
            title: early ? "Deliver this order early?" : "Deliver this order?",
            html:
                `<b>${esc(order.customerName)}</b> · ${esc(order.invoiceId)}<br/>` +
                (early ? `It is expected on <b>${esc(formatDate(expected))}</b> — deliver it today instead?<br/>` : "") +
                "This generates the final receipt. The invoice can't be edited or deleted after this.",
            icon: early ? "question" : undefined,
            showCancelButton: true,
            confirmButtonText: early ? "Deliver now" : "Deliver",
            reverseButtons: true,
            confirmButtonColor: "#17171c",
        });
        if (!r.isConfirmed) return;
        quiet(
            act(() => generateReceipt(order.invoiceId), "Delivered — receipt generated").then((receipt) => {
                if (receipt?.receiptNo) {
                    openReceiptPdf(receipt.receiptNo).catch((err) => toast.error("Could not open the receipt", getErrorMessage(err)));
                }
            }),
        );
    };

    const submitPayment = (body) =>
        quiet(
            act(() => recordPayment(modal.order.invoiceId, body), "Payment recorded").then(async (acc) => {
                setModal(null);
                const no = acc?.paymentReceipt?.paymentReceiptNo;
                if (no) {
                    const r = await Swal.fire({ title: "Payment recorded", text: `Payment receipt ${no} was created. Open it?`,
                        showCancelButton: true, confirmButtonText: "Open receipt", cancelButtonText: "Close", reverseButtons: true, confirmButtonColor: "#17171c" });
                    if (r.isConfirmed) openPaymentReceiptPdf(no).catch((err) => toast.error("Could not open the receipt", getErrorMessage(err)));
                }
            }),
        );

    const submitReschedule = (newDate) =>
        quiet(
            act(() => editInvoice(modal.order.invoiceId, { expectedDeliveryDate: newDate }), `Delivery moved to ${formatDate(newDate)}`)
                .then(() => setModal(null)),
        );

    const exportDay = () => {
        try {
            const rows = exportRows(data, view);
            if (!rows.length) {
                toast.info("Nothing to export for this day");
                return;
            }
            const sheet = XLSX.utils.json_to_sheet(rows);
            const book = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(book, sheet, view === "future" ? "Expected" : view === "past" ? "Delivered" : "Deliveries");
            XLSX.writeFile(book, `Deliveries_${date}.xlsx`);
        } catch (err) {
            toast.error("Could not export", getErrorMessage(err));
        }
    };

    // Export the list on screen with its search / quick filter (the day's data is already loaded in full).
    const sectionRows = section === "overdue" ? overdue : section === "due" ? [...dueReady, ...dueProduction] : delivered;
    const sectionLabel =
        section === "overdue" ? "Overdue" : section === "delivered" ? `Delivered ${dayLabel}` : view === "future" ? `Expected ${dayLabel}` : "Due today";
    const sheetName = section === "overdue" ? "Overdue" : section === "delivered" ? "Delivered" : view === "future" ? "Expected" : "Due";
    const exportSection = () =>
        exportXlsx({
            fileName: exportFileName("Deliveries", sheetName, date),
            sheetName,
            title: `${localStorage.getItem("shopName") || "Saritha Fashions"} · Deliveries · ${sectionLabel}`,
            filters: [
                ["Date", formatDate(date)],
                ["Search", search.trim()],
                ["Show", section !== "delivered" && quick !== "all" && QUICK_FILTERS.find((q) => q.key === quick)?.label],
            ].map(([k, v]) => [k, v || ""]),
            columns: exportColumns(section),
            rows: sectionRows,
        });

    const card = (o) => (
        <DeliveryOrderCard key={`${o.invoiceId}-${o.daysOverdue}`} order={o} shopName={shopName} busy={busy}
            onCollect={(order) => setModal({ type: "pay", order })} onCompleteAll={onCompleteAll}
            onDeliver={onDeliver} onReschedule={(order) => setModal({ type: "reschedule", order })} />
    );

    // ---- KPI tiles per view (click to jump / filter)
    // overdue numbers red, ready green, still in production amber (only when above zero)
    const TILE_TONE = { late: "danger", ready: "success", prod: "warning" };
    const tile = (key, onClick, icon, label, value) => (
        <button key={key} type="button" onClick={onClick}
            className={`so-kpi-btn${TILE_TONE[key] && Number(value) > 0 ? ` so-kpi-${TILE_TONE[key]}` : ""}`}>
            <KpiCard loading={state.loading} icon={icon} label={label} value={value} />
        </button>
    );
    const tiles =
        view === "today" ? [
            tile("due", () => jump("due", "all"), <FiCalendar aria-hidden />, "Due today", s?.dueCount ?? 0),
            tile("ready", () => jump("due", "ready"), <FiPackage aria-hidden />, "Ready to hand over", s?.dueReadyCount ?? 0),
            tile("prod", () => jump("due", "production"), <FiClock aria-hidden />, "Still in production", s?.dueInProductionCount ?? 0),
            tile("late", () => jump("overdue"), <FiAlertTriangle aria-hidden />, "Overdue", s?.overdueCount ?? 0),
            tile("done", () => jump("delivered"), <FiCheckCircle aria-hidden />, "Delivered today", s?.deliveredCount ?? 0),
            tile("cash", () => jump("due", "unpaid"), <FiCreditCard aria-hidden />, "To collect (due + overdue)", formatAmount(s?.balanceToCollect)),
        ] : view === "future" ? [
            tile("due", () => jump("due", "all"), <FiCalendar aria-hidden />, `Expected ${dayLabel}`, s?.dueCount ?? 0),
            tile("ready", () => jump("due", "ready"), <FiPackage aria-hidden />, "Already ready", s?.dueReadyCount ?? 0),
            tile("prod", () => jump("due", "production"), <FiClock aria-hidden />, "Still in production", s?.dueInProductionCount ?? 0),
            tile("cash", () => jump("due", "unpaid"), <FiCreditCard aria-hidden />, "To collect on these", formatAmount(balanceOf(data?.due))),
        ] : [
            tile("done", () => jump("delivered"), <FiCheckCircle aria-hidden />, `Delivered ${dayLabel}`, s?.deliveredCount ?? 0),
            tile("value", () => jump("delivered"), <FiFileText aria-hidden />, "Total value delivered", formatAmount(deliveredValue(data?.delivered))),
        ];

    const overdueSection = (
        <section className="so-dl-section">
            {overdue.length ? (
                <div className="so-stack" style={{ gap: 10 }}>{overdue.map(card)}</div>
            ) : (
                <EmptyState compact title={filtering ? "No overdue orders match" : "Nothing overdue"} />
            )}
        </section>
    );

    const dueSection = (
        <section className="so-dl-section">
            {view === "future" && (
                <h2 className="so-dl-title">
                    <FiCalendar aria-hidden /> Expected {dayLabel} <span className="so-tab-count">{due.length}</span>
                </h2>
            )}
            {due.length === 0 ? (
                <EmptyState compact title={filtering ? "No orders match" : view === "future" ? `No orders expected ${dayLabel}` : "Nothing due today"} />
            ) : (
                <div className="so-stack" style={{ gap: 10 }}>
                    {dueReady.length > 0 && <div className="so-dl-sub">{view === "future" ? "Already ready" : "Ready to hand over"} · {dueReady.length}</div>}
                    {dueReady.map(card)}
                    {dueProduction.length > 0 && <div className="so-dl-sub">Still in production · {dueProduction.length}</div>}
                    {dueProduction.map(card)}
                </div>
            )}
        </section>
    );

    const deliveredSection = (
        <section className="so-dl-section">
            <Card title={`Delivered ${dayLabel}`} subtitle={`${delivered.length} receipt${delivered.length === 1 ? "" : "s"}`}>
                {delivered.length === 0 ? (
                    <EmptyState compact title={search.trim() ? "No deliveries match" : view === "today" ? "Nothing delivered today yet" : `Nothing was delivered ${dayLabel}`} />
                ) : (
                    <div className="so-table-wrap" style={{ border: 0 }}>
                        {/* One line per row: every cell is a single value (details in the tooltip / on the invoice page). */}
                        <table className="so-table so-table-1line">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Invoice</th>
                                    <th>Customer</th>
                                    <th>Items</th>
                                    <th className="so-num">Amount</th>
                                    <th>Payment</th>
                                    <th>Receipt</th>
                                    <th aria-label="Actions" />
                                </tr>
                            </thead>
                            <tbody>
                                {delivered.map((r) => {
                                    const items = r.items || [];
                                    const names = items.map((i) => `${i.itemName}${i.itemQuantity && i.itemQuantity !== 1 ? ` ×${i.itemQuantity}` : ""}`);
                                    return (
                                        <tr key={r.receiptNo} className="so-row-link" tabIndex={0}
                                            onClick={() => openInvoice(r.invoiceId)} onKeyDown={(e) => e.key === "Enter" && openInvoice(r.invoiceId)}>
                                            <td title={formatDateTime(r.deliveredAt)}>{timeOf(r.deliveredAt)}</td>
                                            <td className="so-mono" title={r.invoiceDate ? `Invoice date ${formatDate(r.invoiceDate)}` : undefined}>{r.invoiceId}</td>
                                            <td className="so-dl-cust" title={r.customerPhone || undefined}>
                                                <span className="so-cell-main">{r.customerName || "—"}</span>
                                                {r.customerPhone && <span className="so-cell-sub"> · {r.customerPhone}</span>}
                                            </td>
                                            <td className="so-dl-items" title={names.join(", ")}>
                                                {names.length ? names.join(", ") : "—"}
                                            </td>
                                            <td className="so-num">{formatMoney(r.totalAmountWithGST)}</td>
                                            <td><PaymentBadge status="Paid" /></td>
                                            <td>
                                                <button type="button" className="so-linkbtn" style={{ padding: 0, width: "auto" }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openReceiptPdf(r.receiptNo).catch((err) => toast.error("Could not open the receipt", getErrorMessage(err)));
                                                    }}>
                                                    <FiFileText aria-hidden /> <span className="so-mono">{r.receiptNo}</span>
                                                </button>
                                            </td>
                                            <td>
                                                <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); openInvoice(r.invoiceId); }}>
                                                    View
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </section>
    );

    return (
        <>
            <PageHeader
                title="Deliveries"
                subtitle={subtitle}
                actions={
                    <div className="so-dl-datebar">
                        <Segmented
                            label="Jump to"
                            options={[{ key: today, label: "Today" }, { key: tomorrow, label: "Tomorrow" }]}
                            value={date}
                            onChange={setDate}
                        />
                        <button type="button" className="so-icon-btn" aria-label="Previous day" onClick={() => setDate((d) => addDays(d, -1))}>
                            <FiChevronLeft />
                        </button>
                        <DateField ariaLabel="Delivery date" value={date} onChange={(v) => v && setDate(v)} className="so-dl-datefield" />
                        <button type="button" className="so-icon-btn" aria-label="Next day" onClick={() => setDate((d) => addDays(d, 1))}>
                            <FiChevronRight />
                        </button>
                        <Button variant="ghost" size="sm" onClick={refresh} disabled={state.loading} title="Refresh">
                            <FiRefreshCw aria-hidden /> Refresh
                        </Button>
                        <Button variant="secondary" size="sm" onClick={exportDay} disabled={!data}>
                            <FiDownload aria-hidden /> Excel
                        </Button>
                    </div>
                }
            />

            {state.error ? (
                <ErrorBox message={state.error} onRetry={() => load()} />
            ) : (
                <>
                    <div className={`so-grid so-dl-kpis ${view === "future" ? "k4" : view === "past" ? "k2" : ""}`} style={{ marginBottom: 16 }}>
                        {tiles}
                    </div>

                    {view === "today" && s?.withoutDeliveryDateCount > 0 && (
                        <div className="so-note so-dl-info">
                            <FiInfo aria-hidden />
                            <span>
                                {s.withoutDeliveryDateCount} open order{s.withoutDeliveryDateCount === 1 ? " has" : "s have"} no readable
                                delivery date, so {s.withoutDeliveryDateCount === 1 ? "it is" : "they are"} not listed here. Set the date with
                                <b> Edit details</b> on the invoice.
                            </span>
                            <Button variant="ghost" size="sm" onClick={() => navigate("/shopOwner/invoices")}>Open invoices</Button>
                        </div>
                    )}

                    <div ref={listRef} className="so-dl-section">
                        {view === "today" && <Tabs tabs={tabs} value={tab} onChange={setTab} />}

                        {/* Search (+ quick filters for open orders) */}
                        <div className="so-filterbar">
                            <div className="so-toolbar">
                                <div className="so-search">
                                    <FiSearch aria-hidden />
                                    <input className="so-input" type="search" aria-label="Search deliveries"
                                        placeholder={section === "delivered" ? "Search name, phone, invoice, receipt or item" : "Search name, phone or invoice no."}
                                        value={search} onChange={(e) => setSearch(e.target.value)} />
                                </div>
                                {section !== "delivered" && <Segmented label="Show" options={QUICK_FILTERS} value={quick} onChange={setQuick} />}
                                <div className="so-filter-end">
                                    <ExportButton onExport={exportSection} disabled={state.loading || sectionRows.length === 0} />
                                </div>
                            </div>
                        </div>

                        {state.loading ? (
                            <div className="so-stack">
                                <Skeleton height={140} />
                                <Skeleton height={140} />
                            </div>
                        ) : section === "overdue" ? (
                            overdueSection
                        ) : section === "due" ? (
                            dueSection
                        ) : (
                            deliveredSection
                        )}
                    </div>
                </>
            )}

            <PaymentModal open={modal?.type === "pay"} balanceDue={modal?.order?.balanceDue || 0} onClose={() => setModal(null)} onSubmit={submitPayment} />
            <RescheduleModal open={modal?.type === "reschedule"} order={modal?.order} onClose={() => setModal(null)} onSubmit={submitReschedule} />
        </>
    );
}

function RescheduleModal({ open, order, onClose, onSubmit }) {
    const [value, setValue] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        if (open) {
            setValue(parseDueDate(order?.expectedDeliveryDate) || todayIST());
            setError("");
        }
    }, [open, order]);
    const submit = async () => {
        if (!value) return setError("Choose a date");
        if (value === parseDueDate(order?.expectedDeliveryDate)) return onClose();
        setBusy(true);
        try {
            await onSubmit(value);
        } finally {
            setBusy(false);
        }
    };
    return (
        <Modal open={open} title="Change delivery date" onClose={busy ? undefined : onClose}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
                    <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save date"}</Button>
                </>
            }>
            {order && (
                <p style={{ marginTop: 0 }}>
                    <b>{order.customerName}</b> · <span className="so-mono">{order.invoiceId}</span> — now due {formatDate(order.expectedDeliveryDate)}.
                </p>
            )}
            <Field label="New delivery date *" htmlFor="rs-date" error={error}>
                <DateField id="rs-date" min={todayIST()} value={value} invalid={!!error} onChange={setValue} />
            </Field>
        </Modal>
    );
}
