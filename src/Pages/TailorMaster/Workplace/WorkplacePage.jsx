// TAILOR_MASTER workplace: orders (invoices) with their items in the tailor master's stages.
// Tabs New / Cutting / With tailors / All; search, sort and due filters; start cutting and assign tailors,
// one item or a whole order at a time. Data: GET /items/queue/orders + /items/queue/summary.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiRefreshCw, FiSearch, FiAlertTriangle } from "react-icons/fi";
import { getQueueOrders, getQueueSummary } from "../../../api/production.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { PageHeader, Button, Tabs, Segmented, EmptyState, ErrorBox, Skeleton } from "../../shared/components/ui.jsx";
import { Pagination } from "../../shared/components/form.jsx";
import { TABS, SORTS, DUES, tabOf, tabCount } from "../lib/workplace.js";
import useItemActions from "../lib/useItemActions.js";
import OrderCard from "./OrderCard.jsx";
import AssignTailorModal from "./AssignTailorModal.jsx";
import ItemDetailsModal from "./ItemDetailsModal.jsx";

const PAGE_SIZE = 10;
const AUTO_REFRESH_MS = 3 * 60 * 1000;

export default function WorkplacePage() {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const tab = tabOf(params.get("tab"));
    const sort = SORTS.some((s) => s.key === params.get("sort")) ? params.get("sort") : "dueSoonest";
    const due = DUES.some((d) => d.key === params.get("due")) ? params.get("due") || "" : "";
    const pageNumber = Math.max(0, Number(params.get("page")) || 0);

    const [searchText, setSearchText] = useState(params.get("q") || "");
    const [state, setState] = useState({ loading: true, page: null, error: "" });
    const [summary, setSummary] = useState(null);
    const [assigning, setAssigning] = useState(null); // items[]
    const [detail, setDetail] = useState(null); // item
    const requestId = useRef(0);

    /** Changes URL params (filters live in the URL, so Back from an order keeps them); filters reset the page. */
    const setParam = (changes) =>
        setParams((p) => {
            const next = new URLSearchParams(p);
            Object.entries(changes).forEach(([k, v]) => (v === "" || v === null || v === undefined ? next.delete(k) : next.set(k, v)));
            if (!("page" in changes)) next.delete("page");
            return next;
        }, { replace: true });

    // Search: typing waits 300 ms before it reaches the URL / server.
    useEffect(() => {
        const t = setTimeout(() => {
            if ((params.get("q") || "") !== searchText.trim()) setParam({ q: searchText.trim() });
        }, 300);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed text drives this
    }, [searchText]);

    const q = params.get("q") || "";
    const load = useCallback(
        (silent = false) => {
            const id = ++requestId.current;
            if (!silent) setState((s) => ({ ...s, loading: true, error: "" }));
            getQueueSummary().then(setSummary).catch(() => undefined);
            return getQueueOrders({ statuses: tab.statuses, search: q, sort, due, pageNumber, pageSize: PAGE_SIZE })
                .then((page) => id === requestId.current && setState({ loading: false, page, error: "" }))
                .catch((err) => id === requestId.current && !silent
                    && setState({ loading: false, page: null, error: getErrorMessage(err, "Could not load the orders") }));
        },
        [tab, q, sort, due, pageNumber],
    );
    useEffect(() => {
        load();
    }, [load]);

    const { busy, startCutting, assign } = useItemActions(() => load(true));

    // Auto-refresh (new invoices appear) while the page is visible and nothing is open.
    const idle = !busy && !assigning && !detail;
    useEffect(() => {
        if (!idle) return undefined;
        const t = setInterval(() => document.visibilityState === "visible" && load(true), AUTO_REFRESH_MS);
        return () => clearInterval(t);
    }, [idle, load]);

    const orders = state.page?.content || [];
    const filtering = q || due;
    const openOrder = (order) => navigate(`/tailorMaster/workplace/${encodeURIComponent(order.invoiceId)}`);

    return (
        <>
            <PageHeader
                eyebrow="Tailor master"
                title="Workplace"
                subtitle={
                    summary
                        ? `${summary.orders} order${summary.orders === 1 ? "" : "s"} · ${summary.totalItems} item${summary.totalItems === 1 ? "" : "s"} in your stages`
                        : "Orders to cut and assign"
                }
                actions={
                    <Button variant="ghost" size="sm" onClick={() => load()} disabled={state.loading}>
                        <FiRefreshCw aria-hidden /> Refresh
                    </Button>
                }
            />

            {summary?.late > 0 && (
                <button type="button" className="so-note tm-late-note" onClick={() => setParam({ due: "overdue", tab: "all" })}>
                    <FiAlertTriangle aria-hidden />
                    <span>
                        <b>{summary.late}</b> item{summary.late === 1 ? " is" : "s are"} past the delivery date — show them
                    </span>
                </button>
            )}

            <Tabs
                tabs={TABS.map((t) => ({ key: t.key, label: t.label, count: tabCount(summary, t) }))}
                value={tab.key}
                onChange={(key) => setParam({ tab: key === "new" ? "" : key })}
            />

            <div className="so-filterbar">
                <div className="so-toolbar">
                    <div className="so-search">
                        <FiSearch aria-hidden />
                        <input className="so-input" type="search" placeholder="Search customer, invoice no. or item" aria-label="Search orders"
                            value={searchText} onChange={(e) => setSearchText(e.target.value)} />
                    </div>
                    <Segmented label="Delivery" options={DUES} value={due} onChange={(v) => setParam({ due: v })} />
                    <Segmented label="Sort" options={SORTS} value={sort} onChange={(v) => setParam({ sort: v === "dueSoonest" ? "" : v })} />
                </div>
            </div>

            {state.error ? (
                <ErrorBox message={state.error} onRetry={() => load()} />
            ) : state.loading && !state.page ? (
                <div className="so-stack">
                    <Skeleton height={150} />
                    <Skeleton height={150} />
                </div>
            ) : orders.length === 0 ? (
                <EmptyState
                    title={filtering ? "No orders match" : tab.key === "new" ? "No new items to cut" : `Nothing in “${tab.label}”`}
                    message={filtering ? "Try another search or delivery filter." : "New orders appear here as soon as the shop owner creates them."}
                    action={filtering ? <Button variant="secondary" onClick={() => { setSearchText(""); setParam({ q: "", due: "" }); }}>Clear filters</Button> : null}
                />
            ) : (
                <div className="so-stack" style={{ gap: 12 }}>
                    {orders.map((order) => (
                        <OrderCard key={order.invoiceId} order={order} busy={busy}
                            onCut={startCutting} onAssign={setAssigning} onOpenItem={setDetail} onOpenOrder={openOrder} />
                    ))}
                    <Pagination page={state.page} pageSize={PAGE_SIZE} onChange={(p) => setParam({ page: p ? String(p) : "" })} />
                </div>
            )}

            <AssignTailorModal
                open={!!assigning}
                items={assigning || []}
                onClose={() => setAssigning(null)}
                onSubmit={(tailor) => assign(assigning, tailor).then(() => setAssigning(null))}
            />
            <ItemDetailsModal item={detail} onClose={() => setDetail(null)} />
        </>
    );
}
