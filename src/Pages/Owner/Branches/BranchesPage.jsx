// Platform owner: search + every branch as a box card, 3 per row (details, today's figures, petty cash, staff, open).
// A card opens the branch page. Styled after design.md (flat white cards, hairline borders, soft-stone tiles, mono labels).
// Admin: "Add branch" creates the branch and its shop owner account.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiMapPin, FiPhone, FiUser, FiArrowRight, FiRefreshCw, FiPlus, FiUsers, FiSearch } from "react-icons/fi";
import { listShopSummaries, createBranch } from "../../../api/owner.js";
import { toast } from "../../../utils/toast.js";
import { FormModal } from "../components/AdminModals.jsx";
import { getShopsOverview } from "../../../api/reports.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { PageHeader, Button, EmptyState, ErrorBox, Skeleton } from "../../shared/components/ui.jsx";
import { todayIST } from "../../shared/lib/period.js";
import { formatAmount, formatNumber, initials } from "../../shared/lib/format.js";

// Dot colours of the four figures: the cash-flow chart series + coral / amber.
const STAT_DOT = { sales: "#1863dc", collected: "#1f9d6b", open: "#ff7759", outstanding: "#eda100" };

export default function BranchesPage() {
    const navigate = useNavigate();
    const [state, setState] = useState({ loading: true, branches: [], error: "" });
    const [adding, setAdding] = useState(false);
    const [query, setQuery] = useState("");

    const load = useCallback(() => {
        setState((s) => ({ ...s, loading: true, error: "" }));
        const today = todayIST();
        Promise.all([listShopSummaries(), getShopsOverview({ from: today, to: today }).catch(() => [])])
            .then(([shops, figures]) => {
                const byId = new Map((figures || []).map((f) => [f.shopId, f]));
                const branches = shops.map((s) => ({ ...s, today: byId.get(s.shopId) || null }))
                    .sort((a, b) => (a.shopName || "").localeCompare(b.shopName || ""));
                setState({ loading: false, branches, error: "" });
            })
            .catch((err) => setState({ loading: false, branches: [], error: getErrorMessage(err, "Could not load the branches.") }));
    }, []);
    useEffect(() => {
        load();
    }, [load]);

    // search by branch name, shop owner, phone or address (all branches are loaded, so it filters as you type)
    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return state.branches;
        return state.branches.filter((b) =>
            [b.shopName, b.ownerName, b.shopContactNumber, b.shopAddress].some((v) => String(v || "").toLowerCase().includes(q)));
    }, [state.branches, query]);

    return (
        <>
            <PageHeader
                eyebrow="All branches"
                title="Branches"
                subtitle={state.loading ? "" : `${state.branches.length} branch${state.branches.length === 1 ? "" : "es"} · today's figures`}
                actions={
                    <div className="so-actions">
                        <Button variant="ghost" size="sm" onClick={load} disabled={state.loading}>
                            <FiRefreshCw aria-hidden /> Refresh
                        </Button>
                        <Button size="sm" onClick={() => setAdding(true)}>
                            <FiPlus aria-hidden /> Add branch
                        </Button>
                    </div>
                }
            />
            {state.error ? (
                <ErrorBox message={state.error} onRetry={load} />
            ) : state.loading ? (
                <>
                    <div className="owb-grid">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} height={280} style={{ borderRadius: 16 }} />)}</div>
                </>
            ) : !state.branches.length ? (
                <EmptyState title="No branches yet" message="Add your first branch with “Add branch”." />
            ) : (
                <>
                    <div className="owb-toolbar">
                        <div className="so-search">
                            <FiSearch aria-hidden />
                            <input className="so-input" type="search" placeholder="Search branch, shop owner, phone or address"
                                aria-label="Search branches" value={query} onChange={(e) => setQuery(e.target.value)} />
                        </div>
                        {query.trim() && (
                            <span className="owb-count">{formatNumber(shown.length)} of {formatNumber(state.branches.length)} branches</span>
                        )}
                    </div>

                    {!shown.length ? (
                        <EmptyState title="No branch matches your search" message={`Nothing found for “${query.trim()}”.`}
                            action={<Button variant="secondary" size="sm" onClick={() => setQuery("")}>Clear search</Button>} />
                    ) : (
                    <div className="owb-grid">
                        {shown.map((b) => {
                            const t = b.today;
                            const open = () => navigate(`/owner/branches/${encodeURIComponent(b.shopId)}`);
                            return (
                                <button key={b.shopId} type="button" className="owb-card" onClick={open}>
                                    <div className="owb-main">
                                        <div className="owb-head">
                                            <span className="owb-avatar" aria-hidden>{initials(b.shopName || "Branch")}</span>
                                            <span className="owb-title">
                                                <span className="owb-name">{b.shopName || "Branch"}</span>
                                                <span className="owb-owner"><FiUser aria-hidden /> {b.ownerName || "No shop owner"}</span>
                                            </span>
                                        </div>

                                        {(b.shopContactNumber || b.shopAddress) && (
                                            <div className="owb-chips">
                                                {b.shopContactNumber && <span className="owb-chip"><FiPhone aria-hidden /> {b.shopContactNumber}</span>}
                                                {b.shopAddress && <span className="owb-chip owb-chip-addr" title={b.shopAddress}><FiMapPin aria-hidden /> {b.shopAddress}</span>}
                                            </div>
                                        )}
                                    </div>

                                    <div className="owb-stats">
                                        <div><span><i style={{ background: STAT_DOT.sales }} />Sales today</span><b>{formatAmount(t?.invoicedAmount)}</b></div>
                                        <div><span><i style={{ background: STAT_DOT.collected }} />Collected</span><b>{formatAmount(t?.collected)}</b></div>
                                        <div><span><i style={{ background: STAT_DOT.open }} />Open orders</span><b>{formatNumber(t?.pendingOrders)}</b></div>
                                        <div><span><i style={{ background: STAT_DOT.outstanding }} />Outstanding</span><b>{formatAmount(t?.outstanding)}</b></div>
                                    </div>

                                    <div className="owb-foot">
                                        <span className="owb-pill owb-pill-green">Petty cash <b>{formatAmount(t?.pettyCash ?? b.pettyCash)}</b></span>
                                        <span className="owb-pill"><FiUsers aria-hidden /> {formatNumber(t?.employeeCount)} staff</span>
                                        <span className="owb-go">Open <FiArrowRight aria-hidden /></span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    )}
                </>
            )}

            <FormModal
                open={adding}
                title="Add branch"
                submitLabel="Create branch"
                intro="Creates the branch and the shop owner's login. The shop owner signs in with this email and password."
                fields={[
                    { name: "shopName", label: "Branch name", required: true, wide: true },
                    { name: "shopAddress", label: "Address", type: "textarea" },
                    { name: "gstNumber", label: "GST number" },
                    { name: "ownerName", label: "Shop owner name", required: true },
                    { name: "ownerNumber", label: "Shop owner phone", type: "phone" },
                    { name: "ownerEmailId", label: "Shop owner email (login)", type: "email", required: true },
                    { name: "password", label: "Password", type: "password", required: true, hint: "8+ characters, a letter and a digit" },
                    { name: "salary", label: "Shop owner salary (₹ / month)", type: "money" },
                ]}
                onClose={() => setAdding(false)}
                onSubmit={async (values) => {
                    await createBranch(values);
                    toast.success(`Branch ${values.shopName} created`);
                    setAdding(false);
                    load();
                }}
            />
        </>
    );
}
