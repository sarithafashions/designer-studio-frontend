// Tailor's New jobs: items assigned to me and not started yet (TAILOR_ASSIGNED), soonest delivery first.
// Design photo, measurements, track; Start stitching for one item or every ticked item; Excel export.
// All · Due today · Overdue pills, job cards or a table (shop owner table style), 20 per page. Filters live in the URL.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { FiDownload, FiRefreshCw, FiCheckSquare, FiSquare, FiMaximize2, FiActivity, FiPlayCircle } from "react-icons/fi";
import { fetchQueueInvoices, updateItemStatus } from "../../../utils/workQueue.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { toast } from "../../../utils/toast.js";
import { PageHeader, Button, Segmented, EmptyState, ErrorBox, Skeleton, Modal } from "../../shared/components/ui.jsx";
import { Pagination } from "../../shared/components/form.jsx";
import { formatDate, formatDueDate } from "../../shared/lib/format.js";
import { getUserName } from "../../../utils/authUtils.jsx";
import { jobsOf, byDue, exportRows, runEach, pageOf, PAGE_SIZE, dueMatches, dueKeyOf, dueOptions, DUE_FILTERS } from "../../shared/production/desk.js";
import { JobCard, UrgencyBadge, FilterPills, DesignThumb } from "../../shared/production/DeskParts.jsx";
import { MeasurementsModal, DesignModal, TrackStatusModal } from "../../shared/production/Modals.jsx";

const VIEWS = [
    { key: "cards", label: "Job cards" },
    { key: "table", label: "Table" },
];
const canStart = (item) => (item.availableActions || []).includes("STITCHING");

export default function WorkQueuePage() {
    const [params, setParams] = useSearchParams();
    const due = dueKeyOf(params.get("due"));
    const pageNumber = Math.max(0, (Number(params.get("page")) || 1) - 1); // URL is 1-based
    const view = params.get("view") === "table" ? "table" : "cards";

    const [state, setState] = useState({ loading: true, jobs: [], error: "" });
    const [selected, setSelected] = useState(() => new Set());
    const [busy, setBusy] = useState(false);
    const [measure, setMeasure] = useState(null);
    const [design, setDesign] = useState(null);
    const [track, setTrack] = useState(null); // job
    const [confirmStart, setConfirmStart] = useState(false);

    const setParam = (changes) =>
        setParams((p) => {
            const next = new URLSearchParams(p);
            Object.entries(changes).forEach(([k, v]) => (v === "" || v === null || v === undefined ? next.delete(k) : next.set(k, String(v))));
            return next;
        }, { replace: true });

    const load = useCallback((silent = false) => {
        if (!silent) setState((s) => ({ ...s, loading: true, error: "" }));
        return fetchQueueInvoices(["TAILOR_ASSIGNED"])
            .then((invoices) => setState({ loading: false, jobs: byDue(jobsOf(invoices, (item) => item.itemOrderStatus === "TAILOR_ASSIGNED")), error: "" }))
            .catch((err) => setState((s) => ({ loading: false, jobs: silent ? s.jobs : [], error: getErrorMessage(err, "Could not load your new jobs.") })));
    }, []);
    useEffect(() => {
        load();
    }, [load]);

    const rows = useMemo(() => state.jobs.filter((j) => dueMatches(j.days, due)), [state.jobs, due]);
    const pills = useMemo(() => dueOptions((key) => state.jobs.filter((j) => dueMatches(j.days, key)).length), [state.jobs]);
    const pager = pageOf(rows, pageNumber);
    const pageRows = pager.content;

    // ---- selection (per item)
    const toggle = (key) => setSelected((s) => {
        const next = new Set(s);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
    });
    const allOnPage = pageRows.length > 0 && pageRows.every((j) => selected.has(j.key));
    const toggleAll = () => setSelected((s) => {
        const next = new Set(s);
        pageRows.forEach((j) => (allOnPage ? next.delete(j.key) : next.add(j.key)));
        return next;
    });
    const selectedJobs = state.jobs.filter((j) => selected.has(j.key));

    // ---- actions
    const start = async (invoice, item) => {
        setBusy(true);
        try {
            await updateItemStatus(invoice.invoiceId, item.itemUniqueId, "STITCHING");
            toast.success(`Stitching started: ${item.itemName} (#${invoice.invoiceId})`);
        } catch (err) {
            toast.error("Could not start stitching", getErrorMessage(err));
        } finally {
            setBusy(false);
            load(true);
        }
    };
    const startSelected = async () => {
        setConfirmStart(false);
        setBusy(true);
        const { done, failed } = await runEach(selectedJobs, ({ invoice, item }) => updateItemStatus(invoice.invoiceId, item.itemUniqueId, "STITCHING"));
        setBusy(false);
        if (done) toast.success(`Stitching started for ${done} item${done === 1 ? "" : "s"}`);
        if (failed.length) {
            toast.error(`${failed.length} item${failed.length === 1 ? "" : "s"} could not be started`,
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
        const byInvoice = new Map();
        selectedJobs.forEach(({ invoice, item }) => {
            if (!byInvoice.has(invoice.invoiceId)) byInvoice.set(invoice.invoiceId, { ...invoice, items: [] });
            byInvoice.get(invoice.invoiceId).items.push(item);
        });
        const sheet = XLSX.utils.json_to_sheet(exportRows([...byInvoice.values()], (inv) => inv.items, false));
        const book = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(book, sheet, "TailorOrders");
        XLSX.writeFile(book, `Tailor_Orders_${new Date().toISOString().slice(0, 10)}.xlsx`);
        toast.success(`${selectedJobs.length} item(s) exported to Excel.`);
        setSelected(new Set());
    };
    const startAction = { label: "Start stitching", icon: <FiPlayCircle aria-hidden />, onClick: start };

    return (
        <>
            <PageHeader
                eyebrow="New jobs"
                title={`Welcome back, ${getUserName() || "Tailor"}`}
                subtitle={`${rows.length} item${rows.length === 1 ? "" : "s"} to stitch · ${DUE_FILTERS.find((f) => f.key === due).label.toLowerCase()} · soonest delivery first`}
                actions={
                    <div className="so-actions">
                        <Button variant="ghost" size="sm" onClick={() => load()} disabled={state.loading}>
                            <FiRefreshCw aria-hidden /> Refresh
                        </Button>
                        <Button variant="secondary" size="sm" onClick={exportSelected}>
                            <FiDownload aria-hidden /> Export ({selectedJobs.length})
                        </Button>
                        <Button size="sm" disabled={busy || !selectedJobs.length} onClick={() => setConfirmStart(true)}
                            title={selectedJobs.length ? undefined : "Tick the items to start"}>
                            <FiPlayCircle aria-hidden /> Start stitching ({selectedJobs.length})
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
                <div className="tm-jobs">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height={190} />)}</div>
            ) : rows.length === 0 ? (
                <EmptyState title={due === "all" ? "No new work" : "Nothing for this delivery filter"}
                    message={due === "all" ? "Items show up here when the tailor master assigns them to you. Items you started are on the Stitching tab." : "Try another delivery filter."} />
            ) : view === "cards" ? (
                <div className="tm-jobs">
                    {pageRows.map((j) => (
                        <JobCard key={j.key} invoice={j.invoice} item={j.item} checked={selected.has(j.key)} busy={busy || !canStart(j.item)}
                            onToggle={() => toggle(j.key)} onMeasurements={setMeasure} onDesign={setDesign}
                            onTrack={() => setTrack(j)} action={startAction} />
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
                                <tr key={key}>
                                    <td>
                                        <button type="button" className="tm-check" onClick={() => toggle(key)} aria-pressed={selected.has(key)}
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
                                            <Button variant="ghost" size="sm" onClick={() => setMeasure(item)}>
                                                <FiMaximize2 aria-hidden /> Measurements
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => setTrack({ invoice: inv, item })}>
                                                <FiActivity aria-hidden /> Track
                                            </Button>
                                            <Button size="sm" disabled={busy || !canStart(item)} onClick={() => start(inv, item)}>
                                                <FiPlayCircle aria-hidden /> Start stitching
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
            <TrackStatusModal item={track?.item} invoiceId={track?.invoice.invoiceId} customerName={track?.invoice.customerName}
                invoiceDate={track?.invoice.invoiceDate} onClose={() => setTrack(null)} />
            <Modal open={confirmStart} title="Start stitching the selected items?" onClose={() => setConfirmStart(false)}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setConfirmStart(false)}>Cancel</Button>
                        <Button onClick={startSelected}><FiPlayCircle aria-hidden /> Start {selectedJobs.length}</Button>
                    </>
                }>
                <p style={{ marginTop: 0 }}>
                    {selectedJobs.length} item{selectedJobs.length === 1 ? "" : "s"} move to <b>Stitching</b> and then show on your Stitching tab.
                </p>
                <ul className="tm-confirm-list">
                    {selectedJobs.map(({ key, invoice, item }) => (
                        <li key={key}>
                            <span className="so-mono">#{invoice.invoiceId}</span> {item.itemName}{item.itemQuantity > 1 ? ` ×${item.itemQuantity}` : ""}
                            <span className="so-cell-sub"> · {invoice.customerName || "Customer"}</span>
                        </li>
                    ))}
                </ul>
            </Modal>
        </>
    );
}
