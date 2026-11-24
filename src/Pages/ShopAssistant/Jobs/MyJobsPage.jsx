// Shop assistant's My jobs: items assigned to me (SHOP_ASSISTANT_ASSIGNED, HEMMING, IRONING), soonest delivery first.
// Two steps on screen: Start hemming & ironing → Mark completed (a completed item leaves the list). The backend still
// has HEMMING and IRONING; "Mark completed" from HEMMING makes both moves (IRONING, then ORDER_COMPLETED).
// Step pills (All · To start · Hemming & ironing) + due pills (All · Due today · Overdue); job cards or a table
// (shop owner table style), 20 per page; design photo, measurements, track; tick items → move each one step.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiRefreshCw, FiCheckSquare, FiSquare, FiMaximize2, FiActivity, FiPlayCircle, FiCheckCircle } from "react-icons/fi";
import { fetchQueueInvoices, updateItemStatus } from "../../../utils/workQueue.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { toast } from "../../../utils/toast.js";
import { PageHeader, Button, Segmented, EmptyState, ErrorBox, Skeleton, Modal } from "../../shared/components/ui.jsx";
import { ItemStatusBadge } from "../../shared/components/status.jsx";
import { Pagination } from "../../shared/components/form.jsx";
import { formatDate, formatDueDate } from "../../shared/lib/format.js";
import { getUserName } from "../../../utils/authUtils.jsx";
import { jobsOf, byDue, runEach, pageOf, PAGE_SIZE, dueMatches, dueKeyOf, dueOptions } from "../../shared/production/desk.js";
import { JobCard, UrgencyBadge, FilterPills, DesignThumb } from "../../shared/production/DeskParts.jsx";
import { MeasurementsModal, DesignModal, TrackStatusModal } from "../../shared/production/Modals.jsx";

const STATUSES = ["SHOP_ASSISTANT_ASSIGNED", "HEMMING", "IRONING"];

/** The one next step (on screen) of each status: `moves` are the backend status changes it makes, in order. */
const START = { label: "Start hemming & ironing", done: "Hemming & ironing started", icon: <FiPlayCircle aria-hidden /> };
const COMPLETE = { label: "Mark completed", done: "Completed", icon: <FiCheckCircle aria-hidden /> };
const NEXT = {
    SHOP_ASSISTANT_ASSIGNED: { ...START, moves: ["HEMMING"] },
    HEMMING: { ...COMPLETE, moves: ["IRONING", "ORDER_COMPLETED"] },
    IRONING: { ...COMPLETE, moves: ["ORDER_COMPLETED"] },
};
const nextOf = (item) => {
    const n = NEXT[item.itemOrderStatus];
    return n && (item.availableActions || []).includes(n.moves[0]) ? n : null;
};
/** Makes the step's moves one after another (if the second fails, the item stays in hemming & ironing). */
const runMoves = async (invoice, item, n) => {
    for (const to of n.moves) await updateItemStatus(invoice.invoiceId, item.itemUniqueId, to);
};

const STEPS = [
    { key: "all", label: "All" },
    { key: "SHOP_ASSISTANT_ASSIGNED", label: "To start" },
    { key: "HEMMING", label: "Hemming & ironing" },
];
const inStep = (j, key) => key === "all" || j.item.itemOrderStatus === key || (key === "HEMMING" && j.item.itemOrderStatus === "IRONING");

const VIEWS = [
    { key: "cards", label: "Job cards" },
    { key: "table", label: "Table" },
];

export default function MyJobsPage() {
    const [params, setParams] = useSearchParams();
    const step = STEPS.some((s) => s.key === params.get("step")) ? params.get("step") : "all";
    const due = dueKeyOf(params.get("due"));
    const pageNumber = Math.max(0, (Number(params.get("page")) || 1) - 1); // URL is 1-based
    const view = params.get("view") === "table" ? "table" : "cards";

    const [state, setState] = useState({ loading: true, jobs: [], error: "" });
    const [selected, setSelected] = useState(() => new Set());
    const [busy, setBusy] = useState(false);
    const [measure, setMeasure] = useState(null);
    const [design, setDesign] = useState(null);
    const [track, setTrack] = useState(null); // job
    const [confirmMove, setConfirmMove] = useState(false);

    const setParam = (changes) =>
        setParams((p) => {
            const next = new URLSearchParams(p);
            Object.entries(changes).forEach(([k, v]) => (v === "" || v === null || v === undefined ? next.delete(k) : next.set(k, String(v))));
            return next;
        }, { replace: true });

    const load = useCallback((silent = false) => {
        if (!silent) setState((s) => ({ ...s, loading: true, error: "" }));
        return fetchQueueInvoices(STATUSES)
            .then((invoices) => setState({ loading: false, jobs: byDue(jobsOf(invoices, (item) => STATUSES.includes(item.itemOrderStatus))), error: "" }))
            .catch((err) => setState((s) => ({ loading: false, jobs: silent ? s.jobs : [], error: getErrorMessage(err, "Could not load your jobs.") })));
    }, []);
    useEffect(() => {
        load();
    }, [load]);

    const byStep = useMemo(() => state.jobs.filter((j) => inStep(j, step)), [state.jobs, step]);
    const rows = useMemo(() => byStep.filter((j) => dueMatches(j.days, due)), [byStep, due]);
    const stepPills = useMemo(() => STEPS.map((s) => ({ ...s, count: state.jobs.filter((j) => inStep(j, s.key)).length })), [state.jobs]);
    const duePills = useMemo(() => dueOptions((key) => byStep.filter((j) => dueMatches(j.days, key)).length), [byStep]);
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
    const selectedJobs = state.jobs.filter((j) => selected.has(j.key) && nextOf(j.item));

    // ---- actions
    const move = async (invoice, item) => {
        const n = nextOf(item);
        if (!n) return;
        setBusy(true);
        try {
            await runMoves(invoice, item, n);
            toast.success(`${n.done}: ${item.itemName} (#${invoice.invoiceId})`);
        } catch (err) {
            toast.error(`Could not ${n.label.toLowerCase()}`, getErrorMessage(err));
        } finally {
            setBusy(false);
            load(true);
        }
    };
    const moveSelected = async () => {
        setConfirmMove(false);
        setBusy(true);
        const { done, failed } = await runEach(selectedJobs, ({ invoice, item }) => runMoves(invoice, item, nextOf(item)));
        setBusy(false);
        if (done) toast.success(`${done} item${done === 1 ? "" : "s"} moved to the next step`);
        if (failed.length) {
            toast.error(`${failed.length} item${failed.length === 1 ? "" : "s"} could not be moved`,
                failed.map((f) => `#${f.job.invoice.invoiceId} ${f.job.item.itemName}: ${getErrorMessage(f.error)}`).join("\n"));
        }
        setSelected(new Set());
        load(true);
    };
    const actionOf = (item) => {
        const n = nextOf(item);
        return n ? { label: n.label, icon: n.icon, onClick: move } : null;
    };

    return (
        <>
            <PageHeader
                eyebrow="My jobs"
                title={`Welcome back, ${getUserName() || "Shop assistant"}`}
                subtitle={`${rows.length} item${rows.length === 1 ? "" : "s"} · soonest delivery first · completed items leave this list`}
                actions={
                    <div className="so-actions">
                        <Button variant="ghost" size="sm" onClick={() => load()} disabled={state.loading}>
                            <FiRefreshCw aria-hidden /> Refresh
                        </Button>
                        <Button size="sm" disabled={busy || !selectedJobs.length} onClick={() => setConfirmMove(true)}
                            title={selectedJobs.length ? undefined : "Tick the items to move to their next step"}>
                            <FiPlayCircle aria-hidden /> Next step ({selectedJobs.length})
                        </Button>
                    </div>
                }
            />

            <div className="so-filterbar">
                <FilterPills label="Step" options={stepPills} value={step} onChange={(k) => setParam({ step: k === "all" ? "" : k, page: "" })} />
                <div className="so-toolbar" style={{ marginTop: 10 }}>
                    <FilterPills label="Delivery" options={duePills} value={due} onChange={(k) => setParam({ due: k === "all" ? "" : k, page: "" })} />
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
            ) : !state.jobs.length ? (
                <EmptyState title="No jobs right now" message="Items show up here when a tailor hands them over to you." />
            ) : rows.length === 0 ? (
                <EmptyState title="Nothing for this filter" message="Try another step or delivery filter." />
            ) : view === "cards" ? (
                <div className="tm-jobs">
                    {pageRows.map((j) => (
                        <JobCard key={j.key} invoice={j.invoice} item={j.item} checked={selected.has(j.key)} busy={busy}
                            onToggle={() => toggle(j.key)} onMeasurements={setMeasure} onDesign={setDesign}
                            onTrack={() => setTrack(j)} action={actionOf(j.item)} />
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
                                <th>Step</th>
                                <th>Due</th>
                                <th aria-label="Actions" />
                            </tr>
                        </thead>
                        <tbody>
                            {pageRows.map(({ key, invoice: inv, item }) => {
                                const n = nextOf(item);
                                return (
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
                                        <td><ItemStatusBadge status={item.itemOrderStatus} /></td>
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
                                                {n && (
                                                    <Button size="sm" disabled={busy} onClick={() => move(inv, item)}>
                                                        {n.icon} {n.label}
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {!state.loading && <Pagination page={pager} pageSize={PAGE_SIZE} onChange={(n) => setParam({ page: n > 0 ? n + 1 : "" })} />}

            <MeasurementsModal item={measure} onClose={() => setMeasure(null)} />
            <DesignModal item={design} onClose={() => setDesign(null)} />
            <TrackStatusModal item={track?.item} invoiceId={track?.invoice.invoiceId} customerName={track?.invoice.customerName}
                invoiceDate={track?.invoice.invoiceDate} onClose={() => setTrack(null)} />
            <Modal open={confirmMove} title="Move the selected items to their next step?" onClose={() => setConfirmMove(false)}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setConfirmMove(false)}>Cancel</Button>
                        <Button onClick={moveSelected}><FiPlayCircle aria-hidden /> Move {selectedJobs.length}</Button>
                    </>
                }>
                <p style={{ marginTop: 0 }}>Each item moves one step. Completed items leave your list.</p>
                <ul className="tm-confirm-list">
                    {selectedJobs.map(({ key, invoice, item }) => (
                        <li key={key}>
                            <span className="so-mono">#{invoice.invoiceId}</span> {item.itemName}
                            <span className="so-cell-sub"> · {nextOf(item).label}</span>
                        </li>
                    ))}
                </ul>
            </Modal>
        </>
    );
}
