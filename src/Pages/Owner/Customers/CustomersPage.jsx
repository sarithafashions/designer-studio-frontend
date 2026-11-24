// Platform owner: customers (GET /reports/customers). All branches or one, for a period (URL).
// Tiles (active, new, returning, repeat rate, average spend), new vs returning per month (stacked bars + table),
// top 5 customers by amount. View only.
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { FiUsers, FiUserPlus, FiRepeat, FiPercent, FiShoppingBag } from "react-icons/fi";
import { getCustomers } from "../../../api/reports.js";
import { listShopSummaries } from "../../../api/owner.js";
import { PageHeader, Card, KpiCard, Segmented, EmptyState, ErrorBox, Skeleton } from "../../shared/components/ui.jsx";
import { Select } from "../../shared/components/form.jsx";
import PeriodFilter from "../../shared/components/PeriodFilter.jsx";
import { rangeParams } from "../../shared/lib/period.js";
import { formatMoney, formatNumber, formatDate, formatMonth, formatAmount } from "../../shared/lib/format.js";
import { periodFrom, periodText, withPeriod, useSection } from "../lib/owner.js";
import ExportButton from "../../shared/components/ExportButton.jsx";
import { exportXlsx, exportFileName } from "../../shared/lib/exportXlsx.js";

// fixed series colours = the theme's validated --so-series-1 / --so-series-2 (hex: SVG attributes ignore CSS variables)
const NEW_COLOR = "#1863dc";
const RETURNING_COLOR = "#1f9d6b";
const VIEWS = [
    { key: "chart", label: "Chart" },
    { key: "table", label: "Table" },
];

function MonthTip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload;
    return (
        <div className="so-tooltip">
            <div className="so-tooltip-title">{formatMonth(label)}</div>
            <div className="ow-tip-row"><span className="so-swatch" style={{ background: NEW_COLOR }} /><span>New</span><b>{formatNumber(row.newCustomers)}</b></div>
            <div className="ow-tip-row"><span className="so-swatch" style={{ background: RETURNING_COLOR }} /><span>Returning</span><b>{formatNumber(row.returningCustomers)}</b></div>
        </div>
    );
}

export default function CustomersPage() {
    const [params, setParams] = useSearchParams();
    const period = periodFrom(params);
    const periodKey = `${period.key}|${period.from}|${period.to}`;
    const shopId = params.get("shop") || "";
    const [view, setView] = useState("chart");
    const setShop = (id) => setParams((cur) => {
        const next = new URLSearchParams(cur);
        if (id) next.set("shop", id);
        else next.delete("shop");
        return next;
    }, { replace: true });

    const [report, reload] = useSection(() => getCustomers({ ...(shopId ? { shopId } : {}), ...rangeParams(period) }), [periodKey, shopId]);
    const [shops] = useSection(() => listShopSummaries().then((all) => all.map((s) => ({ value: s.shopId, label: s.shopName || "Branch" }))
        .sort((a, b) => a.label.localeCompare(b.label))), []);
    const r = report.data;
    const loading = report.loading;
    const hasMonths = (r?.months || []).some((m) => m.newCustomers || m.returningCustomers);

    // the report is loaded whole: the tables are exported as shown
    const branch = shopId ? (shops.data || []).find((o) => o.value === shopId)?.label || "Branch" : "";
    const exportOf = (name, columns, rows) => exportXlsx({
        fileName: exportFileName(name, branch),
        sheetName: name,
        title: `${branch || "All branches"} · ${name}`,
        filters: [["Branch", branch || "All branches"], ["Period", periodText(period)]],
        columns,
        rows,
    });
    const exportMonths = () => exportOf("New vs returning customers", [
        { header: "Month", value: (m) => formatMonth(m.month) },
        { header: "New", value: (m) => m.newCustomers, type: "number" },
        { header: "Returning", value: (m) => m.returningCustomers, type: "number" },
        { header: "Total", value: (m) => (m.newCustomers || 0) + (m.returningCustomers || 0), type: "number" },
    ], [...(r?.months || [])].reverse());
    const exportTop = () => exportOf("Top customers", [
        { header: "#", value: (c) => c.rank, type: "number" },
        { header: "Customer", value: (c) => c.name },
        { header: "Phone", value: (c) => c.phone },
        { header: "Branches", value: (c) => c.branches, type: "number" },
        { header: "Invoices in period", value: (c) => c.invoices, type: "number" },
        { header: "Invoices in all", value: (c) => c.lifetimeInvoices, type: "number" },
        { header: "Spent", value: (c) => c.spent, type: "money" },
        { header: "Last visit", value: (c) => c.lastVisit, type: "date" },
    ], (r?.top || []).slice(0, 5).map((c, i) => ({ ...c, rank: i + 1 })));

    return (
        <>
            <PageHeader eyebrow={shopId ? "Branch" : "All branches"} title="Customers"
                subtitle={`${periodText(period)} · a customer is new in the month of their first invoice`}
                actions={
                    <div className="so-actions" style={{ alignItems: "center" }}>
                        <label className="so-inline-field">
                            <span>Branch</span>
                            <Select aria-label="Branch" value={shopId} onChange={(e) => setShop(e.target.value)} placeholder="All branches" options={shops.data || []} />
                        </label>
                        <PeriodFilter value={period} onChange={(p) => setParams((cur) => withPeriod(cur, p), { replace: true })} />
                    </div>
                } />

            {report.error ? (
                <ErrorBox message={report.error} onRetry={reload} />
            ) : (
                <>
                    <div className="so-grid ow-kpi5" style={{ marginBottom: 16 }}>
                        <KpiCard loading={loading} icon={<FiUsers aria-hidden />} label="Active customers" value={formatNumber(r?.activeCustomers)}
                            footer={<span>{formatNumber(r?.totalCustomers)} customers in all</span>} />
                        <KpiCard loading={loading} icon={<FiUserPlus aria-hidden />} label="New" value={formatNumber(r?.newCustomers)}
                            footer={<span>first invoice in the period</span>} />
                        <KpiCard loading={loading} icon={<FiRepeat aria-hidden />} label="Returning" value={formatNumber(r?.returningCustomers)}
                            footer={<span>came back in the period</span>} />
                        <KpiCard loading={loading} icon={<FiPercent aria-hidden />} label="Repeat rate" value={r ? `${r.repeatRate}%` : "—"}
                            footer={<span>customers with 2+ invoices</span>} />
                        <KpiCard loading={loading} icon={<FiShoppingBag aria-hidden />} label="Average spend" value={formatAmount(r?.avgSpendPerCustomer)}
                            footer={<span>per active customer</span>} />
                    </div>

                    <Card title="New vs returning customers" subtitle="Per month"
                        actions={
                            <div className="so-actions">
                                <Segmented label="Chart or table" options={VIEWS} value={view} onChange={setView} />
                                <ExportButton onExport={exportMonths} disabled={loading || !hasMonths} />
                            </div>
                        }>
                        {loading ? <Skeleton height={260} /> : !hasMonths ? (
                            <EmptyState compact title="No invoices in these months" />
                        ) : view === "chart" ? (
                            <>
                                <div className="so-legend" style={{ marginBottom: 8 }}>
                                    <span className="so-legend-item"><span className="so-swatch" style={{ background: NEW_COLOR }} />New</span>
                                    <span className="so-legend-item"><span className="so-swatch" style={{ background: RETURNING_COLOR }} />Returning</span>
                                </div>
                                <div style={{ width: "100%", height: 260 }}>
                                    <ResponsiveContainer>
                                        <BarChart data={r.months} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap="30%">
                                            <CartesianGrid vertical={false} stroke="#ececf0" />
                                            <XAxis dataKey="month" tickFormatter={(m) => formatMonth(m, true)} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#75758a" }} />
                                            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} tick={{ fontSize: 11, fill: "#75758a" }} />
                                            <Tooltip content={<MonthTip />} cursor={{ fill: "rgba(23,23,28,0.05)" }} />
                                            <Bar dataKey="newCustomers" stackId="c" fill={NEW_COLOR} stroke="#fff" strokeWidth={2} maxBarSize={28} />
                                            <Bar dataKey="returningCustomers" stackId="c" fill={RETURNING_COLOR} stroke="#fff" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={28} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </>
                        ) : (
                            <div className="so-table-wrap">
                                <table className="so-table">
                                    <thead><tr><th>Month</th><th className="so-num">New</th><th className="so-num">Returning</th><th className="so-num">Total</th></tr></thead>
                                    <tbody>
                                        {[...r.months].reverse().map((m) => (
                                            <tr key={m.month}>
                                                <td>{formatMonth(m.month)}</td>
                                                <td className="so-num">{formatNumber(m.newCustomers)}</td>
                                                <td className="so-num">{formatNumber(m.returningCustomers)}</td>
                                                <td className="so-num">{formatNumber(m.newCustomers + m.returningCustomers)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>

                    <div style={{ height: 16 }} />
                    <div>
                        <Card title="Top 5 customers" subtitle={`By amount invoiced · ${periodText(period).toLowerCase()}`}
                            actions={<ExportButton onExport={exportTop} disabled={loading || !r?.top?.length} />}>
                            {loading ? <Skeleton height={300} /> : !r?.top?.length ? <EmptyState compact title="No customers in this period" /> : (
                                <div className="so-table-wrap">
                                    <table className="so-table">
                                        <thead><tr><th>#</th><th>Customer</th><th className="so-num">Invoices</th><th className="so-num">Spent</th><th>Last visit</th></tr></thead>
                                        <tbody>
                                            {r.top.slice(0, 5).map((c, i) => (
                                                <tr key={c.customerId}>
                                                    <td className="so-cell-sub">{i + 1}</td>
                                                    <td>
                                                        <div className="so-cell-main">{c.name || "—"}</div>
                                                        <div className="so-cell-sub">{c.phone}{c.branches > 1 ? ` · ${c.branches} branches` : ""}</div>
                                                    </td>
                                                    <td className="so-num">
                                                        {formatNumber(c.invoices)}
                                                        <div className="so-cell-sub">{formatNumber(c.lifetimeInvoices)} in all</div>
                                                    </td>
                                                    <td className="so-num">{formatMoney(c.spent)}</td>
                                                    <td style={{ whiteSpace: "nowrap" }}>{formatDate(c.lastVisit)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Card>
                    </div>
                </>
            )}
        </>
    );
}
