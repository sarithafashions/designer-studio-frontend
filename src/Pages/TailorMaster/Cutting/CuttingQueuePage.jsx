// Cutting production queue (the old "My orders", new UI): items not cut yet (ORDER_ACCEPTED), without the
// garments that need no cutting, soonest delivery first — instant due-date pills (All · Overdue · Due today ·
// Tomorrow · This week, with counts); job cards or a table (one row per item).
// Mark cut (one or every ticked item at once; ticks are per item) · design photo thumbnails · measurements · print cutting sheets · Excel export.
// Filters live in the URL.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { FiDownload, FiRefreshCw, FiScissors, FiCheckSquare, FiSquare, FiMaximize2, FiPrinter } from "react-icons/fi";
import { fetchQueueInvoices, updateItemStatus } from "../../../utils/workQueue.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { toast } from "../../../utils/toast.js";
import { PageHeader, Button, Segmented, EmptyState, ErrorBox, Skeleton, Modal } from "../../shared/components/ui.jsx";
import { formatDate, formatDueDate } from "../../shared/lib/format.js";
import { Pagination } from "../../shared/components/form.jsx";
import { todayIST } from "../../shared/lib/period.js";
import { cuttingItems, exportRows, runEach, pageOf, PAGE_SIZE, daysUntil, dueMatches, dueKeyOf, dueOptions, DUE_FILTERS } from "../../shared/production/desk.js";
import { JobCard, UrgencyBadge, FilterPills, DesignThumb } from "../../shared/production/DeskParts.jsx";
import { MeasurementsModal, DesignModal } from "../../shared/production/Modals.jsx";
import CuttingSheet from "../components/CuttingSheet.jsx";

const VIEWS = [
    { key: "cards", label: "Job cards" },
    { key: "table", label: "Table" },
];

// Like the shop owner tables: the row opens the order (click or Enter); inner buttons stop propagation.
const openOrder = (navigate, inv) => navigate(`/tailorMaster/orders/${encodeURIComponent(inv.invoiceId)}`);
const rowProps = (navigate, inv) => ({
    className: "so-row-link",
    tabIndex: 0,
    onClick: () => openOrder(navigate, inv),
    onKeyDown: (e) => e.key === "Enter" && e.target === e.currentTarget && openOrder(navigate, inv),
});

export default function CuttingQueuePage() {
    const [params, setParams] = useSearchParams();
    const due = dueKeyOf(params.get("due"));
    const navigate = useNavigate();
    const pageNumber = Math.max(0, (Number(params.get("page")) || 1) - 1); // URL is 1-based
    const view = params.get("view") === "table" ? "table" : "cards";

    const [state, setState] = useState({ loading: true, invoices: [], error: "" });
    const [selected, setSelected] = useState(() => new Set());
    const [busy, setBusy] = useState(false);
    const [measure, setMeasure] = useState(null);
    const [design, setDesign] = useState(null);
    const [confirmCut, setConfirmCut] = useState(false);
    const [printing, setPrinting] = useState(null); // [{invoice, item}]

    const setParam = (changes) =>
        setParams((p) => {
            const next = new URLSearchParams(p);
            Object.entries(changes).forEach(([k, v]) => (v === "" || v === null || v === undefined ? next.delete(k) : next.set(k, String(v))));
            return next;
        }, { replace: true });

    const load = useCallback((silent = false) => {
        if (!silent) setState((s) => ({ ...s, loading: true, error: "" }));
        return fetchQueueInvoices(["ORDER_ACCEPTED"])
            .then((invoices) => setState({ loading: false, invoices, error: "" }))
            .catch((err) => setState((s) => ({ loading: false, invoices: silent ? s.invoices : [], error: getErrorMessage(err, "Could not fetch the cutting queue.") })));
    }, []);
    useEffect(() => {
        load();
    }, [load]);

    // One row per item to cut (job = {key, invoice, item, days}), soonest delivery first (no date last).
    // Selection, paging and every count are per item.
    const all = useMemo(() => {
        const today = todayIST();
        return state.invoices
            .flatMap((inv) => {
                const days = daysUntil(inv.expectedDeliveryDate, today);
                return cuttingItems(inv).map((item) => ({ key: `${inv.invoiceId}|${item.itemUniqueId}`, invoice: inv, item, days }));
            })
            .sort((a, b) => (a.days ?? Infinity) - (b.days ?? Infinity));
    }, [state.invoices]);
    const rows = useMemo(() => all.filter((j) => dueMatches(j.days, due)), [all, due]);
    const pills = useMemo(() => dueOptions((key) => all.filter((j) => dueMatches(j.days, key)).length), [all]);
    const pager = pageOf(rows, pageNumber);
    const pageRows = pager.content;

    const toggle = (job) => setSelected((s) => {
        const next = new Set(s);
        if (next.has(job.key)) next.delete(job.key);
        else next.add(job.key);
        return next;
    });
    const allOnPage = pageRows.length > 0 && pageRows.every((j) => selected.has(j.key));
    const toggleAll = () => setSelected((s) => {
        const next = new Set(s);
        pageRows.forEach((j) => (allOnPage ? next.delete(j.key) : next.add(j.key)));
        return next;
    });
    // Selected items still in the queue (any page / filter).
    const selectedJobs = all.filter((j) => selected.has(j.key));
    const orderCount = new Set(selectedJobs.map((j) => j.invoice.invoiceId)).size;
    const printSelected = () => {
        if (!selectedJobs.length) {
            toast.warning("Please select at least one item to print.");
            return;
        }
        setPrinting(selectedJobs);
    };
    const markSelectedCut = async () => {
        setConfirmCut(false);
        setBusy(true);
        const { done, failed } = await runEach(selectedJobs, ({ invoice, item }) => updateItemStatus(invoice.invoiceId, item.itemUniqueId, "CUTTING"));
        setBusy(false);
        if (done) toast.success(`${done} item${done === 1 ? "" : "s"} marked as cutting`);
        if (failed.length) {
            toast.error(`${failed.length} item${failed.length === 1 ? "" : "s"} could not be updated`,
                failed.map((f) => `#${f.job.invoice.invoiceId} ${f.job.item.itemName}: ${getErrorMessage(f.error)}`).join("\n"));
        }
        setSelected(new Set());
        load(true);
    };
    const exportSelected = () => {
        if (!selectedJobs.length) {
            toast.warning("Please select at least one item to export.");
            return;
        }
        // exportRows works per invoice: group the selected items back under their invoice.
        const byInvoice = new Map();
        selectedJobs.forEach(({ invoice, item }) => {
            if (!byInvoice.has(invoice.invoiceId)) byInvoice.set(invoice.invoiceId, { ...invoice, items: [] });
            byInvoice.get(invoice.invoiceId).items.push(item);
        });
        const sheet = XLSX.utils.json_to_sheet(exportRows([...byInvoice.values()], (inv) => inv.items, false));
        const book = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(book, sheet, "CuttingOrders");
        XLSX.writeFile(book, `Cutting_Orders_${new Date().toISOString().slice(0, 10)}.xlsx`);
        toast.success(`${selectedJobs.length} item(s) exported to Excel.`);
        setSelected(new Set());
    };

    const markCut = async (inv, item) => {
        setBusy(true);
        try {
            await updateItemStatus(inv.invoiceId, item.itemUniqueId, "CUTTING");
            toast.success(`Marked #${inv.invoiceId} (${item.itemName}) as cutting`);
        } catch (err) {
            toast.error("Failed to update the cutting status", getErrorMessage(err));
        } finally {
            setBusy(false);
            load(true);
        }
    };

    return (
        <>
            <PageHeader
                eyebrow="Cutting"
                title="Cutting production queue"
                subtitle={`${rows.length} item${rows.length === 1 ? "" : "s"} to cut · ${DUE_FILTERS.find((f) => f.key === due).label.toLowerCase()} · soonest delivery first`}
                actions={
                    <div className="so-actions">
                        <Button variant="ghost" size="sm" onClick={() => load()} disabled={state.loading}>
                            <FiRefreshCw aria-hidden /> Refresh
                        </Button>
                        <Button variant="secondary" size="sm" onClick={exportSelected}>
                            <FiDownload aria-hidden /> Export ({selectedJobs.length})
                        </Button>
                        <Button variant="secondary" size="sm" onClick={printSelected}>
                            <FiPrinter aria-hidden /> Print sheets ({selectedJobs.length})
                        </Button>
                        <Button size="sm" disabled={busy || !selectedJobs.length} onClick={() => setConfirmCut(true)}
                            title={selectedJobs.length ? undefined : "Tick the items to mark as cut"}>
                            <FiScissors aria-hidden /> Mark cut ({selectedJobs.length})
                        </Button>
                    </div>
                }
            />

            <div className="so-filterbar">
                <div className="so-toolbar">
                    <FilterPills label="Delivery" options={pills} value={due} onChange={(k) => setParam({ due: k === "all" ? "" : k, page: "" })} />
                    <span className="tm-spacer" />
                    {!state.loading && pageRows.length > 0 && (
                        <button type="button" className="tm-selectall" onClick={toggleAll} aria-pressed={allOnPage}>
                            {allOnPage ? <FiCheckSquare aria-hidden /> : <FiSquare aria-hidden />}
                            {allOnPage ? "Clear this page" : "Select this page"}
                        </button>
                    )}
                    <Segmented label="View" options={VIEWS} value={view} onChange={(v) => setParam({ view: v === "cards" ? "" : v })} />
                </div>
            </div>

            {state.error ? (
                <ErrorBox message={state.error} onRetry={() => load()} />
            ) : state.loading ? (
                <div className="tm-jobs">
                    {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height={170} />)}
                </div>
            ) : rows.length === 0 ? (
                <EmptyState title="No cutting tasks in the queue" message={due === "all" ? "Everything has been cut." : "Nothing to cut for this delivery filter."} />
            ) : view === "cards" ? (
                <div className="tm-jobs">
                    {pageRows.map((j) => (
                        <JobCard key={j.key} invoice={j.invoice} item={j.item} checked={selected.has(j.key)}
                            busy={busy} onToggle={() => toggle(j)} onMeasurements={setMeasure} onDesign={setDesign} onMarkCut={markCut} />
                    ))}
                </div>
            ) : (
                <div className="so-table-wrap">
                    <table className="so-table">
                        <thead>
                            <tr>
                                <th style={{ width: 36 }}>
                                    <button type="button" className="tm-check" onClick={toggleAll} aria-label="Select all on this page" aria-pressed={allOnPage}>
                                        {allOnPage ? <FiCheckSquare /> : <FiSquare />}
                                    </button>
                                </th>
                                <th>Invoice</th>
                                <th>Customer</th>
                                <th>Garment</th>
                                <th>Due</th>
                                <th aria-label="Actions" />
                            </tr>
                        </thead>
                        <tbody>
                            {pageRows.map(({ key, invoice: inv, item }) => (
                                <tr key={key} {...rowProps(navigate, inv)}>
                                    <td>
                                        <button type="button" className="tm-check" onClick={(e) => { e.stopPropagation(); toggle({ key }); }} aria-pressed={selected.has(key)}
                                            aria-label={`Select ${item.itemName} of ${inv.invoiceId}`}>
                                            {selected.has(key) ? <FiCheckSquare /> : <FiSquare />}
                                        </button>
                                    </td>
                                    <td>
                                        <div className="so-cell-main so-mono">{inv.invoiceId}</div>
                                        <div className="so-cell-sub">{formatDate(inv.invoiceDate)}</div>
                                    </td>
                                    <td><div className="so-cell-main">{inv.customerName || "—"}</div></td>
                                    <td>
                                        <div className="tm-cell-thumb">
                                            <DesignThumb item={item} onOpen={setDesign} size={44} />
                                            <div>
                                                <div className="so-cell-main">{item.itemName}</div>
                                                <div className="so-cell-sub">Qty {item.itemQuantity || 1}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ whiteSpace: "nowrap" }}>{formatDueDate(inv.expectedDeliveryDate)}</div>
                                        <UrgencyBadge date={inv.expectedDeliveryDate} />
                                    </td>
                                    <td>
                                        <div className="tm-row-actions">
                                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setMeasure(item); }}>
                                                <FiMaximize2 aria-hidden /> Measurements
                                            </Button>
                                            <Button size="sm" disabled={busy} onClick={(e) => { e.stopPropagation(); markCut(inv, item); }}>
                                                <FiScissors aria-hidden /> Mark cut
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {!state.loading && <Pagination page={pager} pageSize={PAGE_SIZE} onChange={(n) => setParam({ page: n > 0 ? n + 1 : "" })} />}

            <MeasurementsModal item={measure} onClose={() => setMeasure(null)} />
            <DesignModal item={design} onClose={() => setDesign(null)} />
            <Modal open={confirmCut} title="Mark the selected items as cut?" onClose={() => setConfirmCut(false)}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setConfirmCut(false)}>Cancel</Button>
                        <Button onClick={markSelectedCut}><FiScissors aria-hidden /> Mark {selectedJobs.length} as cut</Button>
                    </>
                }>
                <p style={{ marginTop: 0 }}>
                    {selectedJobs.length} item{selectedJobs.length === 1 ? "" : "s"} from {orderCount} order{orderCount === 1 ? "" : "s"} move to
                    {" "}<b>Cutting</b> and then wait for a tailor.
                </p>
                <ul className="tm-confirm-list">
                    {selectedJobs.map(({ invoice, item }) => (
                        <li key={`${invoice.invoiceId}-${item.itemUniqueId}`}>
                            <span className="so-mono">#{invoice.invoiceId}</span> {item.itemName}{item.itemQuantity > 1 ? ` ×${item.itemQuantity}` : ""}
                            <span className="so-cell-sub"> · {invoice.customerName || "Customer"}</span>
                        </li>
                    ))}
                </ul>
            </Modal>
            {printing && <CuttingSheet jobs={printing} onDone={() => setPrinting(null)} />}
        </>
    );
}
