// Platform owner: expenses of all branches or one, for a period (view only).
// Totals with the change vs the previous period, by branch (cash / other, petty cash);
// with one branch picked, every expense entry and the deleted ones. Branch + period live in the URL.
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiCreditCard, FiHome, FiUsers, FiSearch, FiX } from "react-icons/fi";
import { MdCurrencyRupee } from "react-icons/md";
import { getFinancialSummary, getShopsOverview } from "../../../api/reports.js";
import { listExpenses, listDeletedExpenses, getExpenseSummary } from "../../../api/expenses.js";
import { listBranchEmployees } from "../../../api/owner.js";
import { getPaymentMethods } from "../../../api/reference.js";
import { PageHeader, Card, KpiCard, Delta, Segmented, EmptyState, ErrorBox, Skeleton, Button } from "../../shared/components/ui.jsx";
import { Select, Pagination } from "../../shared/components/form.jsx";
import PeriodFilter from "../../shared/components/PeriodFilter.jsx";
import { previousRange, comparisonLabel, percentChange, rangeParams } from "../../shared/lib/period.js";
import { formatMoney, formatMoneyShort, formatNumber, formatDate, formatDateTime, formatAmount } from "../../shared/lib/format.js";
import { periodFrom, periodText, withPeriod, useSection } from "../lib/owner.js";
import ExportButton from "../../shared/components/ExportButton.jsx";
import { exportXlsx, exportFileName, fetchAllPages } from "../../shared/lib/exportXlsx.js";

const PAGE_SIZE = 20;
const FOR_OPTIONS = [
    { key: "", label: "All" },
    { key: "shop", label: "Shop" },
    { key: "employee", label: "Employees" },
];
const SORT_OPTIONS = [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
];

/** Debounced copy of a value (search box). */
function useDebounced(value, ms = 350) {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return v;
}

/**
 * One branch's expense entries (or the deleted ones) for the page period, with filters: search, for (shop /
 * employees + employee), category, paid by and sort. Deleted entries can only be searched and split shop / employees.
 */
function Entries({ shopId, shopName, period }) {
    const [kind, setKind] = useState("live");
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState("");
    const [forWhom, setForWhom] = useState("");
    const [employee, setEmployee] = useState("");
    const [category, setCategory] = useState("");
    const [method, setMethod] = useState("");
    const [sort, setSort] = useState("newest");
    const [categories, setCategories] = useState([]);
    const [methods, setMethods] = useState([]);
    const [staff, setStaff] = useState([]);
    const q = useDebounced(search.trim());
    const periodKey = `${period.key}|${period.from}|${period.to}`;
    const live = kind === "live";
    useEffect(() => setPage(0), [kind, periodKey, shopId, q, forWhom, employee, category, method, sort]);
    useEffect(() => {
        getPaymentMethods().then(setMethods);
    }, []);
    useEffect(() => {
        setEmployee("");
        listBranchEmployees(shopId).then(setStaff).catch(() => setStaff([]));
    }, [shopId]);
    useEffect(() => {
        // category options: every category the branch used in the period
        getExpenseSummary({ shopId, ...rangeParams(period) })
            .then((d) => setCategories((d?.byType || []).map((g) => g.name).filter(Boolean)))
            .catch(() => setCategories([]));
    }, [shopId, periodKey]); // eslint-disable-line react-hooks/exhaustive-deps

    // one page of the list for the current filters (the table and the Excel export use the same call)
    const fetchEntries = (pageNumber, pageSize) => (live
        ? listExpenses({
            shopId, ...rangeParams(period), search: q || undefined, type: forWhom || undefined,
            employeeUserId: forWhom === "employee" && employee ? employee : undefined,
            expenseType: category || undefined, paymentMethod: method || undefined, sort,
            pageNumber, pageSize,
        })
        : listDeletedExpenses({
            shopId, ...rangeParams(period), search: q || undefined, type: forWhom || undefined,
            pageNumber, pageSize,
        }));
    const [state, reload] = useSection(
        () => fetchEntries(page, PAGE_SIZE),
        [shopId, periodKey, kind, page, q, forWhom, employee, category, method, sort],
    );
    const rows = state.data?.content || [];
    const filtered = !!q || !!forWhom || (live && (!!category || !!method || sort !== "newest"));
    const clear = () => { setSearch(""); setForWhom(""); setEmployee(""); setCategory(""); setMethod(""); setSort("newest"); };
    const total = state.data?.totalElements;

    const exportRows = async () => {
        const all = await fetchAllPages(({ pageNumber, pageSize }) => fetchEntries(pageNumber, pageSize));
        const name = live ? "Expenses" : "Deleted expenses";
        return exportXlsx({
            fileName: exportFileName(name, shopName),
            sheetName: name,
            title: `${shopName || "Branch"} · ${name}`,
            filters: [
                ["Branch", shopName],
                ["Period", periodText(period)],
                ["Search", q],
                ["For", forWhom && FOR_OPTIONS.find((o) => o.key === forWhom)?.label],
                ["Employee", live && forWhom === "employee" && employee ? staff.find((e) => e.userId === employee)?.name : ""],
                ["Category", live && category],
                ["Paid by", live && method],
                ["Sort", live && SORT_OPTIONS.find((o) => o.value === sort)?.label],
            ].map(([k, v]) => [k, v || ""]),
            columns: [
                { header: "Date", value: (r) => r.expenseDate, type: "date" },
                { header: "Category", value: (r) => r.expenseType },
                { header: "Notes", value: (r) => r.notes },
                { header: "For", value: (r) => r.employeeName || "Shop" },
                { header: "Method", value: (r) => r.paymentMethod },
                { header: "Amount", value: (r) => r.expenseAmount, type: "money" },
                ...(live ? [] : [
                    { header: "Deleted on", value: (r) => r.deletedAt, type: "datetime" },
                    { header: "Deleted by", value: (r) => r.deletedByName },
                    { header: "Reason", value: (r) => r.reason },
                ]),
            ],
            rows: all,
        });
    };
    return (
        <Card title="Expense entries" subtitle={periodText(period)}
            actions={<Segmented label="Entries" value={kind} onChange={setKind} options={[{ key: "live", label: "Expenses" }, { key: "deleted", label: "Deleted" }]} />}>
            <div className="so-filterbar">
                <div className="so-toolbar">
                    <div className="so-search">
                        <FiSearch aria-hidden />
                        <input className="so-input" type="search" placeholder="Search category or notes" aria-label="Search expenses"
                            value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    {live && (
                        <label className="so-inline-field">
                            <span>Sort by</span>
                            <Select options={SORT_OPTIONS} value={sort} onChange={(e) => setSort(e.target.value)} />
                        </label>
                    )}
                </div>
                <div className="so-filter-row">
                    <div className="so-filter-group">
                        <span className="so-filter-label">For</span>
                        <Segmented label="Expense for" options={FOR_OPTIONS} value={forWhom} onChange={(v) => { setForWhom(v); setEmployee(""); }} />
                    </div>
                    {live && forWhom === "employee" && (
                        <div className="so-filter-group">
                            <span className="so-filter-label">Employee</span>
                            <Select aria-label="Employee" placeholder="Everyone" options={staff.map((e) => ({ value: e.userId, label: e.name }))}
                                value={employee} onChange={(e) => setEmployee(e.target.value)} />
                        </div>
                    )}
                    {live && (
                        <>
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
                        </>
                    )}
                    <div className="so-filter-end">
                        {!state.loading && total != null && <span className="so-hint">{total} {total === 1 ? "expense" : "expenses"}</span>}
                        {filtered && <Button variant="ghost" size="sm" onClick={clear}><FiX aria-hidden /> Clear filters</Button>}
                        <ExportButton onExport={exportRows} disabled={state.loading || !total} />
                    </div>
                </div>
            </div>
            {state.error ? (
                <ErrorBox message={state.error} onRetry={reload} />
            ) : state.loading ? (
                <Skeleton height={240} />
            ) : !rows.length ? (
                <EmptyState compact title={filtered ? "No expense matches these filters"
                    : live ? "No expenses in this period" : "No deleted expenses in this period"} />
            ) : (
                <div className="so-table-wrap">
                    <table className="so-table">
                        <thead>
                            <tr>
                                <th>Date</th><th>Category</th><th>For</th><th>Method</th><th className="so-num">Amount</th>
                                {kind === "deleted" && <th>Deleted</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id || r.archiveId}>
                                    <td style={{ whiteSpace: "nowrap" }}>{formatDate(r.expenseDate)}</td>
                                    <td>
                                        <div className="so-cell-main">{r.expenseType || "—"}</div>
                                        {r.notes && <div className="so-cell-sub so-ellipsis" style={{ maxWidth: 280 }} title={r.notes}>{r.notes}</div>}
                                    </td>
                                    <td>{r.employeeName || "Shop"}</td>
                                    <td>{r.paymentMethod || "—"}</td>
                                    <td className="so-num">{formatMoney(r.expenseAmount)}</td>
                                    {kind === "deleted" && (
                                        <td>
                                            <div style={{ whiteSpace: "nowrap" }}>{formatDateTime(r.deletedAt)}</div>
                                            <div className="so-cell-sub">{r.deletedByName || "—"}{r.reason ? ` · ${r.reason}` : ""}</div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <Pagination page={state.data} pageSize={PAGE_SIZE} onChange={setPage} />
        </Card>
    );
}

export default function OwnerExpensesPage() {
    const [params, setParams] = useSearchParams();
    const period = periodFrom(params);
    const shopId = params.get("shop") || "";
    const periodKey = `${period.key}|${period.from}|${period.to}`;
    const scope = shopId ? { shopId } : {};
    const prev = useMemo(() => previousRange(period), [periodKey]); // eslint-disable-line react-hooks/exhaustive-deps

    const [summary, reloadSummary] = useSection(
        () => Promise.all([
            getFinancialSummary({ ...scope, ...rangeParams(period) }),
            prev ? getFinancialSummary({ ...scope, ...rangeParams(prev) }).catch(() => null) : Promise.resolve(null),
        ]).then(([current, previous]) => ({ current, previous })),
        [periodKey, shopId],
    );
    const [branches, reloadBranches] = useSection(() => getShopsOverview(rangeParams(period)), [periodKey]);

    const ex = summary.data?.current?.expenses;
    const old = summary.data?.previous?.expenses;
    const rows = useMemo(() => [...(branches.data || [])].sort((a, b) => (b.expenses || 0) - (a.expenses || 0)), [branches.data]);
    const cash = (ex?.byPaymentMethod || []).filter((m) => /cash/i.test(m.paymentMethod || "")).reduce((n, m) => n + (m.amount || 0), 0);
    const setShop = (id) => setParams((cur) => {
        const next = new URLSearchParams(cur);
        if (id) next.set("shop", id);
        else next.delete("shop");
        return next;
    }, { replace: true });
    const shop = rows.find((r) => r.shopId === shopId);

    return (
        <>
            <PageHeader
                eyebrow={shop ? "Branch" : "All branches"}
                title={shop ? `Expenses · ${shop.shopName}` : "Expenses"}
                subtitle={`${periodText(period)} · figures in IST`}
                actions={
                    <div className="so-actions" style={{ alignItems: "center" }}>
                        <label className="so-inline-field">
                            <span>Branch</span>
                            <Select aria-label="Branch" value={shopId} onChange={(e) => setShop(e.target.value)} placeholder="All branches"
                                options={[...rows].sort((a, b) => (a.shopName || "").localeCompare(b.shopName || "")).map((r) => ({ value: r.shopId, label: r.shopName || "Branch" }))} />
                        </label>
                        <PeriodFilter value={period} onChange={(p) => setParams((cur) => withPeriod(cur, p), { replace: true })} />
                    </div>
                }
            />

            {summary.error && <div style={{ marginBottom: 16 }}><ErrorBox message={summary.error} onRetry={reloadSummary} /></div>}

            <div className="so-grid so-grid-kpi" style={{ marginBottom: 16 }}>
                <KpiCard loading={summary.loading} icon={<FiCreditCard aria-hidden />} label="Total expenses" value={formatAmount(ex?.total)}
                    footer={<>{old && <Delta value={percentChange(ex?.total, old?.total)} goodWhen="down" />}<span>{old ? comparisonLabel(period.key, period) : `${formatNumber(ex?.count)} entries`}</span></>} />
                <KpiCard loading={summary.loading} icon={<MdCurrencyRupee aria-hidden />} label="Paid in cash" value={formatAmount(cash)}
                    footer={<span>{ex?.total ? `${Math.round((cash / ex.total) * 100)}% of expenses` : "—"}</span>} />
                <KpiCard loading={summary.loading} icon={<FiHome aria-hidden />} label="Shop expenses" value={formatAmount(ex?.shopExpenses)}
                    footer={<span>rent, bills, materials, …</span>} />
                <KpiCard loading={summary.loading} icon={<FiUsers aria-hidden />} label="Employee expenses" value={formatAmount(ex?.employeeExpenses)}
                    footer={<span>salary, advances, …</span>} />
            </div>

            {/* by branch (all branches only); the category / payment method breakdowns were removed */}
            <div style={{ marginBottom: shopId ? 0 : 16 }}>
                {!shopId && (
                    <Card title="By branch" subtitle="Click a branch to see its entries">
                        {branches.error ? <ErrorBox message={branches.error} onRetry={reloadBranches} />
                            : branches.loading ? <Skeleton height={160} /> : (
                                <div className="so-list">
                                    {rows.map((r) => (
                                        <div key={r.shopId} className="so-list-row so-row-link" role="link" tabIndex={0}
                                            onClick={() => setShop(r.shopId)} onKeyDown={(e) => e.key === "Enter" && setShop(r.shopId)}>
                                            <div className="so-list-main">
                                                <div className="so-list-title">{r.shopName || "Branch"}</div>
                                                <div className="so-list-meta">Cash {formatMoneyShort(r.cashExpenses)} · petty cash left {formatMoneyShort(r.pettyCash)}</div>
                                            </div>
                                            <div className="so-list-side"><b style={{ color: "var(--so-primary)" }}>{formatMoney(r.expenses)}</b></div>
                                        </div>
                                    ))}
                                </div>
                            )}
                    </Card>
                )}
            </div>

            {shopId ? (
                <Entries shopId={shopId} shopName={shop?.shopName} period={period} />
            ) : (
                <EmptyState compact title="Pick a branch to see each expense" message="Use the Branch filter above, or click a branch in “By branch”." />
            )}
        </>
    );
}
