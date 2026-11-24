// Cash-flow trend: Collected and Expenses as bars, Invoiced as a line — one ₹ axis.
// Series colours are fixed (validated palette in shopOwner.css); legend + tooltip + a table view.
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { formatMoney, formatMoneyAxis, formatDayShort, formatMonth, formatDate, formatNumber } from "../lib/format.js";
import { Segmented, EmptyState } from "./ui.jsx";

const SERIES = [
    { key: "invoicedAmount", label: "Invoiced", color: "#1863dc", kind: "line" },
    { key: "collected", label: "Collected", color: "#1f9d6b", kind: "bar" },
    { key: "expenses", label: "Expenses", color: "#e5603f", kind: "bar" },
];

const VIEWS = [
    { key: "chart", label: "Chart" },
    { key: "table", label: "Table" },
];

// rows may come pre-grouped (see lib/trend.js) with their own key / label (axis) / title (tooltip, table); otherwise
// they are daily rows ({date}) or monthly rows ({month}, with monthly=true).
export default function TrendChart({ rows, monthly, view, onViewChange, fullscreen = false }) {
    const grouped = rows.some((r) => r.title);
    const data = rows.map((r) => ({
        ...r,
        key: r.key || r.month || r.date,
        label: r.label || (monthly ? formatMonth(r.month, true) : formatDayShort(r.date)),
        title: r.title || (monthly ? formatMonth(r.month) : formatDate(r.date)),
    }));
    const hasData = data.some((r) => r.invoicedAmount || r.collected || r.expenses);

    const totals = SERIES.reduce((acc, s) => ({ ...acc, [s.key]: data.reduce((sum, r) => sum + (Number(r[s.key]) || 0), 0) }), {});

    return (
        <div className="so-stack" style={{ gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div className="so-legend" aria-label="Legend">
                    {SERIES.map((s) => (
                        <span className="so-legend-item" key={s.key}>
                            <span
                                className={s.kind === "line" ? "so-swatch-line" : "so-swatch"}
                                style={{ background: s.color }}
                            />
                            {s.label} <b style={{ color: "var(--so-primary)" }}>{formatMoney(totals[s.key])}</b>
                        </span>
                    ))}
                </div>
                <Segmented options={VIEWS} value={view} onChange={onViewChange} label="Chart or table" />
            </div>

            {!hasData ? (
                <EmptyState title="No sales, payments or expenses in this period" />
            ) : view === "table" ? (
                <div className="so-table-wrap" style={{ maxHeight: fullscreen ? "70vh" : 300, overflowY: "auto" }}>
                    <table className="so-table">
                        <thead>
                            <tr>
                                <th>{grouped ? "Period" : monthly ? "Month" : "Date"}</th>
                                <th className="so-num">Invoices</th>
                                <th className="so-num">Invoiced</th>
                                <th className="so-num">Collected</th>
                                <th className="so-num">Expenses</th>
                                <th className="so-num">Net</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...data].reverse().map((r) => (
                                <tr key={r.key}>
                                    <td>{r.title}</td>
                                    <td className="so-num">{formatNumber(r.invoiceCount)}</td>
                                    <td className="so-num">{formatMoney(r.invoicedAmount)}</td>
                                    <td className="so-num">{formatMoney(r.collected)}</td>
                                    <td className="so-num">{formatMoney(r.expenses)}</td>
                                    <td className="so-num">{formatMoney(r.netCashFlow)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="so-chart" style={fullscreen ? { height: "65vh", minHeight: 420 } : undefined}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="20%">
                            <CartesianGrid vertical={false} stroke="#e5e7eb" />
                            <XAxis
                                dataKey="label"
                                tickLine={false}
                                axisLine={{ stroke: "#d9d9dd" }}
                                tick={{ fontSize: 12, fill: "#75758a" }}
                                minTickGap={16}
                            />
                            <YAxis
                                tickFormatter={formatMoneyAxis}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 12, fill: "#75758a" }}
                                width={64}
                            />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(23,23,28,0.04)" }} />
                            <Bar dataKey="collected" name="Collected" fill="#1f9d6b" radius={[4, 4, 0, 0]} maxBarSize={28} />
                            <Bar dataKey="expenses" name="Expenses" fill="#e5603f" radius={[4, 4, 0, 0]} maxBarSize={28} />
                            <Line
                                dataKey="invoicedAmount"
                                name="Invoiced"
                                stroke="#1863dc"
                                strokeWidth={2}
                                dot={data.length <= 12 ? { r: 4, fill: "#1863dc", stroke: "#fff", strokeWidth: 2 } : false}
                                activeDot={{ r: 5, fill: "#1863dc", stroke: "#fff", strokeWidth: 2 }}
                                type="monotone"
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}

function ChartTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const r = payload[0].payload;
    return (
        <div className="so-tooltip">
            <div className="so-tooltip-title">{r.title}</div>
            {SERIES.map((s) => (
                <div className="so-tooltip-row" key={s.key}>
                    <span>
                        <span className={s.kind === "line" ? "so-swatch-line" : "so-swatch"} style={{ background: s.color }} />
                        {s.label}
                    </span>
                    <b>{formatMoney(r[s.key])}</b>
                </div>
            ))}
            <div className="so-tooltip-row so-tooltip-sep">
                <span>Net cash flow</span>
                <b>{formatMoney(r.netCashFlow)}</b>
            </div>
            <div className="so-tooltip-row">
                <span>Invoices</span>
                <b>{formatNumber(r.invoiceCount)}</b>
            </div>
        </div>
    );
}
