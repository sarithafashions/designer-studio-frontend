// My work: what the tailor master did in a period (GET /reports/my-activity) — items cut, tailor assignments
// (re-assignments included), all actions, busiest day — and a chart: Today / Yesterday / This week = last 7 days,
// This month = week by week, This year = month by month, Custom = by day (≤ 31 days), month (≤ 366) or year.
// Instant range pills (Custom applies once both dates are picked). Range lives in the URL.
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiActivity, FiCalendar, FiRefreshCw } from "react-icons/fi";
import { getMyActivity } from "../../../api/reports.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { toast } from "../../../utils/toast.js";
import { PageHeader, Button, Card, KpiCard, ErrorBox, Skeleton } from "../components/ui.jsx";
import { formatDate, formatNumber } from "../lib/format.js";
import { daysBetween } from "../lib/period.js";
import { WORK_RANGES, rangeOf, busiestDay, chartPlan, groupBars, chunkRange } from "./desk.js";
import { FilterPills } from "../../shared/production/DeskParts.jsx";
import DateField from "../components/DateField.jsx";
import WorkChart from "./WorkChart.jsx";

const MAX_DAYS = 3660; // ten years
const UNITS = { day: "Day", week: "Week", month: "Month", year: "Year" };

/** my-activity for any length: read in pieces of 366 days and merged. */
const fetchActivity = async ({ from, to }) => {
    const parts = await Promise.all(chunkRange(from, to).map((r) => getMyActivity(r)));
    const countsByType = {};
    parts.forEach((p) => Object.entries(p?.countsByType || {}).forEach(([k, v]) => {
        countsByType[k] = (countsByType[k] || 0) + Number(v || 0);
    }));
    return {
        total: parts.reduce((n, p) => n + Number(p?.total || 0), 0),
        countsByType,
        daily: parts.flatMap((p) => p?.daily || []),
    };
};

/**
 * My work (shared by the production roles). tiles: the first two cards, by activity type:
 * [{type: "TAILOR_MASTER_CUTTING", label: "Items cut", foot: "Marked as cutting", icon: <FiScissors />}, …]
 */
export default function MyWork({ tiles, title = "My work" }) {
    const [params, setParams] = useSearchParams();
    const range = WORK_RANGES.some((r) => r.key === params.get("dateRange")) ? params.get("dateRange") : "week";
    const applied = range === "custom" ? { from: params.get("startDate") || "", to: params.get("endDate") || "" } : rangeOf(range);
    const [custom, setCustom] = useState({ from: applied.from, to: applied.to });
    const [state, setState] = useState({ loading: true, data: null, chart: null, error: "" });
    const plan = chartPlan(range, applied);

    // The chart period equals the selected one except for Today / Yesterday / This week (last 7 days).
    const load = useCallback(() => {
        if (!applied.from || !applied.to) {
            setState({ loading: false, data: null, chart: null, error: "" });
            return;
        }
        setState((s) => ({ ...s, loading: true, error: "" }));
        const sameRange = plan.from === applied.from && plan.to === applied.to;
        Promise.all([fetchActivity(applied), sameRange ? null : fetchActivity(plan)])
            .then(([data, chart]) => setState({ loading: false, data, chart: chart || data, error: "" }))
            .catch((err) => setState({ loading: false, data: null, chart: null, error: getErrorMessage(err, "Could not load your work.") }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [applied.from, applied.to, plan.from, plan.to]);
    useEffect(() => {
        load();
    }, [load]);

    const pick = (key) => {
        if (key === "custom") {
            // Show the date fields; the report reloads once both dates are valid.
            setCustom({ from: "", to: "" });
            setParams({ dateRange: "custom" }, { replace: true });
            return;
        }
        setParams(key === "week" ? {} : { dateRange: key }, { replace: true });
    };
    const setCustomDate = (field, value) => {
        const next = { ...custom, [field]: value || "" };
        setCustom(next);
        if (!next.from || !next.to) return;
        if (next.to < next.from) return toast.warning("The end date must not be before the start date.");
        if (daysBetween(next.from, next.to) > MAX_DAYS) return toast.warning("Please pick at most 10 years.");
        setParams({ dateRange: "custom", startDate: next.from, endDate: next.to }, { replace: true });
        return undefined;
    };

    const d = state.data;
    const byType = d?.countsByType || {};
    const top = busiestDay(d?.daily);
    const label = applied.from === applied.to ? formatDate(applied.from) : `${formatDate(applied.from)} – ${formatDate(applied.to)}`;

    return (
        <>
            <PageHeader
                eyebrow={title}
                title={title}
                subtitle={applied.from && applied.to ? `What you did · ${label}` : "Pick a start and an end date"}
                actions={
                    <Button variant="ghost" size="sm" onClick={load} disabled={state.loading}>
                        <FiRefreshCw aria-hidden /> Refresh
                    </Button>
                }
            />
            <div className="so-filterbar">
                <div className="so-toolbar">
                    <FilterPills label="Period" options={WORK_RANGES} value={range} onChange={pick} />
                    {range === "custom" && (
                        <div className="tm-custom-range">
                            <DateField ariaLabel="Start date" value={custom.from} onChange={(v) => setCustomDate("from", v)} />
                            <span className="so-cell-sub">to</span>
                            <DateField ariaLabel="End date" value={custom.to} onChange={(v) => setCustomDate("to", v)} />
                        </div>
                    )}
                </div>
            </div>

            {state.error ? (
                <ErrorBox message={state.error} onRetry={load} />
            ) : (
                <>
                    <div className="so-grid so-dl-kpis k4" style={{ marginBottom: 16 }}>
                        {tiles.map((t) => (
                            <KpiCard key={t.type} loading={state.loading} icon={t.icon} label={t.label}
                                value={formatNumber(byType[t.type] || 0)} footer={t.foot} />
                        ))}
                        <KpiCard loading={state.loading} icon={<FiActivity aria-hidden />} label="All actions"
                            value={formatNumber(d?.total || 0)} footer="Everything recorded for you" />
                        <KpiCard loading={state.loading} icon={<FiCalendar aria-hidden />} label="Busiest day"
                            value={top ? formatDate(top.date) : "—"} footer={top ? `${formatNumber(top.count)} action${top.count === 1 ? "" : "s"}` : "No work recorded"} />
                    </div>
                    <Card title={`Performance · ${plan.title}`} subtitle="Every action recorded for you">
                        {state.loading ? <Skeleton height={220} /> : <WorkChart bars={groupBars(state.chart?.daily || [], plan.group)} unit={UNITS[plan.group]} />}
                    </Card>
                </>
            )}
        </>
    );
}
