// Platform owner: compare 2–5 branches side by side for a period, plus a month-by-month chart (last 12 months)
// of one figure per branch. Branches + period live in the URL (?shops=a,b&period=…). View only.
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { getShopsOverview, getMonthlyFinancials } from "../../../api/reports.js";
import { PageHeader, Card, Segmented, EmptyState, ErrorBox, Skeleton, Button } from "../../shared/components/ui.jsx";
import PeriodFilter from "../../shared/components/PeriodFilter.jsx";
import { rangeParams, todayIST } from "../../shared/lib/period.js";
import { formatMoney, formatMoneyAxis, formatNumber, formatMonth } from "../../shared/lib/format.js";
import { periodFrom, periodText, withPeriod, useSection, branchStyle, swatchBackground } from "../lib/owner.js";
import ExportButton from "../../shared/components/ExportButton.jsx";
import { exportXlsx, exportFileName } from "../../shared/lib/exportXlsx.js";


/** Rows of the side-by-side table. better: "high" | "low" | null (which value is marked as best). */
const METRICS = [
    { key: "invoicedAmount", label: "Sales (invoiced)", money: true, better: "high" },
    { key: "invoiceCount", label: "Invoices", better: "high" },
    { key: "avgBill", label: "Average bill", money: true, better: "high" },
    { key: "collected", label: "Collected", money: true, better: "high" },
    { key: "expenses", label: "Expenses", money: true, better: "low" },
    { key: "netCashFlow", label: "Net cash flow", money: true, better: "high" },
    { key: "deliveredInvoiceCount", label: "Delivered orders", better: "high" },
    { key: "pendingOrders", label: "Open orders (now)", better: null },
    { key: "outstanding", label: "Outstanding (now)", money: true, better: "low" },
    { key: "pettyCash", label: "Petty cash (now)", money: true, better: null },
    { key: "employeeCount", label: "Staff", better: null },
];

const CHART_METRICS = [
    { key: "invoicedAmount", label: "Sales" },
    { key: "collected", label: "Collected" },
    { key: "netCashFlow", label: "Net cash flow" },
];
const VIEWS = [
    { key: "chart", label: "Chart" },
    { key: "table", label: "Table" },
];

/** First day of the month, 11 months before this one -> today: the last 12 months. */
const last12Months = () => {
    const today = todayIST();
    const [y, m] = today.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1 - 11, 1));
    return { from: start.toISOString().slice(0, 10), to: today };
};

function ChartTip({ active, payload, label, branches }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="so-tooltip">
            <div className="so-tooltip-title">{formatMonth(label)}</div>
            {payload.map((p) => (
                <div key={p.dataKey} className="ow-tip-row">
                    <span className="so-swatch-line" style={{ background: p.color }} />
                    <span>{branches.find((b) => b.shopId === p.dataKey)?.shopName || "Branch"}</span>
                    <b>{formatMoney(p.value)}</b>
                </div>
            ))}
        </div>
    );
}

export default function ComparePage() {
    const [params, setParams] = useSearchParams();
    const period = periodFrom(params);
    const periodKey = `${period.key}|${period.from}|${period.to}`;
    const picked = (params.get("shops") || "").split(",").filter(Boolean);
    const [metric, setMetric] = useState("invoicedAmount");
    const [view, setView] = useState("chart");

    const setPicked = (ids) => setParams((cur) => {
        const next = new URLSearchParams(cur);
        if (ids.length) next.set("shops", ids.join(","));
        else next.delete("shops");
        return next;
    }, { replace: true });

    const [overview, reloadOverview] = useSection(() => getShopsOverview(rangeParams(period)), [periodKey]);
    const all = useMemo(() => [...(overview.data || [])].sort((a, b) => (a.shopName || "").localeCompare(b.shopName || "")), [overview.data]);
    // first visit: the 3 biggest branches by sales
    const ids = picked.length ? picked : [...all].sort((a, b) => (b.invoicedAmount || 0) - (a.invoicedAmount || 0)).slice(0, 3).map((b) => b.shopId);
    const chosen = ids.map((id) => all.find((b) => b.shopId === id)).filter(Boolean)
        .map((b) => ({ ...b, avgBill: b.invoiceCount ? b.invoicedAmount / b.invoiceCount : 0 }));
    // no limit on branches: colours follow the selection order (9th on: same colours, dashed lines)
    const styleOf = (id) => branchStyle(Math.max(0, ids.indexOf(id)));
    const colorOf = (id) => styleOf(id).color;
    const toggle = (id) => setPicked(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

    const months = useMemo(last12Months, []);
    const idsKey = ids.join(",");
    const [series, reloadSeries] = useSection(
        () => Promise.all(ids.map((id) => getMonthlyFinancials({ shopId: id, ...months }).then((rows) => ({ id, rows: rows || [] })))),
        [idsKey],
    );
    const chartRows = useMemo(() => {
        const byMonth = new Map();
        (series.data || []).forEach(({ id, rows }) => rows.forEach((r) => {
            if (!byMonth.has(r.month)) byMonth.set(r.month, { month: r.month });
            byMonth.get(r.month)[id] = r[metric] || 0;
        }));
        return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
    }, [series.data, metric]);

    const best = (m) => {
        if (!m.better || chosen.length < 2) return null;
        const values = chosen.map((b) => b[m.key] || 0);
        const target = m.better === "high" ? Math.max(...values) : Math.min(...values);
        return values.filter((v) => v === target).length === 1 ? target : null;
    };

    // both tables are built from loaded data: exported as shown
    const branchList = chosen.map((b) => b.shopName || "Branch").join(", ");
    // one row per branch, one column per figure (a sheet column holds one kind of value); average bill as a plain
    // number so the sheet's money total does not add averages up
    const exportSideBySide = () => exportXlsx({
        fileName: exportFileName("Compare-branches"),
        sheetName: "Side by side",
        title: "All branches · Compare branches",
        filters: [["Branches", branchList], ["Period", periodText(period)]],
        columns: [
            { header: "Branch", value: (b) => b.shopName || "Branch" },
            ...METRICS.map((m) => ({
                header: m.label,
                value: (b) => (m.key === "avgBill" ? Math.round((b[m.key] || 0) * 100) / 100 : b[m.key] || 0),
                type: m.money && m.key !== "avgBill" ? "money" : "number",
            })),
        ],
        rows: chosen,
    });
    const exportMonths = () => {
        const figure = CHART_METRICS.find((c) => c.key === metric)?.label;
        return exportXlsx({
            fileName: exportFileName("Compare-branches", figure, "by-month"),
            sheetName: "Month by month",
            title: `All branches · ${figure} month by month`,
            filters: [["Branches", branchList], ["Figure", figure], ["Months", "Last 12 months"]],
            columns: [
                { header: "Month", value: (r) => formatMonth(r.month) },
                ...chosen.map((b) => ({ header: b.shopName || "Branch", value: (r) => r[b.shopId] || 0, type: "money" })),
            ],
            rows: [...chartRows].reverse(),
        });
    };

    return (
        <>
            <PageHeader eyebrow="All branches" title="Compare branches" subtitle={`${periodText(period)} · pick 2 or more branches`}
                actions={<PeriodFilter value={period} onChange={(p) => setParams((cur) => withPeriod(cur, p), { replace: true })} />} />

            {overview.error ? (
                <ErrorBox message={overview.error} onRetry={reloadOverview} />
            ) : overview.loading ? (
                <Skeleton height={320} />
            ) : all.length < 2 ? (
                <EmptyState title="Comparing needs at least 2 branches" />
            ) : (
                <>
                    <div className="so-actions" style={{ marginBottom: 8 }}>
                        <span className="so-hint">{ids.length} of {all.length} branches selected</span>
                        <Button variant="ghost" size="sm" disabled={ids.length === all.length} onClick={() => setPicked(all.map((b) => b.shopId))}>Select all</Button>
                        <Button variant="ghost" size="sm" disabled={!picked.length} onClick={() => setPicked([])}>Clear</Button>
                    </div>
                    <div className="ow-picker" role="group" aria-label="Branches to compare">
                        {all.map((b) => {
                            const on = ids.includes(b.shopId);
                            return (
                                <button key={b.shopId} type="button" className={`tm-pill ${on ? "on" : ""}`} aria-pressed={on}
                                    onClick={() => toggle(b.shopId)}>
                                    {on && <span className="ow-dot" style={{ background: colorOf(b.shopId) }} aria-hidden />}
                                    {b.shopName || "Branch"}
                                </button>
                            );
                        })}
                    </div>

                    {chosen.length < 2 ? (
                        <EmptyState title="Pick at least 2 branches" message="Click the branch names above." />
                    ) : (
                        <>
                            <Card title="Side by side" subtitle={`${periodText(period)} · bold = best of the selected branches`}
                                actions={<ExportButton onExport={exportSideBySide} />}>
                                <div className="so-table-wrap">
                                    <table className="so-table">
                                        <thead>
                                            <tr>
                                                <th />
                                                {chosen.map((b) => (
                                                    <th key={b.shopId} className="so-num">
                                                        <span className="ow-branch-th"><span className="so-swatch" style={{ background: swatchBackground(styleOf(b.shopId)) }} />{b.shopName}</span>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {METRICS.map((m) => {
                                                const top = best(m);
                                                return (
                                                    <tr key={m.key}>
                                                        <td><span className="so-cell-main">{m.label}</span></td>
                                                        {chosen.map((b) => {
                                                            const v = b[m.key] || 0;
                                                            return (
                                                                <td key={b.shopId} className="so-num"
                                                                    style={{ fontWeight: top !== null && v === top ? 700 : undefined, color: m.key === "netCashFlow" && v < 0 ? "var(--so-danger)" : undefined }}>
                                                                    {m.money ? formatMoney(v) : formatNumber(v)}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>

                            <div style={{ height: 16 }} />
                            <Card title="Month by month" subtitle="Last 12 months"
                                actions={
                                    <div className="so-actions">
                                        <Segmented label="Figure" options={CHART_METRICS} value={metric} onChange={setMetric} />
                                        <Segmented label="Chart or table" options={VIEWS} value={view} onChange={setView} />
                                        <ExportButton onExport={exportMonths} disabled={series.loading || !!series.error || !chartRows.length} />
                                    </div>
                                }>
                                {series.error ? (
                                    <ErrorBox message={series.error} onRetry={reloadSeries} />
                                ) : series.loading ? (
                                    <Skeleton height={300} />
                                ) : !chartRows.length ? (
                                    <EmptyState compact title="No figures in the last 12 months" />
                                ) : view === "chart" ? (
                                    <>
                                        <div className="so-legend" style={{ marginBottom: 8 }}>
                                            {chosen.map((b) => (
                                                <span key={b.shopId} className="so-legend-item">
                                                    <span className="so-swatch-line" style={{ background: swatchBackground(styleOf(b.shopId)) }} />{b.shopName}
                                                </span>
                                            ))}
                                        </div>
                                        <div style={{ width: "100%", height: 300 }}>
                                            <ResponsiveContainer>
                                                <LineChart data={chartRows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                                                    <CartesianGrid vertical={false} stroke="#ececf0" />
                                                    <XAxis dataKey="month" tickFormatter={(m) => formatMonth(m, true)} tickLine={false} axisLine={false}
                                                        tick={{ fontSize: 11, fill: "#75758a" }} />
                                                    <YAxis tickFormatter={formatMoneyAxis} tickLine={false} axisLine={false} width={56}
                                                        tick={{ fontSize: 11, fill: "#75758a" }} />
                                                    <Tooltip content={<ChartTip branches={chosen} />} cursor={{ stroke: "#d9d9dd" }} />
                                                    {chosen.map((b) => (
                                                        <Line key={b.shopId} type="monotone" dataKey={b.shopId} name={b.shopName} stroke={colorOf(b.shopId)} strokeDasharray={styleOf(b.shopId).dash}
                                                            strokeWidth={2} dot={{ r: 3, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 5 }} connectNulls />
                                                    ))}
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </>
                                ) : (
                                    <div className="so-table-wrap">
                                        <table className="so-table">
                                            <thead>
                                                <tr>
                                                    <th>Month</th>
                                                    {chosen.map((b) => <th key={b.shopId} className="so-num">{b.shopName}</th>)}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[...chartRows].reverse().map((r) => (
                                                    <tr key={r.month}>
                                                        <td>{formatMonth(r.month)}</td>
                                                        {chosen.map((b) => <td key={b.shopId} className="so-num">{formatMoney(r[b.shopId] || 0)}</td>)}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </Card>
                        </>
                    )}
                </>
            )}
        </>
    );
}
