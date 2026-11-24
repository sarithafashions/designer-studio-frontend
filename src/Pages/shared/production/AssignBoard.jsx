// Assign board (shared by the tailor master and the tailor): items waiting for a person, soonest delivery first, as
// cards or a table, with instant due-date pills; on each item a plain dropdown (names only) + Assign. A "Workload"
// strip of pills shows the jobs each person has. Table like the shop owner tables (two-line cells, 20 per page;
// the row opens the order when `orderPath` is given). View and due filter live in the URL (?view=table&due=overdue).
//
// config:
//   statuses        queue statuses to load, e.g. ["CUTTING"]
//   keep(item)      which items wait for an assignment
//   loadPeople()    -> [{userId, name, assigned, inProgress, late}]
//   assign(invoiceId, itemUniqueId, userId)
//   noun            "tailor" | "shop assistant";  workWord: what inProgress means ("stitching", "hemming / ironing")
//   title, eyebrow (default "Assign board" / "Assign"), subtitle, emptyTitle, emptyMessage, emptyAction {label, to}, orderPath(invoiceId) (optional)
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiSearch, FiRefreshCw, FiUserPlus, FiMaximize2 } from "react-icons/fi";
import { fetchQueueInvoices } from "../../../utils/workQueue.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { toast } from "../../../utils/toast.js";
import { PageHeader, Button, Segmented, EmptyState, ErrorBox, Skeleton } from "../components/ui.jsx";
import { formatDate, formatDueDate } from "../lib/format.js";
import { Pagination } from "../components/form.jsx";
import { jobsOf, byDue, jobMatches, inHand, pageOf, PAGE_SIZE, dueMatches, dueKeyOf, dueOptions } from "./desk.js";
import { UrgencyBadge, FilterPills, DesignThumb } from "./DeskParts.jsx";
import { MeasurementsModal, DesignModal } from "./Modals.jsx";

const VIEWS = [
    { key: "cards", label: "Cards" },
    { key: "table", label: "Table" },
];

/** Workload as pills: "Ravi 5", red count when the person has late items (hover: waiting / working / late). */
function WorkloadPills({ tailors, workWord }) {
    if (!tailors.length) return null;
    return (
        <div className="tm-wl-strip" aria-label="Workload (jobs in hand)">
            <span className="tm-wl-label">Workload</span>
            {tailors.map((t) => (
                <span key={t.userId} className={`tm-wl-pill ${t.late > 0 ? "late" : ""}`}
                    title={`${t.name}: ${t.assigned ?? 0} waiting · ${t.inProgress ?? 0} ${workWord} · ${t.late ?? 0} late`}>
                    {t.name}
                    <span className="tm-pill-count">{inHand(t)}</span>
                </span>
            ))}
        </div>
    );
}

const stop = (e) => e.stopPropagation();

export default function AssignBoard({ title = "Assign board", eyebrow = "Assign", statuses, keep, loadPeople, assign: assignTo, noun, workWord, subtitle,
    emptyTitle, emptyMessage, emptyAction, orderPath }) {
    const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const view = params.get("view") === "table" ? "table" : "cards";
    const due = dueKeyOf(params.get("due"));
    const setParam = (key, value) => setParams((p) => {
        const next = new URLSearchParams(p);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
    }, { replace: true });
    const [state, setState] = useState({ loading: true, jobs: [], tailors: [], error: "" });
    const [search, setSearch] = useState("");
    const [choice, setChoice] = useState({}); // job key -> tailor userId
    const [busyKey, setBusyKey] = useState("");
    const [measure, setMeasure] = useState(null);
    const [design, setDesign] = useState(null);
    const [pageNumber, setPageNumber] = useState(0);

    const load = useCallback((silent = false) => {
        if (!silent) setState((s) => ({ ...s, loading: true, error: "" }));
        return Promise.all([fetchQueueInvoices(statuses), loadPeople()])
            .then(([invoices, tailors]) => {
                const jobs = byDue(jobsOf(invoices, keep));
                setState({ loading: false, jobs, tailors, error: "" });
            })
            .catch((err) => setState((s) => ({ ...s, loading: false, error: getErrorMessage(err, "Could not load the assign board.") })));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        load();
    }, [load]);

    const visible = useMemo(() => state.jobs.filter((j) => dueMatches(j.days, due) && jobMatches(j, search)), [state.jobs, due, search]);
    const pager = pageOf(visible, pageNumber);
    const pills = useMemo(() => dueOptions((key) => state.jobs.filter((j) => dueMatches(j.days, key)).length), [state.jobs]);

    const assign = async (job) => {
        const tailor = state.tailors.find((t) => t.userId === choice[job.key]);
        if (!tailor) {
            toast.warning(`Please choose a ${noun} first.`);
            return;
        }
        setBusyKey(job.key);
        try {
            await assignTo(job.invoice.invoiceId, job.item.itemUniqueId, tailor.userId);
            toast.success(`${job.item.itemName} (#${job.invoice.invoiceId}) assigned to ${tailor.name}`);
            setChoice((c) => {
                const next = { ...c };
                delete next[job.key];
                return next;
            });
        } catch (err) {
            toast.error(`Could not assign the ${noun}`, getErrorMessage(err));
        } finally {
            setBusyKey("");
            load(true);
        }
    };

    const picker = (j) => (
        <select className={`tm-tailor-select ${choice[j.key] ? "" : "empty"}`} value={choice[j.key] || ""} disabled={busyKey === j.key}
            aria-label={`${Noun} for ${j.item.itemName} of ${j.invoice.invoiceId}`}
            onChange={(e) => setChoice((c) => ({ ...c, [j.key]: e.target.value }))}>
            <option value="">Choose {noun}…</option>
            {state.tailors.map((t) => <option key={t.userId} value={t.userId}>{t.name}</option>)}
        </select>
    );
    const assignButton = (j) => (
        <Button size="sm" disabled={!choice[j.key] || !!busyKey} onClick={() => assign(j)}>
            <FiUserPlus aria-hidden /> {busyKey === j.key ? "Assigning…" : "Assign"}
        </Button>
    );

    return (
        <>
            <PageHeader
                eyebrow={eyebrow}
                title={title}
                subtitle={subtitle}
                actions={
                    <Button variant="ghost" size="sm" onClick={() => load()} disabled={state.loading}>
                        <FiRefreshCw aria-hidden /> Refresh
                    </Button>
                }
            />

            {state.error ? (
                <ErrorBox message={state.error} onRetry={() => load()} />
            ) : (
                <div>
                    {!state.loading && <WorkloadPills tailors={state.tailors} workWord={workWord} />}

                    <div>
                        <div className="so-filterbar">
                            <FilterPills label="Delivery" options={pills} value={due} onChange={(k) => { setParam("due", k === "all" ? "" : k); setPageNumber(0); }} />
                            <div className="so-toolbar" style={{ marginTop: 10 }}>
                                <div className="so-search tm-board-search">
                                    <FiSearch aria-hidden />
                                    <input className="so-input" type="search" placeholder="Search invoice, customer or item" aria-label="Search waiting items"
                                        value={search} onChange={(e) => { setSearch(e.target.value); setPageNumber(0); }} />
                                </div>
                                <span className="so-cell-sub">{state.loading ? "" : `${state.jobs.length} item${state.jobs.length === 1 ? "" : "s"} waiting`}</span>
                                <span className="tm-spacer" />
                                <Segmented label="View" options={VIEWS} value={view} onChange={(v) => setParam("view", v === "cards" ? "" : v)} />
                            </div>
                        </div>

                        {state.loading ? (
                            <div className="tm-jobs">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height={170} />)}</div>
                        ) : !state.tailors.length ? (
                            <EmptyState title={`No ${noun}s in this shop`} message={`Ask the shop owner to add ${noun} accounts.`} />
                        ) : !state.jobs.length ? (
                            <EmptyState title={emptyTitle} message={emptyMessage}
                                action={emptyAction && <Button variant="secondary" size="sm" onClick={() => navigate(emptyAction.to)}>{emptyAction.label}</Button>} />
                        ) : !visible.length ? (
                            <EmptyState title="No waiting item matches this filter" message={search ? "Try another search or delivery filter." : "Try another delivery filter."} />
                        ) : view === "cards" ? (
                            <div className="tm-jobs">
                                {pager.content.map((j) => (
                                    <article key={j.key} className="tm-job">
                                        <div className="tm-job-top">
                                            <span className="so-mono tm-job-inv">#{j.invoice.invoiceId}</span>
                                            <span className="tm-spacer" />
                                            <UrgencyBadge date={j.invoice.expectedDeliveryDate} />
                                        </div>
                                        <div className="tm-job-body with-thumb">
                                            <DesignThumb item={j.item} onOpen={setDesign} />
                                            <div style={{ minWidth: 0 }}>
                                                <div className="tm-job-name">
                                                    {j.item.itemName}
                                                    {j.item.itemQuantity > 1 && <span className="tm-qty">×{j.item.itemQuantity}</span>}
                                                </div>
                                                <div className="so-cell-sub">{j.invoice.customerName || "Customer"} · ordered {formatDate(j.invoice.invoiceDate)}</div>
                                            </div>
                                        </div>
                                        <div>
                                            <Button variant="ghost" size="sm" onClick={() => setMeasure(j.item)}>
                                                <FiMaximize2 aria-hidden /> Measurements
                                            </Button>
                                        </div>
                                        <div className="tm-assign-row">
                                            {picker(j)}
                                            {assignButton(j)}
                                        </div>
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
                                            <th>Due</th>
                                            <th>{Noun}</th>
                                            <th aria-label="Actions" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pager.content.map((j) => (
                                            <tr key={j.key} {...(orderPath ? {
                                                className: "so-row-link",
                                                tabIndex: 0,
                                                onClick: () => navigate(orderPath(j.invoice.invoiceId)),
                                                onKeyDown: (e) => e.key === "Enter" && e.target === e.currentTarget && navigate(orderPath(j.invoice.invoiceId)),
                                            } : {})}>
                                                <td>
                                                    <div className="so-cell-main so-mono">{j.invoice.invoiceId}</div>
                                                    <div className="so-cell-sub">{formatDate(j.invoice.invoiceDate)}</div>
                                                </td>
                                                <td><div className="so-cell-main">{j.invoice.customerName || "—"}</div></td>
                                                <td>
                                                    <div className="tm-cell-thumb">
                                                        <DesignThumb item={j.item} onOpen={setDesign} size={44} />
                                                        <div>
                                                            <div className="so-cell-main">{j.item.itemName}</div>
                                                            <div className="so-cell-sub">Qty {j.item.itemQuantity || 1}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ whiteSpace: "nowrap" }}>{formatDueDate(j.invoice.expectedDeliveryDate)}</div>
                                                    <UrgencyBadge date={j.invoice.expectedDeliveryDate} />
                                                </td>
                                                <td onClick={stop}>{picker(j)}</td>
                                                <td onClick={stop}>
                                                    <div className="tm-row-actions">
                                                        <Button variant="ghost" size="sm" onClick={() => setMeasure(j.item)}>
                                                            <FiMaximize2 aria-hidden /> Measurements
                                                        </Button>
                                                        {assignButton(j)}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {!state.loading && <Pagination page={pager} pageSize={PAGE_SIZE} onChange={setPageNumber} />}
                    </div>
                </div>
            )}

            <MeasurementsModal item={measure} onClose={() => setMeasure(null)} />
            <DesignModal item={design} onClose={() => setDesign(null)} />
        </>
    );
}
