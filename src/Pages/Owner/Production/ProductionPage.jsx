// Platform owner: production health (GET /reports/production). All branches or one.
// Now: open items per stage, overdue, days in stage. Period: delivered orders, days to deliver, on-time %, and the
// average time items spend in each stage (the slowest stage is marked). Branch + period live in the URL. View only.
import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiLayers, FiAlertTriangle, FiClock, FiCheckCircle, FiTruck } from "react-icons/fi";
import { getProduction } from "../../../api/reports.js";
import { listShopSummaries } from "../../../api/owner.js";
import { PageHeader, Card, KpiCard, Badge, EmptyState, ErrorBox, Skeleton } from "../../shared/components/ui.jsx";
import { Select } from "../../shared/components/form.jsx";
import PeriodFilter from "../../shared/components/PeriodFilter.jsx";
import { rangeParams } from "../../shared/lib/period.js";
import { formatNumber } from "../../shared/lib/format.js";
import { periodFrom, periodText, withPeriod, useSection } from "../lib/owner.js";
import ExportButton from "../../shared/components/ExportButton.jsx";
import { exportXlsx, exportFileName } from "../../shared/lib/exportXlsx.js";

/** What each item status means on the floor. */
const STAGE_LABEL = {
    ORDER_ACCEPTED: "To cut",
    CUTTING: "Cut · waiting for a tailor",
    TAILOR_ASSIGNED: "With tailor · not started",
    STITCHING: "Stitching",
    SHOP_ASSISTANT_ASSIGNED: "With assistant · not started",
    HEMMING: "Hemming",
    IRONING: "Ironing",
    ORDER_COMPLETED: "Ready to deliver",
    READY: "Ready → delivered",
};
const SHORT = {
    ORDER_ACCEPTED: "To cut", CUTTING: "Cut", TAILOR_ASSIGNED: "Tailor (new)", STITCHING: "Stitching",
    SHOP_ASSISTANT_ASSIGNED: "Assistant (new)", HEMMING: "Hemming", IRONING: "Ironing", ORDER_COMPLETED: "Ready",
};

/** 30 h -> "1.3 days", 5 h -> "5 h". */
const duration = (hours) => (hours == null ? "—" : hours >= 24 ? `${(hours / 24).toFixed(1)} days` : `${Math.round(hours)} h`);
const days = (d) => (d == null ? "—" : `${d.toFixed(1)} d`);

const slowest = (times = []) => times.reduce((best, t) => (!best || t.avgHours > best.avgHours ? t : best), null);

export default function ProductionPage() {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const period = periodFrom(params);
    const shopId = params.get("shop") || "";
    const periodKey = `${period.key}|${period.from}|${period.to}`;
    const [report, reload] = useSection(() => getProduction({ ...(shopId ? { shopId } : {}), ...rangeParams(period) }), [periodKey, shopId]);
    const [names] = useSection(() => listShopSummaries().then((all) => all.map((b) => ({ value: b.shopId, label: b.shopName || "Branch" }))
        .sort((a, b) => a.label.localeCompare(b.label))), []);

    const data = report.data;
    const scope = data?.total;
    const t = scope?.turnaround;
    const times = t?.stageTimes || [];
    const bottleneck = slowest(times);
    const maxHours = Math.max(1, ...times.map((x) => x.avgHours));
    const branches = useMemo(() => data?.branches || [], [data]);
    const setShop = (id) => setParams((cur) => {
        const next = new URLSearchParams(cur);
        if (id) next.set("shop", id);
        else next.delete("shop");
        return next;
    }, { replace: true });
    const branch = shopId ? (names.data || []).find((o) => o.value === shopId)?.label || branches[0]?.shopName || "Branch" : "";

    // the report is loaded whole: the tables are exported as shown
    const exportStages = () => exportXlsx({
        fileName: exportFileName("Production-by-stage", branch),
        sheetName: "Work in progress",
        title: `${branch || "All branches"} · Work in progress by stage`,
        filters: [["Branch", branch || "All branches"], ["As of", "right now"]],
        columns: [
            { header: "Stage", value: (s) => STAGE_LABEL[s.status] || s.status },
            { header: "Items", value: (s) => s.items, type: "number" },
            { header: "Overdue", value: (s) => s.overdue, type: "number" },
            { header: "Avg days in stage", value: (s) => (s.avgDaysInStage == null ? null : Number(s.avgDaysInStage.toFixed(1))), type: "number" },
            { header: "Longest (days)", value: (s) => (s.maxDaysInStage == null ? null : Number(s.maxDaysInStage.toFixed(1))), type: "number" },
        ],
        rows: scope?.stages || [],
    });
    const exportBranches = () => exportXlsx({
        fileName: exportFileName("Production-by-branch"),
        sheetName: "Branches",
        title: "All branches · Production by branch",
        filters: [["Branch", "All branches"], ["Turnaround period", periodText(period)]],
        columns: [
            { header: "Branch", value: (b) => b.shopName || "Branch" },
            { header: "Items in production", value: (b) => b.openItems, type: "number" },
            { header: "Late items", value: (b) => b.overdueItems, type: "number" },
            ...Object.keys(SHORT).flatMap((k) => [
                { header: SHORT[k], value: (b) => b.stages.find((s) => s.status === k)?.items ?? 0, type: "number" },
                { header: `${SHORT[k]} late`, value: (b) => b.stages.find((s) => s.status === k)?.overdue ?? 0, type: "number" },
            ]),
            { header: "Delivered orders", value: (b) => b.turnaround?.deliveredOrders, type: "number" },
            { header: "Avg days to deliver", value: (b) => b.turnaround?.avgDaysToDeliver, type: "number" },
            { header: "On time %", value: (b) => b.turnaround?.onTimePercent, type: "number" },
            { header: "Slowest stage", value: (b) => { const slow = slowest(b.turnaround?.stageTimes); return slow ? STAGE_LABEL[slow.status] || slow.status : ""; } },
            { header: "Slowest stage avg time", value: (b) => { const slow = slowest(b.turnaround?.stageTimes); return slow ? duration(slow.avgHours) : ""; } },
        ],
        rows: branches,
    });

    return (
        <>
            <PageHeader
                eyebrow={shopId ? "Branch" : "All branches"}
                title={shopId ? `Production · ${branches[0]?.shopName || ""}` : "Production health"}
                subtitle={`Work in progress right now · turnaround of orders delivered ${periodText(period).toLowerCase()}`}
                actions={
                    <div className="so-actions" style={{ alignItems: "center" }}>
                        <label className="so-inline-field">
                            <span>Branch</span>
                            <Select aria-label="Branch" value={shopId} onChange={(e) => setShop(e.target.value)} placeholder="All branches" options={names.data || []} />
                        </label>
                        <PeriodFilter value={period} onChange={(p) => setParams((cur) => withPeriod(cur, p), { replace: true })} />
                    </div>
                }
            />

            {report.error ? (
                <ErrorBox message={report.error} onRetry={reload} />
            ) : (
                <>
                    <div className="so-grid ow-kpi5" style={{ marginBottom: 16 }}>
                        <KpiCard loading={report.loading} icon={<FiLayers aria-hidden />} label="Items in production" value={formatNumber(scope?.openItems)}
                            footer={<span>not delivered yet · now</span>} />
                        <KpiCard loading={report.loading} icon={<FiAlertTriangle aria-hidden />} label="Overdue items"
                            value={<span style={{ color: scope?.overdueItems ? "var(--so-danger)" : undefined }}>{formatNumber(scope?.overdueItems)}</span>}
                            footer={<span>past the delivery date</span>} />
                        <KpiCard loading={report.loading} icon={<FiTruck aria-hidden />} label="Orders delivered" value={formatNumber(t?.deliveredOrders)}
                            footer={<span>{periodText(period)}</span>} />
                        <KpiCard loading={report.loading} icon={<FiClock aria-hidden />} label="Order → delivery" value={t?.avgDaysToDeliver == null ? "—" : `${t.avgDaysToDeliver} days`}
                            footer={<span>average, delivered orders</span>} />
                        <KpiCard loading={report.loading} icon={<FiCheckCircle aria-hidden />} label="On time" value={t?.onTimePercent == null ? "—" : `${t.onTimePercent}%`}
                            footer={<span>{t?.withDueDate ? `of ${formatNumber(t.withDueDate)} with a due date` : "no due dates"}</span>} />
                    </div>

                    <div className="so-grid so-grid-2" style={{ marginBottom: 16 }}>
                        <Card title="Work in progress by stage" subtitle="Right now · days = how long items have been in that stage"
                            actions={<ExportButton onExport={exportStages} disabled={report.loading || !scope?.openItems} />}>
                            {report.loading ? <Skeleton height={300} /> : !scope?.openItems ? (
                                <EmptyState compact title="Nothing in production" />
                            ) : (
                                <div className="so-table-wrap">
                                    <table className="so-table">
                                        <thead>
                                            <tr><th>Stage</th><th className="so-num">Items</th><th className="so-num">Overdue</th><th className="so-num">Avg days</th><th className="so-num">Longest</th></tr>
                                        </thead>
                                        <tbody>
                                            {scope.stages.map((s) => (
                                                <tr key={s.status} className={s.items ? undefined : "ow-muted-row"}>
                                                    <td><span className="so-cell-main">{STAGE_LABEL[s.status] || s.status}</span></td>
                                                    <td className="so-num">{formatNumber(s.items)}</td>
                                                    <td className="so-num" style={{ color: s.overdue ? "var(--so-danger)" : undefined, fontWeight: s.overdue ? 600 : undefined }}>{formatNumber(s.overdue)}</td>
                                                    <td className="so-num">{days(s.avgDaysInStage)}</td>
                                                    <td className="so-num">{days(s.maxDaysInStage)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Card>

                        <Card title="Where the time goes" subtitle={`Average time per stage · orders delivered ${periodText(period).toLowerCase()}`}>
                            {report.loading ? <Skeleton height={300} /> : !times.length ? (
                                <EmptyState compact title="No delivered orders in this period" message="Pick a longer period." />
                            ) : (
                                <div className="ow-bars">
                                    {times.map((s) => (
                                        <div key={s.status} className="ow-bar-row" title={`${formatNumber(s.samples)} item stays measured`}>
                                            <div className="ow-bar-label">
                                                {STAGE_LABEL[s.status] || s.status}
                                                {bottleneck?.status === s.status && <Badge tone="warning">Slowest</Badge>}
                                            </div>
                                            <div className="ow-bar-track">
                                                <div className="ow-bar-fill" style={{ width: `${Math.max(2, (s.avgHours / maxHours) * 100)}%` }} />
                                            </div>
                                            <div className="ow-bar-value">{duration(s.avgHours)}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </div>

                    {!shopId && (
                        <Card title="Branches" subtitle="Items per stage right now (late ones in red) and turnaround in the period · click a branch for its view"
                            actions={<ExportButton onExport={exportBranches} disabled={report.loading || !branches.length} />}>
                            {report.loading ? <Skeleton height={200} /> : !branches.length ? <EmptyState compact title="No branches" /> : (
                                <div className="so-table-wrap">
                                    <table className="so-table">
                                        <thead>
                                            <tr>
                                                <th>Branch</th>
                                                {Object.keys(SHORT).map((k) => <th key={k} className="so-num">{SHORT[k]}</th>)}
                                                <th className="so-num">Delivered</th><th className="so-num">Days</th><th className="so-num">On time</th><th>Slowest stage</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {branches.map((b) => {
                                                const slow = slowest(b.turnaround?.stageTimes);
                                                return (
                                                    <tr key={b.shopId} className="so-row-link" tabIndex={0} onClick={() => setShop(b.shopId)}
                                                        onKeyDown={(e) => e.key === "Enter" && setShop(b.shopId)}>
                                                        <td>
                                                            <div className="so-cell-main">{b.shopName || "Branch"}</div>
                                                            <div className="so-cell-sub">{formatNumber(b.openItems)} items · <span style={{ color: b.overdueItems ? "var(--so-danger)" : undefined }}>{formatNumber(b.overdueItems)} late</span></div>
                                                        </td>
                                                        {b.stages.map((s) => (
                                                            <td key={s.status} className="so-num">
                                                                {s.items ? formatNumber(s.items) : <span className="so-cell-sub">0</span>}
                                                                {s.overdue > 0 && <div className="ow-late">{s.overdue} late</div>}
                                                            </td>
                                                        ))}
                                                        <td className="so-num">{formatNumber(b.turnaround?.deliveredOrders)}</td>
                                                        <td className="so-num">{b.turnaround?.avgDaysToDeliver ?? "—"}</td>
                                                        <td className="so-num">{b.turnaround?.onTimePercent == null ? "—" : `${b.turnaround.onTimePercent}%`}</td>
                                                        <td>{slow ? `${STAGE_LABEL[slow.status] || slow.status} · ${duration(slow.avgHours)}` : "—"}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Card>
                    )}
                    {shopId && (
                        <div className="so-actions" style={{ marginTop: 4 }}>
                            <button type="button" className="so-linkbtn" style={{ width: "auto" }} onClick={() => navigate(`/owner/branches/${encodeURIComponent(shopId)}`)}>
                                Open the branch page →
                            </button>
                        </div>
                    )}
                </>
            )}
        </>
    );
}
