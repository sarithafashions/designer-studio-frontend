// Invoices: Pending (not delivered) · Completed (delivered = fully paid) · Deleted.
// Filters: search (invoice no. / name / phone), stage, payment status, date range, sort; paged.
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiSearch, FiFilePlus, FiFileText, FiX } from "react-icons/fi";
import { listInvoices, openReceiptPdf } from "../../../api/invoices.js";
import { getDeletedInvoices } from "../../../api/reports.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { toast } from "../../../utils/toast.js";
import { PageHeader, Tabs, Button, EmptyState, ErrorBox, Skeleton, Segmented } from "../../shared/components/ui.jsx";
import { Select, Pagination } from "../../shared/components/form.jsx";
import DateField from "../../shared/components/DateField.jsx";
import { StageBadge, PaymentBadge, OverdueBadge, ItemProgress } from "../../shared/components/status.jsx";
import { daysOverdue } from "../../shared/lib/invoice.js";
import InvoiceWizard from "./wizard/InvoiceWizard.jsx";
import ExportButton from "../../shared/components/ExportButton.jsx";
import { exportXlsx, exportFileName, fetchAllPages } from "../../shared/lib/exportXlsx.js";
import { formatMoney, formatDate, formatDateTime, formatDueDate, humanize } from "../../shared/lib/format.js";

const PAGE_SIZE = 20;

const TABS = [
    { key: "pending", label: "Pending" },
    { key: "completed", label: "Completed" },
    { key: "deleted", label: "Deleted" },
];

// Segmented options ("" = all).
const STAGE_OPTIONS = [
    { key: "", label: "All" },
    { key: "NEW", label: "New" },
    { key: "IN_PRODUCTION", label: "In production" },
    { key: "READY", label: "Ready" },
];
const PAYMENT_OPTIONS = [
    { key: "", label: "All" },
    { key: "Dues", label: "Unpaid" },
    { key: "Partial", label: "Partly paid" },
    { key: "Paid", label: "Paid" },
];
const SORT_OPTIONS = [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
    { value: "dueSoonest", label: "Due date: soonest" },
    { value: "dueLatest", label: "Due date: latest" },
];

const EMPTY_FILTERS = { search: "", stage: "", paymentStatus: "", from: "", to: "", sort: "newest" };

/** Query params for a tab + filters (blank values left out). */
const paramsFor = (tab, f, pageNumber, pageSize = PAGE_SIZE) => {
    const p = { pageNumber, pageSize };
    if (f.search.trim()) p.search = f.search.trim();
    if (f.from) p.from = f.from;
    if (f.to) p.to = f.to;
    if (tab === "deleted") return p;
    p.status = tab === "completed" ? "delivered" : "pending";
    p.sort = f.sort || "newest";
    if (tab === "pending") {
        if (f.stage) p.stage = f.stage;
        if (f.paymentStatus) p.paymentStatus = f.paymentStatus;
    }
    return p;
};

const fetchTab = (tab, params) => (tab === "deleted" ? getDeletedInvoices(params) : listInvoices(params));

const PAYMENT_LABEL = { Dues: "Unpaid", Partial: "Partly paid", Paid: "Paid" };
const STAGE_LABEL = { NEW: "New", IN_PRODUCTION: "In production", READY: "Ready", DELIVERED: "Delivered" };

/** Excel columns per tab (same information as the table, one value per cell). */
const exportColumns = (tab) => {
    const invoice = [
        { header: "Invoice no.", value: (r) => r.invoiceId },
        { header: "Invoice date", value: (r) => r.invoiceDate, type: "date" },
        { header: "Customer", value: (r) => r.customerName },
        { header: "Phone", value: (r) => r.customerPhone },
    ];
    if (tab === "deleted") {
        return [
            ...invoice,
            { header: "Amount (with GST)", value: (r) => r.totalAmountWithGST, type: "money" },
            { header: "Paid", value: (r) => r.advancePaid, type: "money" },
            { header: "Deleted on", value: (r) => r.deletedAt, type: "datetime" },
            { header: "Deleted by", value: (r) => r.deletedByName },
            { header: "Reason", value: (r) => r.reason },
        ];
    }
    return [
        ...invoice,
        { header: "Items", value: (r) => (r.itemNames || []).join(", ") },
        { header: "Items done", value: (r) => `${r.completedItemCount ?? 0} of ${r.itemCount ?? 0}` },
        { header: "Amount (with GST)", value: (r) => r.totalAmountWithGST, type: "money" },
        ...(tab === "completed" ? [] : [{ header: "Balance due", value: (r) => r.balanceDue, type: "money" }]),
        { header: "Payment", value: (r) => PAYMENT_LABEL[r.paymentStatus] || r.paymentStatus },
        ...(tab === "completed"
            ? [
                  { header: "Receipt no.", value: (r) => r.receiptNo },
                  { header: "Delivered on", value: (r) => r.deliveredAt, type: "datetime" },
              ]
            : [
                  { header: "Stage", value: (r) => STAGE_LABEL[r.stage] || humanize(r.stage) },
                  { header: "Due", value: (r) => formatDueDate(r.expectedDeliveryDate) },
                  { header: "Days overdue", value: (r) => daysOverdue(r.expectedDeliveryDate, r.stage) || null, type: "number" },
              ]),
    ];
};

export default function InvoicesPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const tab = TABS.some((t) => t.key === searchParams.get("tab")) ? searchParams.get("tab") : "pending";

    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [searchText, setSearchText] = useState("");
    const [pageNumber, setPageNumber] = useState(0);
    const [state, setState] = useState({ loading: true, page: null, error: null });
    const [counts, setCounts] = useState({});
    const [wizardOpen, setWizardOpen] = useState(false);

    // Debounce the search box.
    useEffect(() => {
        const t = setTimeout(() => {
            setFilters((f) => (f.search === searchText ? f : { ...f, search: searchText }));
            setPageNumber(0);
        }, 350);
        return () => clearTimeout(t);
    }, [searchText]);

    const load = useCallback(() => {
        let live = true;
        setState((s) => ({ ...s, loading: true, error: null }));
        fetchTab(tab, paramsFor(tab, filters, pageNumber))
            .then((page) => {
                if (!live) return;
                setState({ loading: false, page, error: null });
            })
            .catch((err) => live && setState({ loading: false, page: null, error: getErrorMessage(err, "Could not load invoices") }));
        return () => {
            live = false;
        };
    }, [tab, filters, pageNumber]);

    useEffect(() => load(), [load]);

    // Tab counts (all invoices, no filters) once on open.
    useEffect(() => {
        TABS.forEach(({ key }) =>
            fetchTab(key, paramsFor(key, EMPTY_FILTERS, 0, 1))
                .then((page) => setCounts((c) => ({ ...c, [key]: page?.totalElements ?? 0 })))
                .catch(() => {}),
        );
    }, []);

    const setTab = (key) => {
        setSearchParams(key === "pending" ? {} : { tab: key });
        setPageNumber(0);
    };
    const setFilter = (key, value) => {
        setFilters((f) => ({ ...f, [key]: value }));
        setPageNumber(0);
    };
    const clearFilters = () => {
        setFilters(EMPTY_FILTERS);
        setSearchText("");
        setPageNumber(0);
    };
    const hasFilters =
        searchText || filters.stage || filters.paymentStatus || filters.from || filters.to || filters.sort !== "newest";

    const rows = state.page?.content || [];

    const exportRows = async () => {
        const all = await fetchAllPages(({ pageNumber, pageSize }) => fetchTab(tab, paramsFor(tab, filters, pageNumber, pageSize)));
        const tabLabel = TABS.find((t) => t.key === tab)?.label;
        return exportXlsx({
            fileName: exportFileName("Invoices", tabLabel),
            sheetName: `${tabLabel} invoices`,
            title: `${localStorage.getItem("shopName") || "Saritha Fashions"} · ${tabLabel} invoices`,
            filters: [
                ["Search", filters.search],
                ["Stage", tab === "pending" && STAGE_LABEL[filters.stage]],
                ["Payment", tab === "pending" && PAYMENT_LABEL[filters.paymentStatus]],
                [tab === "deleted" ? "Deleted from" : "From", filters.from],
                ["To", filters.to],
                ["Sort", tab !== "deleted" && SORT_OPTIONS.find((o) => o.value === filters.sort)?.label],
            ].map(([k, v]) => [k, v || ""]),
            columns: exportColumns(tab),
            rows: all,
        });
    };

    return (
        <>
            <PageHeader
                title="Invoices"
                subtitle="Track orders from booking to delivery"
                actions={
                    <Button onClick={() => setWizardOpen(true)}>
                        <FiFilePlus aria-hidden /> New invoice
                    </Button>
                }
            />

            <Tabs tabs={TABS.map((t) => ({ ...t, count: counts[t.key] }))} value={tab} onChange={setTab} />

            <div className="so-filterbar">
                <div className="so-toolbar">
                    <div className="so-search">
                        <FiSearch aria-hidden />
                        <input
                            className="so-input"
                            type="search"
                            placeholder="Search by invoice no., customer name or phone"
                            aria-label="Search invoices"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                        />
                    </div>
                    {tab !== "deleted" && (
                        <label className="so-inline-field">
                            <span>Sort by</span>
                            <Select options={SORT_OPTIONS} value={filters.sort} onChange={(e) => setFilter("sort", e.target.value)} />
                        </label>
                    )}
                </div>

                <div className="so-filter-row">
                    {tab === "pending" && (
                        <>
                            <div className="so-filter-group">
                                <span className="so-filter-label">Stage</span>
                                <Segmented label="Stage" options={STAGE_OPTIONS} value={filters.stage} onChange={(v) => setFilter("stage", v)} />
                            </div>
                            <div className="so-filter-group">
                                <span className="so-filter-label">Payment</span>
                                <Segmented
                                    label="Payment"
                                    options={PAYMENT_OPTIONS}
                                    value={filters.paymentStatus}
                                    onChange={(v) => setFilter("paymentStatus", v)}
                                />
                            </div>
                        </>
                    )}
                    <div className="so-filter-group">
                        <span className="so-filter-label">{tab === "deleted" ? "Deleted between" : "Invoice date"}</span>
                        <div className="so-date-range">
                            <DateField
                                ariaLabel="From date"
                                clearable
                                value={filters.from}
                                max={filters.to || undefined}
                                onChange={(v) => setFilter("from", v)}
                            />
                            <span className="so-hint">to</span>
                            <DateField
                                ariaLabel="To date"
                                clearable
                                value={filters.to}
                                min={filters.from || undefined}
                                onChange={(v) => setFilter("to", v)}
                            />
                        </div>
                    </div>
                    <div className="so-filter-end">
                        {!state.loading && state.page && (
                            <span className="so-hint">
                                {state.page.totalElements} {state.page.totalElements === 1 ? "invoice" : "invoices"}
                            </span>
                        )}
                        {hasFilters && (
                            <Button variant="ghost" size="sm" onClick={clearFilters}>
                                <FiX aria-hidden /> Clear filters
                            </Button>
                        )}
                        <ExportButton onExport={exportRows} disabled={state.loading || !state.page?.totalElements} />
                    </div>
                </div>
            </div>

            {state.error ? (
                <ErrorBox message={state.error} onRetry={load} />
            ) : (
                <div className="so-table-wrap">
                    {tab === "deleted" ? (
                        <DeletedTable rows={rows} loading={state.loading} onOpen={(r) => navigate(`/shopOwner/invoices/deleted/${r.archiveId}`)} />
                    ) : (
                        <InvoiceTable
                            rows={rows}
                            loading={state.loading}
                            completed={tab === "completed"}
                            onOpen={(r) => navigate(`/shopOwner/invoices/${encodeURIComponent(r.invoiceId)}`)}
                        />
                    )}
                    {!state.loading && rows.length === 0 && (
                        <EmptyState
                            title={hasFilters ? "No invoices match these filters" : `No ${tab} invoices`}
                            action={
                                hasFilters && (
                                    <Button variant="secondary" size="sm" onClick={clearFilters}>
                                        Clear filters
                                    </Button>
                                )
                            }
                        />
                    )}
                </div>
            )}
            <Pagination page={state.page} pageSize={PAGE_SIZE} onChange={setPageNumber} />
            <InvoiceWizard
                open={wizardOpen}
                onClose={(inv) => {
                    setWizardOpen(false);
                    if (inv?.invoiceId) navigate(`/shopOwner/invoices/${encodeURIComponent(inv.invoiceId)}`);
                }}
                onDone={() => load()}
            />
        </>
    );
}

const SkeletonRows = ({ cols }) =>
    Array.from({ length: 6 }).map((_, i) => (
        <tr key={i}>
            {Array.from({ length: cols }).map((__, j) => (
                <td key={j}>
                    <Skeleton height={14} width={j === 0 ? "80%" : "60%"} />
                </td>
            ))}
        </tr>
    ));

// Open the row on click or Enter; inner buttons stop propagation.
const rowProps = (onOpen, r) => ({
    className: "so-row-link",
    tabIndex: 0,
    onClick: () => onOpen(r),
    onKeyDown: (e) => e.key === "Enter" && onOpen(r),
});

function InvoiceTable({ rows, loading, completed, onOpen }) {
    const openReceipt = async (e, receiptNo) => {
        e.stopPropagation();
        try {
            await openReceiptPdf(receiptNo);
        } catch (err) {
            toast.error("Could not open the receipt", getErrorMessage(err));
        }
    };
    return (
        <table className="so-table">
            <thead>
                <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th className="so-num">Amount</th>
                    {!completed && <th className="so-num">Balance</th>}
                    <th>Payment</th>
                    <th>{completed ? "Receipt" : "Stage"}</th>
                    <th>{completed ? "Delivered" : "Due"}</th>
                    <th aria-label="Actions" />
                </tr>
            </thead>
            <tbody>
                {loading ? (
                    <SkeletonRows cols={completed ? 8 : 9} />
                ) : (
                    rows.map((r) => {
                        const late = daysOverdue(r.expectedDeliveryDate, r.stage);                        return (
                            <tr key={r.id || r.invoiceId} {...rowProps(onOpen, r)}>
                                <td>
                                    <div className="so-cell-main so-mono">{r.invoiceId}</div>
                                    <div className="so-cell-sub">{formatDate(r.invoiceDate)}</div>
                                </td>
                                <td>
                                    <div className="so-cell-main">{r.customerName || "—"}</div>
                                    <div className="so-cell-sub">{r.customerPhone}</div>
                                </td>
                                <td title={(r.itemNames || []).join(", ")}>
                                    <ItemProgress completed={r.completedItemCount} total={r.itemCount} />
                                </td>
                                <td className="so-num">{formatMoney(r.totalAmountWithGST)}</td>
                                {!completed && (
                                    <td className="so-num" style={{ color: r.balanceDue > 0 ? "var(--so-primary)" : "var(--so-slate)" }}>
                                        {formatMoney(r.balanceDue)}
                                    </td>
                                )}
                                <td>
                                    <PaymentBadge status={r.paymentStatus} />
                                </td>
                                <td>
                                    {completed ? (
                                        r.receiptNo ? (
                                            <button type="button" className="so-linkbtn" style={{ padding: 0, width: "auto" }} onClick={(e) => openReceipt(e, r.receiptNo)}>
                                                <FiFileText aria-hidden /> <span className="so-mono">{r.receiptNo}</span>
                                            </button>
                                        ) : (
                                            "—"
                                        )
                                    ) : (
                                        <StageBadge stage={r.stage} />
                                    )}
                                </td>
                                {completed ? (
                                    <td>
                                        <div style={{ whiteSpace: "nowrap" }}>{r.deliveredAt ? formatDateTime(r.deliveredAt) : "Date not recorded"}</div>
                                    </td>
                                ) : (
                                    <td>
                                        <div style={{ whiteSpace: "nowrap" }}>{formatDueDate(r.expectedDeliveryDate)}</div>
                                        <OverdueBadge days={late} />
                                    </td>
                                )}
                                <td>
                                    <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); onOpen(r); }}>
                                        View
                                    </Button>
                                </td>
                            </tr>
                        );
                    })
                )}
            </tbody>
        </table>
    );
}

function DeletedTable({ rows, loading, onOpen }) {
    return (
        <table className="so-table">
            <thead>
                <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th className="so-num">Amount</th>
                    <th className="so-num">Paid</th>
                    <th>Deleted</th>
                    <th>Reason</th>
                    <th aria-label="Actions" />
                </tr>
            </thead>
            <tbody>
                {loading ? (
                    <SkeletonRows cols={7} />
                ) : (
                    rows.map((r) => (
                        <tr key={r.archiveId} {...rowProps(onOpen, r)}>
                            <td>
                                <div className="so-cell-main so-mono">{r.invoiceId}</div>
                                <div className="so-cell-sub">{formatDate(r.invoiceDate)}</div>
                            </td>
                            <td>
                                <div className="so-cell-main">{r.customerName || "—"}</div>
                                <div className="so-cell-sub">{r.customerPhone}</div>
                            </td>
                            <td className="so-num">{formatMoney(r.totalAmountWithGST)}</td>
                            <td className="so-num">{formatMoney(r.advancePaid)}</td>
                            <td>
                                <div>{formatDateTime(r.deletedAt)}</div>
                                <div className="so-cell-sub">by {r.deletedByName || "—"}</div>
                            </td>
                            <td style={{ maxWidth: 260 }}>
                                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.reason || ""}>
                                    {r.reason || <span style={{ color: "var(--so-muted)" }}>No reason given</span>}
                                </div>
                            </td>
                            <td>
                                <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); onOpen(r); }}>
                                    View
                                </Button>
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
    );
}
