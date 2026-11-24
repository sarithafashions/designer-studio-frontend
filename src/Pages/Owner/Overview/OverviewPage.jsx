// Platform owner Overview (view only): all branches or one branch, for a period.
// KPI tiles with the change vs the previous period, cash-flow trend, and a sortable branch ranking
// (a row narrows the page to that branch). Branch + period live in the URL (?shop=&period=&from=&to=).
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
    FiTrendingUp, FiDownload, FiCreditCard, FiActivity, FiClock, FiTruck, FiCheckCircle,
    FiArrowUp, FiArrowDown, FiHome,
} from "react-icons/fi";
import { MdCurrencyRupee } from "react-icons/md";
import { getFinancialSummary, getDailyFinancials, getMonthlyFinancials, getDeliveries, getShopsOverview } from "../../../api/reports.js";
import { PageHeader, Card, KpiCard, Delta, ErrorBox, Skeleton, EmptyState, Button } from "../../shared/components/ui.jsx";
import { Select } from "../../shared/components/form.jsx";
import PeriodFilter from "../../shared/components/PeriodFilter.jsx";
import TrendChart from "../../shared/components/TrendChart.jsx";
import { previousRange, comparisonLabel, percentChange, rangeParams } from "../../shared/lib/period.js";
import { trendPlan, trendParams, bucketTrend } from "../../shared/lib/trend.js";
import { formatMoney, formatNumber, formatAmount } from "../../shared/lib/format.js";
import { periodFrom, periodText as textOf, withPeriod, useSection } from "../lib/owner.js";
import ExportButton from "../../shared/components/ExportButton.jsx";
import { exportXlsx, exportFileName } from "../../shared/lib/exportXlsx.js";

const COLUMNS = [
    { key: "shopName", label: "Branch", num: false },
    { key: "invoicedAmount", label: "Sales", num: true, money: true },
    { key: "collected", label: "Collected", num: true, money: true },
    { key: "expenses", label: "Expenses", num: true, money: true },
    { key: "netCashFlow", label: "Net", num: true, money: true },
    { key: "pendingOrders", label: "Open orders", num: true },
    { key: "outstanding", label: "Outstanding", num: true, money: true },
    { key: "pettyCash", label: "Petty cash", num: true, money: true },
];

export default function OverviewPage() {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const period = periodFrom(params);
    const shopId = params.get("shop") || "";
    const periodKey = `${period.key}|${period.from}|${period.to}`;
    const scope = shopId ? { shopId } : {};
    const prev = useMemo(() => previousRange(period), [periodKey]); // eslint-disable-line react-hooks/exhaustive-deps
    // same grouping as the shop owner dashboard: today = last 7 days, week = per day, month = per week, custom by length,
    // overall = per month (per year past 24 months)
    const plan = useMemo(() => trendPlan(period), [periodKey]); // eslint-disable-line react-hooks/exhaustive-deps
    const [view, setView] = useState("chart");
    const [sort, setSort] = useState({ key: "invoicedAmount", dir: -1 });

    const setPeriod = (p) => setParams((cur) => withPeriod(cur, p), { replace: true });
    const setShop = (id) => setParams((cur) => {
        const next = new URLSearchParams(cur);
        if (id) next.set("shop", id);
        else next.delete("shop");
        return next;
    }, { replace: true });

    const [summary, reloadSummary] = useSection(
        () => Promise.all([
            getFinancialSummary({ ...scope, ...rangeParams(period) }),
            prev ? getFinancialSummary({ ...scope, ...rangeParams(prev) }).catch(() => null) : Promise.resolve(null),
        ]).then(([current, previous]) => ({ current, previous })),
        [periodKey, shopId],
    );
    const [series, reloadSeries] = useSection(
        () => (plan.source === "monthly" ? getMonthlyFinancials({ ...scope, ...trendParams(plan) }) : getDailyFinancials({ ...scope, ...trendParams(plan) }))
            .then((rows) => bucketTrend(plan, rows || [])),
        [periodKey, shopId],
    );
    const [deliveries, reloadDeliveries] = useSection(() => getDeliveries(scope), [shopId]);
    const [branches, reloadBranches] = useSection(() => getShopsOverview(rangeParams(period)), [periodKey]);

    const cur = summary.data?.current;
    const old = summary.data?.previous;
    const compareText = comparisonLabel(period.key, period);
    const footer = (currentValue, previousValue, goodWhen, extra) => (
        <>
            {old && <Delta value={percentChange(currentValue, previousValue)} goodWhen={goodWhen} />}
            <span>{old ? compareText : extra}</span>
        </>
    );
    const periodText = textOf(period);
    const rows = useMemo(() => branches.data || [], [branches.data]);
    const shop = rows.find((r) => r.shopId === shopId);
    const d = deliveries.data?.summary;

    const sorted = useMemo(() => [...rows].sort((a, b) => {
        const x = a[sort.key];
        const y = b[sort.key];
        if (typeof x === "string" || typeof y === "string") return String(x || "").localeCompare(String(y || "")) * sort.dir;
        return ((x || 0) - (y || 0)) * sort.dir;
    }), [rows, sort]);
    const totals = useMemo(() => Object.fromEntries(COLUMNS.filter((c) => c.num).map((c) => [c.key, rows.reduce((n, r) => n + (r[c.key] || 0), 0)])), [rows]);
    const sortBy = (key) => setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: key === "shopName" ? 1 : -1 }));

    // both tables are loaded whole: exported as shown (same sort / grouping)
    const exportTrend = () => exportXlsx({
        fileName: exportFileName("Cash-flow", shop?.shopName),
        sheetName: "Cash flow",
        title: `${shop?.shopName || "All branches"} · Cash flow`,
        filters: [["Branch", shop?.shopName || "All branches"], ["Period", periodText], ["Grouped", series.data?.label || plan.label]],
        columns: [
            { header: "Period", value: (r) => r.title },
            { header: "Invoices", value: (r) => r.invoiceCount, type: "number" },
            { header: "Invoiced", value: (r) => r.invoicedAmount, type: "money" },
            { header: "Collected", value: (r) => r.collected, type: "money" },
            { header: "Expenses", value: (r) => r.expenses, type: "money" },
            { header: "Net", value: (r) => r.netCashFlow, type: "money" },
        ],
        rows: [...(series.data?.rows || [])].reverse(),
    });
    const exportBranches = () => {
        const by = COLUMNS.find((c) => c.key === sort.key);
        return exportXlsx({
            fileName: exportFileName("Branches"),
            sheetName: "Branches",
            title: "All branches · Branches",
            filters: [["Period", periodText], ["Sort", `${by?.label} (${sort.dir > 0 ? "ascending" : "descending"})`]],
            columns: [
                { header: "Branch", value: (r) => r.shopName || "Branch" },
                { header: "Shop owner", value: (r) => r.ownerName || "No shop owner" },
                { header: "Staff", value: (r) => r.employeeCount, type: "number" },
                ...COLUMNS.slice(1).map((c) => ({ header: c.label, value: (r) => r[c.key], type: c.money ? "money" : "number" })),
            ],
            rows: sorted,
        });
    };

    return (
        <>
            <PageHeader
                eyebrow={shop ? "Branch" : "All branches"}
                title={shop ? shop.shopName : "Overview"}
                subtitle={`${periodText} · figures in IST`}
                actions={
                    <div className="so-actions" style={{ alignItems: "center" }}>
                        <label className="so-inline-field">
                            <span>Branch</span>
                            <Select aria-label="Branch" value={shopId} onChange={(e) => setShop(e.target.value)} placeholder="All branches"
                                options={rows.map((r) => ({ value: r.shopId, label: r.shopName || "Branch" }))} />
                        </label>
                        <PeriodFilter value={period} onChange={setPeriod} />
                        {shopId && (
                            <Button variant="secondary" size="sm" onClick={() => navigate(`/owner/branches/${encodeURIComponent(shopId)}`)}>
                                <FiHome aria-hidden /> Branch page
                            </Button>
                        )}
                    </div>
                }
            />

            {summary.error && (
                <div style={{ marginBottom: 16 }}>
                    <ErrorBox message={summary.error} onRetry={reloadSummary} />
                </div>
            )}

            {/* KPI row 1: money in the period */}
            <div className="so-grid so-grid-kpi" style={{ marginBottom: 16 }}>
                <KpiCard loading={summary.loading} icon={<FiTrendingUp aria-hidden />} label="Sales (invoiced)"
                    value={formatAmount(cur?.sales?.invoicedAmount)}
                    footer={footer(cur?.sales?.invoicedAmount, old?.sales?.invoicedAmount, "up", `${formatNumber(cur?.sales?.invoiceCount)} invoices`)} />
                <KpiCard loading={summary.loading} icon={<FiDownload aria-hidden />} label="Collected"
                    value={formatAmount(cur?.collections?.total)}
                    footer={footer(cur?.collections?.total, old?.collections?.total, "up", "payments received")} />
                <KpiCard loading={summary.loading} icon={<FiCreditCard aria-hidden />} label="Expenses"
                    value={formatAmount(cur?.expenses?.total)}
                    footer={footer(cur?.expenses?.total, old?.expenses?.total, "down", `${formatNumber(cur?.expenses?.count)} entries`)} />
                <KpiCard loading={summary.loading} icon={<FiActivity aria-hidden />} label="Net cash flow"
                    value={formatAmount(cur?.netCashFlow)}
                    footer={footer(cur?.netCashFlow, old?.netCashFlow, "up", "collected − expenses")} />
            </div>

            {/* KPI row 2: position right now */}
            <div className="so-grid so-grid-kpi" style={{ marginBottom: 24 }}>
                <KpiCard loading={summary.loading} icon={<FiClock aria-hidden />} label="Outstanding balance"
                    value={formatAmount(cur?.outstanding?.balanceDue)}
                    footer={<span>{formatNumber(cur?.outstanding?.openInvoiceCount)} open orders · right now</span>} />
                <KpiCard loading={deliveries.loading} icon={<FiTruck aria-hidden />} label="Deliveries due today"
                    value={deliveries.error ? "—" : formatNumber(d?.dueCount)}
                    footer={deliveries.error
                        ? <button type="button" className="so-linkbtn" style={{ padding: 0, width: "auto", fontSize: 12 }} onClick={reloadDeliveries}>Retry</button>
                        : <span><b style={{ color: d?.overdueCount ? "var(--so-danger)" : undefined }}>{formatNumber(d?.overdueCount)} overdue</b> · {formatNumber(d?.deliveredCount)} delivered today</span>} />
                <KpiCard loading={summary.loading} icon={<MdCurrencyRupee aria-hidden />} label="Petty cash balance"
                    value={formatAmount(cur?.pettyCash?.currentBalance)}
                    footer={<span>{formatAmount(cur?.pettyCash?.added)} added in period</span>} />
                <KpiCard loading={summary.loading} icon={<FiCheckCircle aria-hidden />} label="Delivered (receipts)"
                    value={formatNumber(cur?.receiptCount)}
                    footer={footer(cur?.receiptCount, old?.receiptCount, "up", "receipts generated")} />
            </div>

            {/* Cash-flow trend, full width */}
            <div style={{ marginBottom: 16 }}>
                <Card title="Cash flow" subtitle={series.data?.label || plan.label}
                    actions={<ExportButton onExport={exportTrend}
                        disabled={series.loading || !(series.data?.rows || []).some((r) => r.invoicedAmount || r.collected || r.expenses)} />}>
                    {series.error ? (
                        <ErrorBox message={series.error} onRetry={reloadSeries} />
                    ) : series.loading ? (
                        <Skeleton height={300} />
                    ) : (
                        <TrendChart rows={series.data?.rows || []} view={view} onViewChange={setView} />
                    )}
                </Card>
            </div>

            {/* Branch ranking (all branches) */}
            {!shopId && (
                <Card title="Branches" subtitle={`${periodText} · click a branch to see only its figures`}
                    actions={<ExportButton onExport={exportBranches} disabled={branches.loading || !rows.length} />}>
                    {branches.error ? (
                        <ErrorBox message={branches.error} onRetry={reloadBranches} />
                    ) : branches.loading ? (
                        <Skeleton height={200} />
                    ) : !rows.length ? (
                        <EmptyState compact title="No branches yet" />
                    ) : (
                        <div className="so-table-wrap">
                            <table className="so-table">
                                <thead>
                                    <tr>
                                        {COLUMNS.map((c) => (
                                            <th key={c.key} className={c.num ? "so-num" : undefined}
                                                aria-sort={sort.key === c.key ? (sort.dir > 0 ? "ascending" : "descending") : "none"}>
                                                <button type="button" className="ow-sort" onClick={() => sortBy(c.key)}>
                                                    {c.label}
                                                    {sort.key === c.key && (sort.dir > 0 ? <FiArrowUp aria-hidden /> : <FiArrowDown aria-hidden />)}
                                                </button>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.map((r) => (
                                        <tr key={r.shopId} className="so-row-link" tabIndex={0} onClick={() => setShop(r.shopId)}
                                            onKeyDown={(e) => e.key === "Enter" && setShop(r.shopId)}>
                                            <td>
                                                <div className="so-cell-main">{r.shopName || "Branch"}</div>
                                                <div className="so-cell-sub">{r.ownerName || "No shop owner"} · {formatNumber(r.employeeCount)} staff</div>
                                            </td>
                                            {COLUMNS.slice(1).map((c) => (
                                                <td key={c.key} className="so-num"
                                                    style={c.key === "netCashFlow" && r.netCashFlow < 0 ? { color: "var(--so-danger)" } : undefined}>
                                                    {c.money ? formatMoney(r[c.key]) : formatNumber(r[c.key])}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="ow-total">
                                        <td>All branches</td>
                                        {COLUMNS.slice(1).map((c) => (
                                            <td key={c.key} className="so-num">{c.money ? formatMoney(totals[c.key]) : formatNumber(totals[c.key])}</td>
                                        ))}
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </Card>
            )}
        </>
    );
}
