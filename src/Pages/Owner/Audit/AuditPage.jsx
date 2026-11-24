// Platform owner: audit, view only. Tabs: Activity log (filter by type) · Deleted invoices · Deleted expenses (needs a
// branch) · Skipped steps (items a shop owner marked completed). Branch, period and tab live in the URL; 20 per page.
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiSearch } from "react-icons/fi";
import { listShopSummaries } from "../../../api/owner.js";
import { getActivities, getDeletedInvoices } from "../../../api/reports.js";
import { listDeletedExpenses } from "../../../api/expenses.js";
import { PageHeader, Card, Tabs, EmptyState, ErrorBox, Skeleton } from "../../shared/components/ui.jsx";
import { Select, Pagination } from "../../shared/components/form.jsx";
import PeriodFilter from "../../shared/components/PeriodFilter.jsx";
import { rangeParams } from "../../shared/lib/period.js";
import { formatMoney, formatDate, formatDateTime, humanize } from "../../shared/lib/format.js";
import { periodFrom, periodText, withPeriod, useSection } from "../lib/owner.js";
import ExportButton from "../../shared/components/ExportButton.jsx";
import { exportXlsx, exportFileName, fetchAllPages } from "../../shared/lib/exportXlsx.js";

const PAGE_SIZE = 20;
const TABS = [
    { key: "log", label: "Activity log" },
    { key: "invoices", label: "Deleted invoices" },
    { key: "expenses", label: "Deleted expenses" },
    { key: "skipped", label: "Skipped steps" },
];
// ActivityType (backend), in a readable order
const TYPES = [
    "INVOICE_CREATED", "INVOICE_DELETED", "RECEIPT_DELETED", "ORDER_DELIVERED", "ORDER_COMPLETED", "ITEM_MARKED_COMPLETED",
    "ASSIGNED_TO_TAILOR_MASTER", "TAILOR_MASTER_CUTTING", "ASSIGNED_TO_TAILOR", "TAILOR_STARTED", "TAILOR_STITCHING",
    "TAILOR_COMPLETED", "ASSIGNED_TO_ASSISTANT", "ASSISTANT_HEMMING", "ASSISTANT_IRONING", "ASSISTANT_COMPLETED", "USER_DELETED",
];

function useDebounced(value, ms = 350) {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return v;
}

/** Excel of every row of a paged audit list. branch = the picked branch's name ("" = all branches). */
const exportAudit = async ({ name, branch, period, filters = [], fetchPage, columns }) => {
    const rows = await fetchAllPages(fetchPage);
    return exportXlsx({
        fileName: exportFileName(name, branch),
        sheetName: name,
        title: `${branch || "All branches"} · ${name}`,
        filters: [["Branch", branch || "All branches"], ["Period", periodText(period)], ...filters],
        columns,
        rows,
    });
};

/** Toolbar above a list: its filters on the left, Export on the right. */
const ListToolbar = ({ children, onExport, disabled }) => (
    <div className="so-toolbar" style={{ marginBottom: 12 }}>
        {children || <span />}
        <div className="so-filter-end">
            <ExportButton onExport={onExport} disabled={disabled} />
        </div>
    </div>
);

function Body({ state, reload, empty, children }) {
    if (state.error) return <ErrorBox message={state.error} onRetry={reload} />;
    if (state.loading) return <Skeleton height={280} />;
    if (empty) return <EmptyState compact title={empty} />;
    return children;
}

function ActivityTable({ shopId, period, type, branchName, branch, name, filter }) {
    const [page, setPage] = useState(0);
    const key = `${shopId}|${period.key}|${period.from}|${period.to}|${type}`;
    useEffect(() => setPage(0), [key]);
    const fetchPage = ({ pageNumber, pageSize }) => getActivities({ ...(shopId ? { shopId } : {}), ...(type ? { type } : {}), ...rangeParams(period), pageNumber, pageSize });
    const [state, reload] = useSection(() => fetchPage({ pageNumber: page, pageSize: PAGE_SIZE }), [key, page]);
    const rows = state.data?.content || [];
    const exportRows = () => exportAudit({
        name, branch, period, fetchPage,
        filters: filter ? [["What", type ? humanize(type) : "Everything"]] : [],
        columns: [
            { header: "When", value: (a) => a.timestamp, type: "datetime" },
            { header: "Branch", value: (a) => branchName(a.shopId) },
            { header: "Who", value: (a) => a.employeeName },
            { header: "What", value: (a) => humanize(a.type) },
            { header: "Invoice", value: (a) => a.invoiceId },
            { header: "Notes", value: (a) => a.notes },
        ],
    });
    return (
        <>
            <ListToolbar onExport={exportRows} disabled={state.loading || !state.data?.totalElements}>{filter}</ListToolbar>
            <Body state={state} reload={reload} empty={!rows.length && "No activity for these filters"}>
                <div className="so-table-wrap">
                    <table className="so-table">
                        <thead><tr><th>When</th><th>Branch</th><th>Who</th><th>What</th><th>Invoice</th><th>Notes</th></tr></thead>
                        <tbody>
                            {rows.map((a) => (
                                <tr key={a.id}>
                                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(a.timestamp)}</td>
                                    <td>{branchName(a.shopId)}</td>
                                    <td>{a.employeeName || "—"}</td>
                                    <td>{humanize(a.type)}</td>
                                    <td className="so-mono">{a.invoiceId || "—"}</td>
                                    <td><span className="so-ellipsis" style={{ display: "inline-block", maxWidth: 320 }} title={a.notes}>{a.notes || "—"}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Body>
            <Pagination page={state.data} pageSize={PAGE_SIZE} onChange={setPage} />
        </>
    );
}

function DeletedInvoices({ shopId, period, branchName, branch }) {
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState("");
    const q = useDebounced(search);
    const key = `${shopId}|${period.key}|${period.from}|${period.to}|${q}`;
    useEffect(() => setPage(0), [key]);
    const fetchPage = ({ pageNumber, pageSize }) => getDeletedInvoices({ ...(shopId ? { shopId } : {}), ...rangeParams(period), search: q || undefined, pageNumber, pageSize });
    const [state, reload] = useSection(() => fetchPage({ pageNumber: page, pageSize: PAGE_SIZE }), [key, page]);
    const rows = state.data?.content || [];
    const exportRows = () => exportAudit({
        name: "Deleted invoices", branch, period, fetchPage,
        filters: [["Search", q.trim()]],
        columns: [
            { header: "Invoice no.", value: (r) => r.invoiceId },
            { header: "Invoice date", value: (r) => r.invoiceDate, type: "date" },
            { header: "Items", value: (r) => r.itemCount, type: "number" },
            { header: "Branch", value: (r) => branchName(r.shopId) },
            { header: "Customer", value: (r) => r.customerName },
            { header: "Phone", value: (r) => r.customerPhone },
            { header: "Amount (with GST)", value: (r) => r.totalAmountWithGST, type: "money" },
            { header: "Paid", value: (r) => r.advancePaid, type: "money" },
            { header: "Deleted on", value: (r) => r.deletedAt, type: "datetime" },
            { header: "Deleted by", value: (r) => r.deletedByName },
            { header: "Reason", value: (r) => r.reason },
        ],
    });
    return (
        <>
            <ListToolbar onExport={exportRows} disabled={state.loading || !state.data?.totalElements}>
                <div className="so-search" style={{ maxWidth: 360, flex: 1 }}>
                    <FiSearch aria-hidden />
                    <input className="so-input" type="search" placeholder="Search invoice no., customer or phone" aria-label="Search deleted invoices"
                        value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
            </ListToolbar>
            <Body state={state} reload={reload} empty={!rows.length && "No deleted invoices in this period"}>
                <div className="so-table-wrap">
                    <table className="so-table">
                        <thead><tr><th>Invoice</th><th>Branch</th><th>Customer</th><th className="so-num">Amount</th><th className="so-num">Paid</th><th>Deleted</th><th>Reason</th></tr></thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.archiveId}>
                                    <td>
                                        <div className="so-cell-main so-mono">{r.invoiceId}</div>
                                        <div className="so-cell-sub">{formatDate(r.invoiceDate)} · {r.itemCount} items</div>
                                    </td>
                                    <td>{branchName(r.shopId)}</td>
                                    <td>
                                        <div className="so-cell-main">{r.customerName || "—"}</div>
                                        <div className="so-cell-sub">{r.customerPhone}</div>
                                    </td>
                                    <td className="so-num">{formatMoney(r.totalAmountWithGST)}</td>
                                    <td className="so-num">{formatMoney(r.advancePaid)}</td>
                                    <td>
                                        <div style={{ whiteSpace: "nowrap" }}>{formatDateTime(r.deletedAt)}</div>
                                        <div className="so-cell-sub">{r.deletedByName || "—"}</div>
                                    </td>
                                    <td><span className="so-ellipsis" style={{ display: "inline-block", maxWidth: 260 }} title={r.reason}>{r.reason || "—"}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Body>
            <Pagination page={state.data} pageSize={PAGE_SIZE} onChange={setPage} />
        </>
    );
}

function DeletedExpenses({ shopId, period, branch }) {
    const [page, setPage] = useState(0);
    const key = `${shopId}|${period.key}|${period.from}|${period.to}`;
    useEffect(() => setPage(0), [key]);
    const fetchPage = ({ pageNumber, pageSize }) => listDeletedExpenses({ shopId, ...rangeParams(period), pageNumber, pageSize });
    const [state, reload] = useSection(() => fetchPage({ pageNumber: page, pageSize: PAGE_SIZE }), [key, page]);
    const rows = state.data?.content || [];
    const exportRows = () => exportAudit({
        name: "Deleted expenses", branch, period, fetchPage,
        columns: [
            { header: "Expense date", value: (r) => r.expenseDate, type: "date" },
            { header: "Category", value: (r) => r.expenseType },
            { header: "For", value: (r) => r.employeeName || "Shop" },
            { header: "Amount", value: (r) => r.expenseAmount, type: "money" },
            { header: "Deleted on", value: (r) => r.deletedAt, type: "datetime" },
            { header: "Deleted by", value: (r) => r.deletedByName },
            { header: "Reason", value: (r) => r.reason },
        ],
    });
    return (
        <>
            <ListToolbar onExport={exportRows} disabled={state.loading || !state.data?.totalElements} />
            <Body state={state} reload={reload} empty={!rows.length && "No deleted expenses in this period"}>
                <div className="so-table-wrap">
                    <table className="so-table">
                        <thead><tr><th>Expense date</th><th>Category</th><th>For</th><th className="so-num">Amount</th><th>Deleted</th><th>Reason</th></tr></thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.archiveId || r.id}>
                                    <td style={{ whiteSpace: "nowrap" }}>{formatDate(r.expenseDate)}</td>
                                    <td>{r.expenseType || "—"}</td>
                                    <td>{r.employeeName || "Shop"}</td>
                                    <td className="so-num">{formatMoney(r.expenseAmount)}</td>
                                    <td>
                                        <div style={{ whiteSpace: "nowrap" }}>{formatDateTime(r.deletedAt)}</div>
                                        <div className="so-cell-sub">{r.deletedByName || "—"}</div>
                                    </td>
                                    <td><span className="so-ellipsis" style={{ display: "inline-block", maxWidth: 260 }} title={r.reason}>{r.reason || "—"}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Body>
            <Pagination page={state.data} pageSize={PAGE_SIZE} onChange={setPage} />
        </>
    );
}

export default function AuditPage() {
    const [params, setParams] = useSearchParams();
    const period = periodFrom(params);
    const shopId = params.get("shop") || "";
    const tab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "log";
    const type = params.get("type") || "";
    const setParam = (key, value) => setParams((cur) => {
        const next = new URLSearchParams(cur);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
    }, { replace: true });

    const [shops] = useSection(() => listShopSummaries(), []);
    const names = useMemo(() => new Map((shops.data || []).map((s) => [s.shopId, s.shopName])), [shops.data]);
    const branchName = (id) => names.get(id) || "—";
    const branch = shopId ? names.get(shopId) || "Branch" : "";
    const options = (shops.data || []).map((s) => ({ value: s.shopId, label: s.shopName || "Branch" })).sort((a, b) => a.label.localeCompare(b.label));

    return (
        <>
            <PageHeader eyebrow={shopId ? "Branch" : "All branches"} title="Audit" subtitle={`${periodText(period)} · view only`}
                actions={
                    <div className="so-actions" style={{ alignItems: "center" }}>
                        <label className="so-inline-field">
                            <span>Branch</span>
                            <Select aria-label="Branch" value={shopId} onChange={(e) => setParam("shop", e.target.value)} placeholder="All branches" options={options} />
                        </label>
                        <PeriodFilter value={period} onChange={(p) => setParams((cur) => withPeriod(cur, p), { replace: true })} />
                    </div>
                } />
            <Tabs tabs={TABS} value={tab} onChange={(k) => setParam("tab", k === "log" ? "" : k)} />
            <div style={{ marginTop: 16 }}>
                <Card>
                    {tab === "log" && (
                        <ActivityTable shopId={shopId} period={period} type={type} branchName={branchName} branch={branch} name="Activity log"
                            filter={
                                <label className="so-inline-field">
                                    <span>What</span>
                                    <Select aria-label="Activity type" value={type} onChange={(e) => setParam("type", e.target.value)} placeholder="Everything"
                                        options={TYPES.map((t) => ({ value: t, label: humanize(t) }))} />
                                </label>
                            } />
                    )}
                    {tab === "invoices" && <DeletedInvoices shopId={shopId} period={period} branchName={branchName} branch={branch} />}
                    {tab === "expenses" && (shopId
                        ? <DeletedExpenses shopId={shopId} period={period} branch={branch} />
                        : <EmptyState compact title="Pick a branch to see its deleted expenses" message="Use the Branch filter above." />)}
                    {tab === "skipped" && (
                        <>
                            <p className="so-hint" style={{ marginTop: 0 }}>Items a shop owner marked completed directly, skipping the remaining steps (no worker credit).</p>
                            <ActivityTable shopId={shopId} period={period} type="ITEM_MARKED_COMPLETED" branchName={branchName} branch={branch} name="Skipped steps" />
                        </>
                    )}
                </Card>
            </div>
        </>
    );
}
