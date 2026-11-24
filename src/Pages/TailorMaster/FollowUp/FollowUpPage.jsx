// Tailors tab: every tailor of the shop as a card (jobs in hand · waiting · stitching · late). Clicking a tailor shows
// the items that tailor is working on (assigned or stitching), soonest delivery first, as cards or a table
// (shop owner table style, 20 per page) with All · Due today · Overdue pills, Track (step timings) and Re-assign. Each item shows how long it has been in its current step and with the tailor.
// URL: ?tailor=<userId>&view=table&due=overdue
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiRefreshCw, FiActivity, FiUserPlus, FiArrowLeft, FiChevronRight } from "react-icons/fi";
import { fetchQueueInvoices, assignTailor } from "../../../utils/workQueue.js";
import { listTailorsWithLoad, ACTIONS } from "../../../api/production.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { toast } from "../../../utils/toast.js";
import { PageHeader, Button, Badge, Segmented, EmptyState, ErrorBox, Skeleton } from "../../shared/components/ui.jsx";
import { ItemStatusBadge } from "../../shared/components/status.jsx";
import { Pagination } from "../../shared/components/form.jsx";
import { formatDate, formatDueDate, formatDateTime, formatDuration, initials } from "../../shared/lib/format.js";
import { jobsOf, tailorJobs, inHand, dueMatches, dueKeyOf, dueOptions, pageOf, PAGE_SIZE, stageLabel, inStatusSince, withTailorSince } from "../../shared/production/desk.js";
import { UrgencyBadge, FilterPills } from "../../shared/production/DeskParts.jsx";
import { TrackStatusModal, AssignTailorModal } from "../../shared/production/Modals.jsx";

const VIEWS = [
    { key: "cards", label: "Cards" },
    { key: "table", label: "Table" },
];

const canAssign = (item) => (item.availableActions || []).includes(ACTIONS.ASSIGN_TAILOR);
const stop = (e) => e.stopPropagation();

/** "In stitching for 1d 4h" + "With tailor since 18 Nov, 4:05 pm (2d 3h)". */
function Timing({ job }) {
    const since = inStatusSince(job.item, job.invoice.invoiceDate);
    const given = withTailorSince(job.item);
    return (
        <div className="tm-timing">
            {since && (
                <span title={`Since ${formatDateTime(since)}`}>
                    {stageLabel(job.item.itemOrderStatus)} for <b>{formatDuration(since, new Date()) || "under a minute"}</b>
                </span>
            )}
            {given && (
                <span title={formatDateTime(given)}>
                    With tailor {formatDuration(given, new Date()) || "under a minute"}
                </span>
            )}
        </div>
    );
}

function TailorCard({ tailor, onOpen }) {
    return (
        <button type="button" className="tm-tailor" onClick={() => onOpen(tailor)}>
            <div className="tm-tailor-head">
                <span className="so-avatar" aria-hidden>{initials(tailor.name)}</span>
                <span className="tm-tailor-name">{tailor.name}</span>
                <FiChevronRight aria-hidden className="tm-tailor-go" />
            </div>
            <div className="tm-tailor-count">
                <b>{inHand(tailor)}</b> <span>job{inHand(tailor) === 1 ? "" : "s"} in hand</span>
            </div>
            <div className="tm-tailor-meta">
                <span>{tailor.assigned ?? 0} waiting</span>
                <span>{tailor.inProgress ?? 0} stitching</span>
                {tailor.late > 0 ? <Badge tone="danger">{tailor.late} late</Badge> : <span>0 late</span>}
            </div>
        </button>
    );
}

export default function FollowUpPage() {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const tailorId = params.get("tailor") || "";
    const view = params.get("view") === "table" ? "table" : "cards";
    const due = dueKeyOf(params.get("due"));
    const [state, setState] = useState({ loading: true, tailors: [], jobs: [], error: "" });
    const [pageNumber, setPageNumber] = useState(0);
    const [track, setTrack] = useState(null); // job
    const [assigning, setAssigning] = useState(null); // {invoice, item}

    const setParam = (changes) => setParams((p) => {
        const next = new URLSearchParams(p);
        Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
        return next;
    });

    const load = useCallback((silent = false) => {
        if (!silent) setState((s) => ({ ...s, loading: true, error: "" }));
        return Promise.all([listTailorsWithLoad(), fetchQueueInvoices(["TAILOR_ASSIGNED", "STITCHING"])])
            .then(([tailors, invoices]) => setState({ loading: false, tailors, jobs: jobsOf(invoices), error: "" }))
            .catch((err) => setState((s) => ({ ...s, loading: false, error: getErrorMessage(err, "Could not load the tailors.") })));
    }, []);
    useEffect(() => {
        load();
    }, [load]);

    const tailor = state.tailors.find((t) => t.userId === tailorId);
    const mine = useMemo(() => tailorJobs(state.jobs, tailorId), [state.jobs, tailorId]);
    const shown = useMemo(() => mine.filter((j) => dueMatches(j.days, due)), [mine, due]);
    const pills = useMemo(() => dueOptions((key) => mine.filter((j) => dueMatches(j.days, key)).length), [mine]);
    const pager = pageOf(shown, pageNumber);
    // Tailors with late work first, then the busiest.
    const tailors = useMemo(() => [...state.tailors].sort((a, b) => (b.late ?? 0) - (a.late ?? 0) || inHand(b) - inHand(a) || a.name.localeCompare(b.name)), [state.tailors]);

    const openTailor = (t) => {
        setPageNumber(0);
        setParam({ tailor: t.userId, due: "" });
    };
    const openOrder = (invoiceId) => navigate(`/tailorMaster/orders/${encodeURIComponent(invoiceId)}`);

    const submitAssign = async (to) => {
        const { invoice, item } = assigning;
        try {
            await assignTailor(invoice.invoiceId, item.itemUniqueId, to.userId);
            toast.success(`#${invoice.invoiceId} (${item.itemName}) re-assigned to ${to.name}`);
            setAssigning(null);
        } catch (err) {
            toast.error("Could not assign the tailor", getErrorMessage(err));
        } finally {
            load(true);
        }
    };

    const actions = (j) => (
        <div className="tm-row-actions">
            <Button variant="ghost" size="sm" onClick={() => setTrack(j)}>
                <FiActivity aria-hidden /> Track
            </Button>
            <Button variant="secondary" size="sm" disabled={!canAssign(j.item)}
                title={canAssign(j.item) ? undefined : "This item can no longer be re-assigned"}
                onClick={() => setAssigning({ invoice: j.invoice, item: j.item })}>
                <FiUserPlus aria-hidden /> Re-assign
            </Button>
        </div>
    );

    const refresh = (
        <Button variant="ghost" size="sm" onClick={() => load()} disabled={state.loading}>
            <FiRefreshCw aria-hidden /> Refresh
        </Button>
    );

    // ------------------------------------------------------------ one tailor's items
    if (tailorId) {
        return (
            <>
                <button type="button" className="so-back" onClick={() => setParam({ tailor: "", due: "", view: "" })}>
                    <FiArrowLeft aria-hidden /> All tailors
                </button>
                <PageHeader
                    eyebrow="Tailors"
                    title={tailor?.name || (state.loading ? "Tailor" : "Tailor not found")}
                    subtitle={tailor ? `${inHand(tailor)} in hand · ${tailor.assigned ?? 0} waiting · ${tailor.inProgress ?? 0} stitching · ${tailor.late ?? 0} late` : ""}
                    actions={refresh}
                />

                {state.error ? (
                    <ErrorBox message={state.error} onRetry={() => load()} />
                ) : state.loading ? (
                    <div className="tm-jobs">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height={160} />)}</div>
                ) : !tailor ? (
                    <EmptyState title="This tailor is not in your shop any more"
                        action={<Button variant="secondary" size="sm" onClick={() => setParam({ tailor: "" })}>See all tailors</Button>} />
                ) : (
                    <>
                        <div className="so-filterbar">
                            <div className="so-toolbar">
                                <FilterPills label="Delivery" options={pills} value={due}
                                    onChange={(k) => { setPageNumber(0); setParam({ due: k === "all" ? "" : k }); }} />
                                <span className="tm-spacer" />
                                <Segmented label="View" options={VIEWS} value={view} onChange={(v) => setParam({ view: v === "cards" ? "" : v })} />
                            </div>
                        </div>

                        {!mine.length ? (
                            <EmptyState title={`${tailor.name} has no work in hand`} message="Assign cut items from Assign tailors." />
                        ) : !shown.length ? (
                            <EmptyState title="No item for this delivery filter" />
                        ) : view === "cards" ? (
                            <div className="tm-jobs">
                                {pager.content.map((j) => (
                                    <article key={j.key} className="tm-job">
                                        <div className="tm-job-top">
                                            <button type="button" className="tm-link so-mono tm-job-inv" onClick={() => openOrder(j.invoice.invoiceId)}>
                                                #{j.invoice.invoiceId}
                                            </button>
                                            <span className="tm-spacer" />
                                            <UrgencyBadge date={j.invoice.expectedDeliveryDate} />
                                        </div>
                                        <div className="tm-job-body">
                                            <div className="tm-job-name">
                                                {j.item.itemName}
                                                {j.item.itemQuantity > 1 && <span className="tm-qty">×{j.item.itemQuantity}</span>}
                                            </div>
                                            <div className="so-cell-sub">{j.invoice.customerName || "Customer"} · ordered {formatDate(j.invoice.invoiceDate)}</div>
                                            <div className="tm-job-badges">
                                                <ItemStatusBadge status={j.item.itemOrderStatus} />
                                            </div>
                                            <Timing job={j} />
                                        </div>
                                        <div className="tm-job-actions">{actions(j)}</div>
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <div className="so-table-wrap">
                                <table className="so-table">
                                    <thead>
                                        <tr>
                                            <th>Invoice</th>
                                            <th>Customer</th>
                                            <th>Garment</th>
                                            <th>Status</th>
                                            <th>Time</th>
                                            <th>Due</th>
                                            <th aria-label="Actions" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pager.content.map((j) => (
                                            <tr key={j.key} className="so-row-link" tabIndex={0} onClick={() => openOrder(j.invoice.invoiceId)}
                                                onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && openOrder(j.invoice.invoiceId)}>
                                                <td>
                                                    <div className="so-cell-main so-mono">{j.invoice.invoiceId}</div>
                                                    <div className="so-cell-sub">{formatDate(j.invoice.invoiceDate)}</div>
                                                </td>
                                                <td><div className="so-cell-main">{j.invoice.customerName || "—"}</div></td>
                                                <td>
                                                    <div className="so-cell-main">{j.item.itemName}</div>
                                                    <div className="so-cell-sub">Qty {j.item.itemQuantity || 1}</div>
                                                </td>
                                                <td><ItemStatusBadge status={j.item.itemOrderStatus} /></td>
                                                <td><Timing job={j} /></td>
                                                <td>
                                                    <div style={{ whiteSpace: "nowrap" }}>{formatDueDate(j.invoice.expectedDeliveryDate)}</div>
                                                    <UrgencyBadge date={j.invoice.expectedDeliveryDate} />
                                                </td>
                                                <td onClick={stop}>{actions(j)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <Pagination page={pager} pageSize={PAGE_SIZE} onChange={setPageNumber} />
                    </>
                )}

                <TrackStatusModal item={track?.item} invoiceId={track?.invoice.invoiceId} customerName={track?.invoice.customerName}
                    invoiceDate={track?.invoice.invoiceDate} onClose={() => setTrack(null)} />
                <AssignTailorModal target={assigning} onClose={() => setAssigning(null)} onSubmit={submitAssign} />
            </>
        );
    }

    // ------------------------------------------------------------ all tailors
    return (
        <>
            <PageHeader
                eyebrow="Tailors"
                title="Tailors"
                subtitle="Every tailor of the shop and the work they have now. Open a tailor to see their items."
                actions={refresh}
            />
            {state.error ? (
                <ErrorBox message={state.error} onRetry={() => load()} />
            ) : state.loading ? (
                <div className="tm-tailors">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height={120} />)}</div>
            ) : !tailors.length ? (
                <EmptyState title="No tailors in this shop" message="Ask the shop owner to add tailor accounts." />
            ) : (
                <div className="tm-tailors">
                    {tailors.map((t) => <TailorCard key={t.userId} tailor={t} onOpen={openTailor} />)}
                </div>
            )}
        </>
    );
}
