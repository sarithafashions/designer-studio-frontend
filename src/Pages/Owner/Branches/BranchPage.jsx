// Platform owner: one branch. Orders / money are view only; admin: edit branch, shop owner details, petty cash
// top-up, staff (new, add existing, edit, move, remove, delete). Header with the branch details + tabs:
// Orders · Receipts · Deliveries · Expenses & petty cash · People · Activity (shop owner table style, 20 per page).
// Tab lives in the URL (?tab=).
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FiArrowLeft, FiFileText, FiSearch, FiBarChart2, FiMapPin, FiPhone, FiUser, FiHash, FiEdit2, FiUserCheck, FiPlusCircle, FiUserPlus, FiUsers, FiShuffle, FiUserMinus, FiTrash2, FiAlertTriangle, FiCheckCircle, FiClock, FiX, FiDownload } from "react-icons/fi";
import {
    listShopSummaries, listBranchEmployees, listBranchPettyCash, listReceipts, openBranchInvoicePdf, openBranchReceiptPdf,
    updateBranch, updateShopOwner, addBranchPettyCash, createUser, assignUser, unassignUser, updateBranchEmployee, deleteUserAccount,
} from "../../../api/owner.js";
import { FormModal, AddExistingModal } from "../components/AdminModals.jsx";
import { listInvoices } from "../../../api/invoices.js";
import { listExpenses, getExpenseSummary } from "../../../api/expenses.js";
import { getPaymentMethods } from "../../../api/reference.js";
import { getDeliveries, getActivities } from "../../../api/reports.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { toast } from "../../../utils/toast.js";
import { PageHeader, Button, Card, Tabs, Segmented, Badge, EmptyState, ErrorBox, Skeleton } from "../../shared/components/ui.jsx";
import { StageBadge, PaymentBadge, OverdueBadge, ItemProgress } from "../../shared/components/status.jsx";
import { Pagination, Select } from "../../shared/components/form.jsx";
import PeriodFilter from "../../shared/components/PeriodFilter.jsx";
import { PERIODS, initialPeriod, rangeParams } from "../../shared/lib/period.js";
import { formatMoney, formatDate, formatDateTime, formatDueDate, humanize } from "../../shared/lib/format.js";
import { daysOverdue } from "../../shared/lib/invoice.js";
import { RoleBadge } from "../../ShopOwner/Employees/EmployeeModals.jsx";
import ReportDownloadModal from "../../shared/components/ReportDownloadModal.jsx";
import { FEATURES } from "../../shared/lib/features.js";
import ExportButton from "../../shared/components/ExportButton.jsx";
import { exportXlsx, exportFileName, fetchAllPages } from "../../shared/lib/exportXlsx.js";

/** Opens the read-only invoice page of this branch; `from` is the tab to come back to. */
const useOpenInvoice = (shopId, from) => {
    const navigate = useNavigate();
    return (invoiceId) => invoiceId && navigate(`/owner/branches/${encodeURIComponent(shopId)}/invoices/${encodeURIComponent(invoiceId)}?from=${from}`);
};
/** Props that make a table row open the invoice (click or Enter). */
const rowLink = (open, invoiceId) => ({
    className: "so-row-link", tabIndex: 0, role: "link", title: "Open the invoice",
    onClick: () => open(invoiceId),
    onKeyDown: (e) => e.key === "Enter" && open(invoiceId),
});

const PAGE_SIZE = 20;
const TABS = [
    { key: "orders", label: "Orders" },
    { key: "receipts", label: "Receipts" },
    { key: "deliveries", label: "Deliveries" },
    { key: "expenses", label: "Expenses" },
    { key: "pettycash", label: "Petty Cash" },
    { key: "people", label: "People" },
    { key: "activity", label: "Activity" },
    
];

/** Loads a (paged) list; reloads when `deps` change. */
function useList(loader, deps) {
    const [state, setState] = useState({ loading: true, data: null, error: "" });
    const load = useCallback(() => {
        let live = true;
        setState((s) => ({ ...s, loading: true, error: "" }));
        loader()
            .then((data) => live && setState({ loading: false, data, error: "" }))
            .catch((err) => live && setState({ loading: false, data: null, error: getErrorMessage(err, "Could not load") }));
        return () => {
            live = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
    useEffect(() => load(), [load]);
    return [state, load];
}

const pdf = (open) => async (e) => {
    e.stopPropagation();
    try {
        await open();
    } catch (err) {
        toast.error("Could not open the PDF", getErrorMessage(err));
    }
};

function SearchBox({ value, onChange, placeholder }) {
    return (
        <div className="so-search" style={{ maxWidth: 360, flex: 1 }}>
            <FiSearch aria-hidden />
            <input className="so-input" type="search" placeholder={placeholder} aria-label={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
    );
}

/** Debounced copy of a value (search boxes). */
function useDebounced(value, ms = 350) {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return v;
}

function ListBody({ state, reload, empty, children }) {
    if (state.error) return <ErrorBox message={state.error} onRetry={reload} />;
    if (state.loading) return <Skeleton height={260} />;
    if (empty) return <EmptyState title={empty} />;
    return children;
}

// ---- Excel export (all rows matching the tab's filters)
/** Downloads `rows` of a tab as .xlsx: "<branch> · <tab>". */
const exportTab = (branch, tabLabel, filters, columns, rows) =>
    exportXlsx({
        fileName: exportFileName(branch, tabLabel),
        sheetName: tabLabel,
        title: `${branch} · ${tabLabel}`,
        filters: filters.map(([k, v]) => [k, v || ""]),
        columns,
        rows,
    });
/** "This month (01 Nov 2026 – 24 Nov 2026)"; blank for "Overall". */
const periodText = (p) => {
    if (!p?.from) return "";
    const range = p.from === p.to ? formatDate(p.from) : `${formatDate(p.from)} – ${formatDate(p.to)}`;
    return p.key === "custom" ? range : `${PERIODS.find((x) => x.key === p.key)?.label || ""} (${range})`;
};
const paymentLabel = (status) => (status === "Dues" ? "Unpaid" : status);
const invoiceCols = () => [
    { header: "Invoice no.", value: (r) => r.invoiceId },
    { header: "Invoice date", value: (r) => r.invoiceDate, type: "date" },
    { header: "Customer", value: (r) => r.customerName },
    { header: "Phone", value: (r) => r.customerPhone },
];

// ---- filters shared by the Expenses, Petty cash and Activity tabs
const DATE_SORTS = [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
];
const PETTY_SORTS = [...DATE_SORTS, { value: "highest", label: "Highest amount" }, { value: "lowest", label: "Lowest amount" }];
const EXPENSE_KINDS = [
    { key: "", label: "All" },
    { key: "shop", label: "Shop" },
    { key: "employee", label: "Employees" },
];
const ACTIVITY_TYPES = [
    "INVOICE_CREATED", "INVOICE_DELETED", "RECEIPT_DELETED", "ORDER_DELIVERED", "ORDER_COMPLETED", "ITEM_MARKED_COMPLETED",
    "ASSIGNED_TO_TAILOR_MASTER", "TAILOR_MASTER_CUTTING", "ASSIGNED_TO_TAILOR", "TAILOR_STARTED", "TAILOR_STITCHING",
    "TAILOR_COMPLETED", "ASSIGNED_TO_ASSISTANT", "ASSISTANT_HEMMING", "ASSISTANT_IRONING", "ASSISTANT_COMPLETED", "USER_DELETED",
];

/** Right end of a filter row: result count + "Clear filters" + Excel export. */
function FilterEnd({ page, loading, noun, plural, filtered, onClear, extra, onExport }) {
    const n = page?.totalElements;
    return (
        <div className="so-filter-end">
            {extra}
            {!loading && n != null && <span className="so-hint">{n} {n === 1 ? noun : plural || `${noun}s`}</span>}
            {filtered && <Button variant="ghost" size="sm" onClick={onClear}><FiX aria-hidden /> Clear filters</Button>}
            {onExport && <ExportButton onExport={onExport} disabled={loading || !n} />}
        </div>
    );
}

// ------------------------------------------------------------------ tabs

const ORDER_STATUS = [{ key: "pending", label: "Pending" }, { key: "delivered", label: "Delivered" }, { key: "all", label: "All" }];

function OrdersTab({ shopId, branch }) {
    const openInvoice = useOpenInvoice(shopId, "orders");
    const [status, setStatus] = useState("pending");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(0);
    const q = useDebounced(search);
    useEffect(() => setPage(0), [status, q]);
    const params = (pageNumber, pageSize) => ({ shopId, status, search: q || undefined, sort: "newest", pageNumber, pageSize });
    const [state, reload] = useList(() => listInvoices(params(page, PAGE_SIZE)), [shopId, status, q, page]);
    const rows = state.data?.content || [];
    const exportRows = async () => {
        const all = await fetchAllPages(({ pageNumber, pageSize }) => listInvoices(params(pageNumber, pageSize)));
        return exportTab(branch, "Orders", [["Orders", ORDER_STATUS.find((o) => o.key === status)?.label], ["Search", q]], [
            ...invoiceCols(),
            { header: "Items", value: (r) => (r.itemNames || []).join(", ") },
            { header: "Items done", value: (r) => `${r.completedItemCount ?? 0} of ${r.itemCount ?? 0}` },
            { header: "Amount (with GST)", value: (r) => r.totalAmountWithGST, type: "money" },
            { header: "Balance due", value: (r) => r.balanceDue, type: "money" },
            { header: "Payment", value: (r) => paymentLabel(r.paymentStatus) },
            { header: "Stage", value: (r) => humanize(r.stage) },
            ...(status === "delivered" ? [] : [
                { header: "Due", value: (r) => (r.deliveredAt ? null : formatDueDate(r.expectedDeliveryDate)) },
                { header: "Days overdue", value: (r) => (r.deliveredAt ? null : daysOverdue(r.expectedDeliveryDate, r.stage) || null), type: "number" },
            ]),
            ...(status === "pending" ? [] : [{ header: "Delivered on", value: (r) => r.deliveredAt, type: "datetime" }]),
        ], all);
    };
    return (
        <>
            <div className="so-toolbar" style={{ marginBottom: 12 }}>
                <Segmented label="Orders" value={status} onChange={setStatus} options={ORDER_STATUS} />
                <SearchBox value={search} onChange={setSearch} placeholder="Search invoice no., customer or phone" />
                <span className="tm-spacer" />
                <ExportButton onExport={exportRows} disabled={state.loading || !state.data?.totalElements} />
            </div>
            <ListBody state={state} reload={reload} empty={!rows.length && (q ? "No order matches this search" : "No orders")}>
                <div className="so-table-wrap">
                    <table className="so-table">
                        <thead>
                            <tr>
                                <th>Invoice</th><th>Customer</th><th>Items</th><th className="so-num">Amount</th>
                                <th className="so-num">Balance</th><th>Payment</th><th>Stage</th><th>{status === "delivered" ? "Delivered" : "Due"}</th>
                                <th aria-label="PDF" />
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id || r.invoiceId} {...rowLink(openInvoice, r.invoiceId)}>
                                    <td>
                                        <div className="so-cell-main so-mono">{r.invoiceId}</div>
                                        <div className="so-cell-sub">{formatDate(r.invoiceDate)}</div>
                                    </td>
                                    <td>
                                        <div className="so-cell-main">{r.customerName || "—"}</div>
                                        <div className="so-cell-sub">{r.customerPhone}</div>
                                    </td>
                                    <td title={(r.itemNames || []).join(", ")}><ItemProgress completed={r.completedItemCount} total={r.itemCount} /></td>
                                    <td className="so-num">{formatMoney(r.totalAmountWithGST)}</td>
                                    <td className="so-num" style={{ color: r.balanceDue > 0 ? "var(--so-primary)" : "var(--so-slate)" }}>{formatMoney(r.balanceDue)}</td>
                                    <td><PaymentBadge status={r.paymentStatus} /></td>
                                    <td><StageBadge stage={r.stage} /></td>
                                    <td>
                                        {r.deliveredAt ? (
                                            <div style={{ whiteSpace: "nowrap" }}>{formatDateTime(r.deliveredAt)}</div>
                                        ) : (
                                            <>
                                                <div style={{ whiteSpace: "nowrap" }}>{formatDueDate(r.expectedDeliveryDate)}</div>
                                                <OverdueBadge days={daysOverdue(r.expectedDeliveryDate, r.stage)} />
                                            </>
                                        )}
                                    </td>
                                    <td>
                                        <Button variant="ghost" size="sm" onClick={pdf(() => openBranchInvoicePdf(r.invoiceId, shopId))}>
                                            <FiFileText aria-hidden /> PDF
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </ListBody>
            <Pagination page={state.data} pageSize={PAGE_SIZE} onChange={setPage} />
        </>
    );
}

function ReceiptsTab({ shopId, branch }) {
    const openInvoice = useOpenInvoice(shopId, "receipts");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(0);
    const q = useDebounced(search);
    useEffect(() => setPage(0), [q]);
    const params = (pageNumber, pageSize) => ({ shopId, search: q || undefined, pageNumber, pageSize });
    const [state, reload] = useList(() => listReceipts(params(page, PAGE_SIZE)), [shopId, q, page]);
    const rows = state.data?.content || [];
    const exportRows = async () => {
        const all = await fetchAllPages(({ pageNumber, pageSize }) => listReceipts(params(pageNumber, pageSize)));
        return exportTab(branch, "Receipts", [["Search", q]], [
            { header: "Receipt no.", value: (r) => r.receiptNo },
            { header: "Receipt date", value: (r) => r.receiptDate, type: "datetime" },
            { header: "Invoice no.", value: (r) => r.invoiceId },
            { header: "Customer", value: (r) => r.customerName },
            { header: "Phone", value: (r) => r.customerPhone },
            { header: "Total (with GST)", value: (r) => r.totalAmountWithGST, type: "money" },
            { header: "Paid", value: (r) => r.amountPaid, type: "money" },
            { header: "Method", value: (r) => r.paymentMethod },
        ], all);
    };
    return (
        <>
            <div className="so-toolbar" style={{ marginBottom: 12 }}>
                <SearchBox value={search} onChange={setSearch} placeholder="Search receipt / invoice no., customer or phone" />
                <span className="tm-spacer" />
                <ExportButton onExport={exportRows} disabled={state.loading || !state.data?.totalElements} />
            </div>
            <ListBody state={state} reload={reload} empty={!rows.length && (q ? "No receipt matches this search" : "No receipts")}>
                <div className="so-table-wrap">
                    <table className="so-table">
                        <thead>
                            <tr><th>Receipt</th><th>Customer</th><th className="so-num">Total</th><th className="so-num">Paid</th><th>Method</th><th aria-label="PDF" /></tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id || r.receiptNo} {...rowLink(openInvoice, r.invoiceId)}>
                                    <td>
                                        <div className="so-cell-main so-mono">{r.receiptNo}</div>
                                        <div className="so-cell-sub">{formatDateTime(r.receiptDate)}{r.invoiceId ? ` · ${r.invoiceId}` : ""}</div>
                                    </td>
                                    <td>
                                        <div className="so-cell-main">{r.customerName || "—"}</div>
                                        <div className="so-cell-sub">{r.customerPhone}</div>
                                    </td>
                                    <td className="so-num">{formatMoney(r.totalAmountWithGST)}</td>
                                    <td className="so-num">{formatMoney(r.amountPaid)}</td>
                                    <td>{r.paymentMethod || "—"}</td>
                                    <td>
                                        <Button variant="ghost" size="sm" onClick={pdf(() => openBranchReceiptPdf(r.receiptNo))}>
                                            <FiFileText aria-hidden /> PDF
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </ListBody>
            <Pagination page={state.data} pageSize={PAGE_SIZE} onChange={setPage} />
        </>
    );
}

const DELIVERY_VIEWS = { overdue: "Overdue", due: "Due today", delivered: "Delivered today" };

function DeliveriesTab({ shopId, branch }) {
    const openInvoice = useOpenInvoice(shopId, "deliveries");
    const [view, setView] = useState("overdue");
    const [page, setPage] = useState(0);
    useEffect(() => setPage(0), [view]);
    const [state, reload] = useList(() => getDeliveries({ shopId }), [shopId]);
    const s = state.data?.summary;
    const all = view === "delivered" ? state.data?.delivered || [] : view === "due" ? state.data?.due || [] : state.data?.overdue || [];
    // the report returns the whole day at once: page it here, 20 per page (same pager as the other tabs)
    const list = all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const pageInfo = { totalElements: all.length, pageNumber: page, totalPages: Math.max(1, Math.ceil(all.length / PAGE_SIZE)), content: list };
    // the whole list is loaded already: export every row of the chosen view (not only this page)
    const exportRows = () => exportTab(branch, "Deliveries", [["Show", DELIVERY_VIEWS[view]]], [
        ...invoiceCols(),
        ...(view === "delivered" ? [
            { header: "Items", value: (o) => o.itemCount, type: "number" },
            { header: "Amount (with GST)", value: (o) => o.totalAmountWithGST, type: "money" },
            { header: "Delivered on", value: (o) => o.deliveredAt, type: "datetime" },
            { header: "Receipt no.", value: (o) => o.receiptNo },
        ] : [
            { header: "Items done", value: (o) => `${o.completedItemCount ?? 0} of ${o.itemCount ?? 0}` },
            { header: "Amount (with GST)", value: (o) => o.totalAmountWithGST, type: "money" },
            { header: "Balance due", value: (o) => o.balanceDue, type: "money" },
            { header: "Status", value: (o) => (o.daysOverdue > 0 ? "Late" : o.ready ? "Ready" : "In production") },
            { header: "Days late", value: (o) => (o.daysOverdue > 0 ? o.daysOverdue : null), type: "number" },
        ]),
    ], all);
    return (
        <>
            <div className="so-toolbar" style={{ marginBottom: 12 }}>
                <Segmented label="Deliveries" value={view} onChange={setView} options={[
                    { key: "overdue", label: `Overdue${s ? ` (${s.overdueCount})` : ""}` },
                    { key: "due", label: `Due today${s ? ` (${s.dueCount})` : ""}` },
                    { key: "delivered", label: `Delivered today${s ? ` (${s.deliveredCount})` : ""}` },
                ]} />
                {s && <span className="so-cell-sub">Balance to collect on due + overdue: <b style={{ color: "var(--so-primary)" }}>{formatMoney(s.balanceToCollect)}</b></span>}
                <span className="tm-spacer" />
                <ExportButton onExport={exportRows} disabled={state.loading || !all.length} />
            </div>
            <ListBody state={state} reload={reload} empty={!all.length && "Nothing here today"}>
                <div className="so-table-wrap">
                    <table className="so-table">
                        <thead>
                            <tr>
                                <th>Invoice</th><th>Customer</th><th>Items</th><th className="so-num">Amount</th>
                                {view === "delivered" ? <><th>Delivered</th><th>Receipt</th></> : <><th className="so-num">Balance</th><th>Status</th></>}
                            </tr>
                        </thead>
                        <tbody>
                            {list.map((o) => (
                                <tr key={`${o.invoiceId}-${o.receiptNo || ""}`} {...rowLink(openInvoice, o.invoiceId)}>
                                    <td>
                                        <div className="so-cell-main so-mono">{o.invoiceId}</div>
                                        <div className="so-cell-sub">{formatDate(o.invoiceDate)}</div>
                                    </td>
                                    <td>
                                        <div className="so-cell-main">{o.customerName || "—"}</div>
                                        <div className="so-cell-sub">{o.customerPhone}</div>
                                    </td>
                                    <td>{view === "delivered" ? o.itemCount : <ItemProgress completed={o.completedItemCount} total={o.itemCount} />}</td>
                                    <td className="so-num">{formatMoney(o.totalAmountWithGST)}</td>
                                    {view === "delivered" ? (
                                        <>
                                            <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(o.deliveredAt)}</td>
                                            <td className="so-mono">{o.receiptNo}</td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="so-num">{formatMoney(o.balanceDue)}</td>
                                            <td>
                                                {o.daysOverdue > 0 ? <Badge tone="danger" icon={<FiAlertTriangle aria-hidden />}>{o.daysOverdue}d late</Badge>
                                                    : o.ready ? <Badge tone="success" icon={<FiCheckCircle aria-hidden />}>Ready</Badge>
                                                        : <Badge tone="warning" icon={<FiClock aria-hidden />}>In production</Badge>}
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </ListBody>
            <Pagination page={pageInfo} pageSize={PAGE_SIZE} onChange={setPage} />
        </>
    );
}

function PettyCashTab({ shopId, pettyCash, branch }) {
    const [period, setPeriod] = useState(() => initialPeriod("overall"));
    const [amountText, setAmountText] = useState("");
    const [sort, setSort] = useState("newest");
    const [page, setPage] = useState(0);
    const amount = useDebounced(amountText.trim());
    const periodKey = `${period.key}|${period.from}|${period.to}`;
    useEffect(() => setPage(0), [periodKey, amount, sort]);
    const amountValue = amount && Number(amount) > 0 ? Number(amount) : undefined;
    const params = (pageNumber, pageSize) => ({ ...rangeParams(period), amount: amountValue, sort, pageNumber, pageSize });
    const [pc, reloadPc] = useList(
        () => listBranchPettyCash(shopId, params(page, PAGE_SIZE)),
        [shopId, periodKey, amountValue, sort, page],
    );
    const exportRows = async () => {
        const all = await fetchAllPages(({ pageNumber, pageSize }) => listBranchPettyCash(shopId, params(pageNumber, pageSize)));
        return exportTab(branch, "Petty Cash", [
            ["Period", periodText(period)],
            ["Amount", amountValue != null ? formatMoney(amountValue) : ""],
            ["Sort", PETTY_SORTS.find((o) => o.value === sort)?.label],
        ], [
            { header: "Added on", value: (t) => t.addedAt, type: "datetime" },
            { header: "Added by", value: (t) => t.addedByName },
            { header: "Amount", value: (t) => t.amount, type: "money" },
        ], all);
    };
    const topUps = pc.data?.content || [];
    const filtered = period.key !== "overall" || !!amountValue || sort !== "newest";
    const clear = () => { setPeriod(initialPeriod("overall")); setAmountText(""); setSort("newest"); };
    return (
        <>
            <div className="so-filterbar">
                <div className="so-toolbar">
                    <PeriodFilter value={period} onChange={setPeriod} />
                    <label className="so-inline-field">
                        <span>Sort by</span>
                        <Select options={PETTY_SORTS} value={sort} onChange={(e) => setSort(e.target.value)} />
                    </label>
                </div>
                <div className="so-filter-row">
                    <div className="so-filter-group">
                        <span className="so-filter-label">Amount</span>
                        <input className="so-input" style={{ width: 160 }} type="number" min="0" step="any" inputMode="decimal"
                            placeholder="Exact amount, e.g. 500" aria-label="Amount" value={amountText} onChange={(e) => setAmountText(e.target.value)} />
                    </div>
                    <FilterEnd page={pc.data} loading={pc.loading} noun="top-up" filtered={filtered} onClear={clear} onExport={exportRows}
                        extra={<span className="so-hint">Balance <b style={{ color: "var(--so-primary)" }}>{formatMoney(pettyCash)}</b></span>} />
                </div>
            </div>
            <ListBody state={pc} reload={reloadPc} empty={!topUps.length && (filtered ? "No top-up matches these filters" : "No top-ups yet")}>
                <div className="so-table-wrap">
                    <table className="so-table">
                        <thead><tr><th>Added</th><th>By</th><th className="so-num">Amount</th></tr></thead>
                        <tbody>
                            {topUps.map((t, i) => (
                                <tr key={`${t.addedAt}-${i}`}>
                                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(t.addedAt)}</td>
                                    <td>{t.addedByName || "—"}</td>
                                    <td className="so-num">{formatMoney(t.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </ListBody>
            <Pagination page={pc.data} pageSize={PAGE_SIZE} onChange={setPage} />
        </>
    );
}

function ExpensesTab({ shopId, branch }) {
    const [period, setPeriod] = useState(() => initialPeriod("overall"));
    const [search, setSearch] = useState("");
    const [kind, setKind] = useState("");
    const [employee, setEmployee] = useState("");
    const [category, setCategory] = useState("");
    const [method, setMethod] = useState("");
    const [sort, setSort] = useState("newest");
    const [page, setPage] = useState(0);
    const [categories, setCategories] = useState([]);
    const [methods, setMethods] = useState([]);
    const [staff, setStaff] = useState([]);
    const q = useDebounced(search);
    const periodKey = `${period.key}|${period.from}|${period.to}`;
    useEffect(() => setPage(0), [periodKey, q, kind, employee, category, method, sort]);
    useEffect(() => {
        getPaymentMethods().then(setMethods);
        listBranchEmployees(shopId).then(setStaff).catch(() => setStaff([]));
    }, [shopId]);
    useEffect(() => {
        // category options: every category used in the period
        getExpenseSummary({ shopId, ...rangeParams(period) })
            .then((d) => setCategories((d?.byType || []).map((g) => g.name).filter(Boolean)))
            .catch(() => setCategories([]));
    }, [shopId, periodKey]); // eslint-disable-line react-hooks/exhaustive-deps

    const params = (pageNumber, pageSize) => ({
        shopId, ...rangeParams(period), search: q.trim() || undefined, type: kind || undefined,
        employeeUserId: kind === "employee" && employee ? employee : undefined,
        expenseType: category || undefined, paymentMethod: method || undefined, sort, pageNumber, pageSize,
    });
    const [state, reload] = useList(() => listExpenses(params(page, PAGE_SIZE)), [shopId, periodKey, q, kind, employee, category, method, sort, page]);
    const exportRows = async () => {
        const all = await fetchAllPages(({ pageNumber, pageSize }) => listExpenses(params(pageNumber, pageSize)));
        return exportTab(branch, "Expenses", [
            ["Search", q.trim()],
            ["Period", periodText(period)],
            ["For", kind && EXPENSE_KINDS.find((k) => k.key === kind)?.label],
            ["Employee", kind === "employee" && employee && staff.find((e) => e.userId === employee)?.name],
            ["Category", category],
            ["Paid by", method],
            ["Sort", DATE_SORTS.find((o) => o.value === sort)?.label],
        ], [
            { header: "Date", value: (r) => r.expenseDate, type: "date" },
            { header: "Category", value: (r) => r.expenseType },
            { header: "Notes", value: (r) => r.notes },
            { header: "For", value: (r) => r.employeeName || "Shop" },
            { header: "Method", value: (r) => r.paymentMethod },
            { header: "Amount", value: (r) => r.expenseAmount, type: "money" },
        ], all);
    };
    const rows = state.data?.content || [];
    const filtered = period.key !== "overall" || !!q.trim() || !!kind || !!category || !!method || sort !== "newest";
    const clear = () => {
        setPeriod(initialPeriod("overall")); setSearch(""); setKind(""); setEmployee(""); setCategory(""); setMethod(""); setSort("newest");
    };

    return (
        <>
            <div className="so-filterbar">
                <div className="so-toolbar">
                    <SearchBox value={search} onChange={setSearch} placeholder="Search category or notes" />
                    <PeriodFilter value={period} onChange={setPeriod} />
                    <label className="so-inline-field">
                        <span>Sort by</span>
                        <Select options={DATE_SORTS} value={sort} onChange={(e) => setSort(e.target.value)} />
                    </label>
                </div>
                <div className="so-filter-row">
                    <div className="so-filter-group">
                        <span className="so-filter-label">For</span>
                        <Segmented label="Expense for" options={EXPENSE_KINDS} value={kind} onChange={(v) => { setKind(v); setEmployee(""); }} />
                    </div>
                    {kind === "employee" && (
                        <div className="so-filter-group">
                            <span className="so-filter-label">Employee</span>
                            <Select aria-label="Employee" placeholder="Everyone" options={staff.map((e) => ({ value: e.userId, label: e.name }))}
                                value={employee} onChange={(e) => setEmployee(e.target.value)} />
                        </div>
                    )}
                    <div className="so-filter-group">
                        <span className="so-filter-label">Category</span>
                        <Select aria-label="Category" placeholder="All categories" options={categories}
                            value={category} onChange={(e) => setCategory(e.target.value)} />
                    </div>
                    <div className="so-filter-group">
                        <span className="so-filter-label">Paid by</span>
                        <Select aria-label="Paid by" placeholder="Any method" options={methods}
                            value={method} onChange={(e) => setMethod(e.target.value)} />
                    </div>
                    <FilterEnd page={state.data} loading={state.loading} noun="expense" filtered={filtered} onClear={clear} onExport={exportRows} />
                </div>
            </div>
            <ListBody state={state} reload={reload} empty={!rows.length && (filtered ? "No expense matches these filters" : "No expenses")}>
                <div className="so-table-wrap">
                    <table className="so-table">
                        <thead>
                            <tr><th>Date</th><th>Category</th><th>For</th><th>Method</th><th className="so-num">Amount</th></tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id}>
                                    <td style={{ whiteSpace: "nowrap" }}>{formatDate(r.expenseDate)}</td>
                                    <td>
                                        <div className="so-cell-main">{r.expenseType || "—"}</div>
                                        {r.notes && <div className="so-cell-sub so-ellipsis" style={{ maxWidth: 260 }} title={r.notes}>{r.notes}</div>}
                                    </td>
                                    <td>{r.employeeName || "Shop"}</td>
                                    <td>{r.paymentMethod || "—"}</td>
                                    <td className="so-num">{formatMoney(r.expenseAmount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </ListBody>
            <Pagination page={state.data} pageSize={PAGE_SIZE} onChange={setPage} />
        </>
    );
}

const ROLE_ORDER = ["SHOP_OWNER", "TAILOR_MASTER", "TAILOR", "SHOP_ASSISTANT"];
const roleOf = (e) => ROLE_ORDER.find((r) => (e.roles || []).includes(r)) || (e.roles || [])[0] || "";

const STAFF_ROLES = [
    { value: "TAILOR_MASTER", label: "Tailor master" },
    { value: "TAILOR", label: "Tailor" },
    { value: "SHOP_ASSISTANT", label: "Shop assistant" },
];

function PeopleTab({ shopId, branchName, branches, onChanged }) {
    const [state, reload] = useList(() => listBranchEmployees(shopId), [shopId]);
    const [modal, setModal] = useState(null); // {type: new|existing|edit|move, employee}
    const rows = [...(state.data || [])].sort((a, b) => ROLE_ORDER.indexOf(roleOf(a)) - ROLE_ORDER.indexOf(roleOf(b)) || (a.name || "").localeCompare(b.name || ""));
    const done = (message) => {
        toast.success(message);
        setModal(null);
        reload();
        onChanged?.();
    };
    const remove = async (e) => {
        const ok = await toast.confirm({
            title: `Remove ${e.name} from ${branchName}?`,
            text: "The account stays (you can add them to a branch again). Their items in progress go back one step.",
            confirmButtonText: "Remove from branch",
        });
        if (!ok) return;
        try {
            await unassignUser(shopId, e.userId);
            done(`${e.name} removed from ${branchName}`);
        } catch (err) {
            toast.error("Could not remove", getErrorMessage(err));
        }
    };
    const destroy = async (e) => {
        const ok = await toast.confirm({
            title: `Delete ${e.name}'s account?`,
            text: "The login is deleted for good. Their items in progress go back one step. This can't be undone.",
            confirmButtonText: "Delete account",
        });
        if (!ok) return;
        try {
            await deleteUserAccount(shopId, e.userId);
            done(`${e.name}'s account deleted`);
        } catch (err) {
            toast.error("Could not delete", getErrorMessage(err));
        }
    };
    const others = branches.filter((b) => b.shopId !== shopId).map((b) => ({ value: b.shopId, label: b.shopName || "Branch" }));

    return (
        <>
            <div className="so-toolbar" style={{ marginBottom: 12 }}>
                <span className="so-cell-sub">{rows.length} staff</span>
                <span className="tm-spacer" />
                <Button variant="secondary" size="sm" onClick={() => setModal({ type: "existing" })}>
                    <FiUsers aria-hidden /> Add existing staff
                </Button>
                <Button size="sm" onClick={() => setModal({ type: "new" })}>
                    <FiUserPlus aria-hidden /> New staff
                </Button>
            </div>
            <ListBody state={state} reload={reload} empty={!rows.length && "No staff in this branch"}>
                <div className="so-table-wrap">
                    <table className="so-table">
                        <thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>Email</th><th>Joined</th><th>Last login</th><th className="ow-actions-col" aria-label="Actions" /></tr></thead>
                        <tbody>
                            {rows.map((e) => {
                                const owner = roleOf(e) === "SHOP_OWNER";
                                return (
                                    <tr key={e.userId}>
                                        <td><div className="so-cell-main">{e.name || "—"}</div></td>
                                        <td><RoleBadge roles={e.roles} /></td>
                                        <td>{e.phone || "—"}</td>
                                        <td>{e.email || "—"}</td>
                                        <td style={{ whiteSpace: "nowrap" }}>{formatDate(e.accountCreationDate)}</td>
                                        <td style={{ whiteSpace: "nowrap" }}>{e.lastLoginDate ? formatDateTime(e.lastLoginDate) : "Never"}</td>
                                        <td>
                                            {owner ? (
                                                <span className="so-cell-sub" title="Edit with the “Shop owner” button above">Shop owner</span>
                                            ) : (
                                                <div className="ow-icon-actions">
                                                    <button type="button" className="so-icon-btn" onClick={() => setModal({ type: "edit", employee: e })}
                                                        title="Edit details" aria-label={`Edit ${e.name}`}><FiEdit2 /></button>
                                                    <button type="button" className="so-icon-btn" disabled={!others.length} onClick={() => setModal({ type: "move", employee: e })}
                                                        title="Move to another branch" aria-label={`Move ${e.name} to another branch`}><FiShuffle /></button>
                                                    <button type="button" className="so-icon-btn" onClick={() => remove(e)}
                                                        title="Remove from this branch" aria-label={`Remove ${e.name} from this branch`}><FiUserMinus /></button>
                                                    <button type="button" className="so-icon-btn ow-danger" onClick={() => destroy(e)}
                                                        title="Delete the account" aria-label={`Delete ${e.name}'s account`}><FiTrash2 /></button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </ListBody>

            <FormModal
                open={modal?.type === "new"}
                title={`New staff in ${branchName}`}
                submitLabel="Create account"
                intro="Creates a login for the staff member in this branch."
                fields={[
                    { name: "name", label: "Name", required: true },
                    { name: "role", label: "Role", type: "select", required: true, options: STAFF_ROLES },
                    { name: "email", label: "Email (login)", type: "email", required: true },
                    { name: "password", label: "Password", type: "password", required: true, hint: "8+ characters, a letter and a digit" },
                    { name: "phone", label: "Phone", type: "phone" },
                    { name: "salary", label: "Salary (₹ / month)", type: "money" },
                    { name: "address", label: "Address", type: "textarea" },
                ]}
                onClose={() => setModal(null)}
                onSubmit={async ({ role, ...values }) => {
                    await createUser({ ...values, roles: [role], shopId });
                    done(`${values.name} added to ${branchName}`);
                }}
            />
            <FormModal
                open={modal?.type === "edit"}
                title={`Edit ${modal?.employee?.name || ""}`}
                changedOnly
                initial={modal?.employee || {}}
                fields={[
                    { name: "name", label: "Name", required: true },
                    { name: "email", label: "Email (login)", type: "email", required: true },
                    { name: "phone", label: "Phone", type: "phone" },
                    { name: "salary", label: "Salary (₹ / month)", type: "money" },
                    { name: "address", label: "Address", type: "textarea" },
                ]}
                onClose={() => setModal(null)}
                onSubmit={async (changes) => {
                    await updateBranchEmployee(shopId, modal.employee.userId, changes);
                    done(`${changes.name || modal.employee.name} updated`);
                }}
            />
            <FormModal
                open={modal?.type === "move"}
                title={`Move ${modal?.employee?.name || ""} to another branch`}
                submitLabel="Move"
                intro="They start working in the chosen branch. Their items in progress here go back one step."
                fields={[{ name: "shopId", label: "Branch", type: "select", required: true, options: others }]}
                onClose={() => setModal(null)}
                onSubmit={async ({ shopId: target }) => {
                    await assignUser(modal.employee.userId, target);
                    done(`${modal.employee.name} moved to ${others.find((o) => o.value === target)?.label || "the branch"}`);
                }}
            />
            <AddExistingModal
                open={modal?.type === "existing"}
                branchName={branchName}
                onClose={() => {
                    setModal(null);
                    reload();
                }}
                onAdd={async (p) => {
                    try {
                        await assignUser(p.userId, shopId);
                        toast.success(`${p.name} added to ${branchName}`);
                        onChanged?.();
                    } catch (err) {
                        toast.error("Could not add", getErrorMessage(err));
                        throw err;
                    }
                }}
            />
        </>
    );
}

function ActivityTab({ shopId, branch }) {
    const [period, setPeriod] = useState(() => initialPeriod("overall"));
    const [who, setWho] = useState("");
    const [type, setType] = useState("");
    const [invoiceText, setInvoiceText] = useState("");
    const [sort, setSort] = useState("newest");
    const [page, setPage] = useState(0);
    const [staff, setStaff] = useState([]);
    const invoice = useDebounced(invoiceText.trim());
    const periodKey = `${period.key}|${period.from}|${period.to}`;
    useEffect(() => setPage(0), [periodKey, who, type, invoice, sort]);
    useEffect(() => {
        listBranchEmployees(shopId).then(setStaff).catch(() => setStaff([]));
    }, [shopId]);
    const params = (pageNumber, pageSize) => ({
        shopId, ...rangeParams(period), employeeId: who || undefined, type: type || undefined,
        invoiceId: invoice || undefined, sort, pageNumber, pageSize,
    });
    const [state, reload] = useList(() => getActivities(params(page, PAGE_SIZE)), [shopId, periodKey, who, type, invoice, sort, page]);
    const exportRows = async () => {
        const all = await fetchAllPages(({ pageNumber, pageSize }) => getActivities(params(pageNumber, pageSize)));
        return exportTab(branch, "Activity", [
            ["Invoice", invoice],
            ["Period", periodText(period)],
            ["Who", who && staff.find((e) => e.userId === who)?.name],
            ["What", type && humanize(type)],
            ["Sort", DATE_SORTS.find((o) => o.value === sort)?.label],
        ], [
            { header: "When", value: (a) => a.timestamp, type: "datetime" },
            { header: "Who", value: (a) => a.employeeName },
            { header: "What", value: (a) => humanize(a.type) },
            { header: "Invoice no.", value: (a) => a.invoiceId },
            { header: "Notes", value: (a) => a.notes },
        ], all);
    };
    const rows = state.data?.content || [];
    const filtered = period.key !== "overall" || !!who || !!type || !!invoice || sort !== "newest";
    const clear = () => { setPeriod(initialPeriod("overall")); setWho(""); setType(""); setInvoiceText(""); setSort("newest"); };
    return (
        <>
            <div className="so-filterbar">
                <div className="so-toolbar">
                    <SearchBox value={invoiceText} onChange={setInvoiceText} placeholder="Invoice no. (exact), e.g. SARI-12-11-2026-00042" />
                    <PeriodFilter value={period} onChange={setPeriod} />
                    <label className="so-inline-field">
                        <span>Sort by</span>
                        <Select options={DATE_SORTS} value={sort} onChange={(e) => setSort(e.target.value)} />
                    </label>
                </div>
                <div className="so-filter-row">
                    <div className="so-filter-group">
                        <span className="so-filter-label">Who</span>
                        <Select aria-label="Who" placeholder="Everyone" options={staff.map((e) => ({ value: e.userId, label: e.name }))}
                            value={who} onChange={(e) => setWho(e.target.value)} />
                    </div>
                    <div className="so-filter-group">
                        <span className="so-filter-label">What</span>
                        <Select aria-label="Activity type" placeholder="All activities" options={ACTIVITY_TYPES.map((t) => ({ value: t, label: humanize(t) }))}
                            value={type} onChange={(e) => setType(e.target.value)} />
                    </div>
                    <FilterEnd page={state.data} loading={state.loading} noun="activity" plural="activities" filtered={filtered} onClear={clear} onExport={exportRows} />
                </div>
            </div>
            <ListBody state={state} reload={reload} empty={!rows.length && (filtered ? "No activity matches these filters" : "No activity yet")}>
                <div className="so-table-wrap">
                    <table className="so-table">
                        <thead><tr><th>When</th><th>Who</th><th>What</th><th>Invoice</th><th>Notes</th></tr></thead>
                        <tbody>
                            {rows.map((a) => (
                                <tr key={a.id}>
                                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(a.timestamp)}</td>
                                    <td>{a.employeeName || "—"}</td>
                                    <td>{humanize(a.type)}</td>
                                    <td className="so-mono">{a.invoiceId || "—"}</td>
                                    <td><span className="so-ellipsis" style={{ display: "inline-block", maxWidth: 320 }} title={a.notes}>{a.notes || "—"}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </ListBody>
            <Pagination page={state.data} pageSize={PAGE_SIZE} onChange={setPage} />
        </>
    );
}

// ------------------------------------------------------------------ page

export default function BranchPage() {
    const { shopId } = useParams();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const tab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "orders";
    const [shop, reloadShop] = useList(() => listShopSummaries().then((all) => ({ all, one: all.find((x) => x.shopId === shopId) || null })), [shopId]);
    const s = shop.data?.one;
    const branch = s?.shopName || "Branch";
    const [modal, setModal] = useState(""); // branch | owner | petty | report
    const [version, setVersion] = useState(0); // remounts the tab after a change
    const changed = (message) => {
        if (message) toast.success(message);
        setModal("");
        reloadShop();
        setVersion((v) => v + 1);
    };

    return (
        <>
            <button type="button" className="so-back" onClick={() => navigate("/owner/branches")}>
                <FiArrowLeft aria-hidden /> All branches
            </button>
            {shop.error ? (
                <ErrorBox message={shop.error} onRetry={reloadShop} />
            ) : shop.loading ? (
                <Skeleton height={90} />
            ) : !s ? (
                <EmptyState title="Branch not found" action={<Button variant="secondary" onClick={() => navigate("/owner/branches")}>All branches</Button>} />
            ) : (
                <>
                    <PageHeader
                        eyebrow="Branch"
                        title={s.shopName || "Branch"}
                        subtitle={
                            <span className="ow-branch-info ow-branch-info-inline">
                                <span><FiUser aria-hidden /> {s.ownerName || "No shop owner"}</span>
                                {s.shopContactNumber && <span><FiPhone aria-hidden /> {s.shopContactNumber}</span>}
                                {s.shopAddress && <span><FiMapPin aria-hidden /> {s.shopAddress}</span>}
                                {s.gstNumber && <span><FiHash aria-hidden /> GST {s.gstNumber}</span>}
                            </span>
                        }
                        actions={
                            <div className="so-actions">
                                <Button variant="ghost" size="sm" onClick={() => navigate(`/owner/overview?shop=${encodeURIComponent(shopId)}`)}>
                                    <FiBarChart2 aria-hidden /> Figures
                                </Button>
                                {FEATURES.branchReportExport && (
                                    <Button variant="secondary" size="sm" onClick={() => setModal("report")}>
                                        <FiDownload aria-hidden /> Download report
                                    </Button>
                                )}
                                <Button variant="secondary" size="sm" onClick={() => setModal("branch")}>
                                    <FiEdit2 aria-hidden /> Edit branch
                                </Button>
                                <Button variant="secondary" size="sm" onClick={() => setModal("owner")}>
                                    <FiUserCheck aria-hidden /> Shop owner
                                </Button>
                                <Button size="sm" onClick={() => setModal("petty")}>
                                    <FiPlusCircle aria-hidden /> Add petty cash
                                </Button>
                            </div>
                        }
                    />
                    <Tabs tabs={TABS} value={tab} onChange={(k) => setParams(k === "orders" ? {} : { tab: k }, { replace: true })} />
                    <div style={{ marginTop: 16 }} key={version}>
                        {tab === "orders" && <OrdersTab shopId={shopId} branch={branch} />}
                        {tab === "receipts" && <ReceiptsTab shopId={shopId} branch={branch} />}
                        {tab === "deliveries" && <DeliveriesTab shopId={shopId} branch={branch} />}
                        {tab === "expenses" && <ExpensesTab shopId={shopId} pettyCash={s.pettyCash} branch={branch} />}
                        {tab === "people" && <PeopleTab shopId={shopId} branchName={s.shopName || "this branch"} branches={shop.data?.all || []} onChanged={reloadShop} />}
                        {tab === "activity" && <ActivityTab shopId={shopId} branch={branch} />}
                        {tab === "pettycash" && <PettyCashTab shopId={shopId} pettyCash={s.pettyCash} branch={branch} /> }
                    </div>

                    <FormModal
                        open={modal === "branch"}
                        title="Edit branch"
                        changedOnly
                        initial={s}
                        fields={[
                            { name: "shopName", label: "Branch name", required: true, wide: true },
                            { name: "shopAddress", label: "Address", type: "textarea" },
                            { name: "shopContactNumber", label: "Branch phone", type: "phone" },
                            { name: "gstNumber", label: "GST number" },
                        ]}
                        onClose={() => setModal("")}
                        onSubmit={async (changes) => {
                            await updateBranch(shopId, changes);
                            changed("Branch updated");
                        }}
                    />
                    <FormModal
                        open={modal === "owner"}
                        title="Shop owner's details"
                        changedOnly
                        initial={{ name: s.ownerName || "", phone: s.shopContactNumber || "" }}
                        intro="Change only what you need; empty fields stay as they are. A new email or password signs the shop owner out on every device."
                        fields={[
                            { name: "name", label: "Name" },
                            { name: "phone", label: "Phone", type: "phone", hint: "Also saved as the branch phone" },
                            { name: "email", label: "New login email", type: "email" },
                            { name: "password", label: "New password", type: "password", hint: "8+ characters, a letter and a digit" },
                            { name: "salary", label: "Salary (₹ / month)", type: "money" },
                            { name: "reason", label: "Reason (kept with the old details)", type: "textarea" },
                        ]}
                        onClose={() => setModal("")}
                        onSubmit={async (changes) => {
                            await updateShopOwner(shopId, changes);
                            changed("Shop owner's details updated");
                        }}
                    />
                    {FEATURES.branchReportExport && (
                        <ReportDownloadModal open={modal === "report"} onClose={() => setModal("")}
                            shopId={shopId} branchName={s.shopName || "Branch"} />
                    )}
                    <FormModal
                        open={modal === "petty"}
                        title={`Add petty cash · ${s.shopName || "branch"}`}
                        submitLabel="Add cash"
                        intro={`Current balance ${formatMoney(s.pettyCash)}.`}
                        fields={[{ name: "amount", label: "Amount (₹)", type: "money", required: true, min: 1 }]}
                        onClose={() => setModal("")}
                        onSubmit={async ({ amount }) => {
                            await addBranchPettyCash(shopId, amount);
                            changed(`${formatMoney(amount)} added to petty cash`);
                        }}
                    />
                </>
            )}
        </>
    );
}
