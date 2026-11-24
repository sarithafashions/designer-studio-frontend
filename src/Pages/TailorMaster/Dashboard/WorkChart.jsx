// The tailor master's own work per day (cuts + tailor assignments): one series, so no legend box —
// the card title names it. Hover tooltip; a table view for exact numbers.
import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Segmented, EmptyState } from "../../shared/components/ui.jsx";
import { formatDayShort, formatDate, formatNumber } from "../../shared/lib/format.js";

const COLOR = "#1863dc"; // validated palette, first categorical slot
const VIEWS = [
    { key: "chart", label: "Chart" },
    { key: "table", label: "Table" },
];

function ChartTip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload;
    return (
        <div className="so-tooltip">
            <div className="so-tooltip-title">{formatDate(row.date)}</div>
            <div>
                <b>{formatNumber(row.count)}</b> action{row.count === 1 ? "" : "s"}
            </div>
        </div>
    );
}

export default function WorkChart({ days = [] }) {
    const [view, setView] = useState("chart");
    const data = days.map((d) => ({ ...d, label: formatDayShort(d.date) }));
    if (!data.some((d) => d.count)) {
        return <EmptyState compact title="No work recorded in these days" message="Cuts and tailor assignments show up here." />;
    }
    return (
        <div className="so-stack" style={{ gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Segmented options={VIEWS} value={view} onChange={setView} label="Chart or table" />
            </div>
            {view === "chart" ? (
                <div style={{ width: "100%", height: 220 }}>
                    <ResponsiveContainer>
                        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                            <CartesianGrid vertical={false} stroke="#ececf0" />
                            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#75758a" }} interval="preserveStartEnd" />
                            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#75758a" }} width={40} />
                            <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(23,23,28,0.05)" }} />
                            <Bar dataKey="count" fill={COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="so-table-wrap" style={{ maxHeight: 240, overflow: "auto" }}>
                    <table className="so-table">
                        <thead>
                            <tr>
                                <th>Day</th>
                                <th className="so-num">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...data].reverse().map((d) => (
                                <tr key={d.date}>
                                    <td>{formatDate(d.date)}</td>
                                    <td className="so-num">{formatNumber(d.count)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
