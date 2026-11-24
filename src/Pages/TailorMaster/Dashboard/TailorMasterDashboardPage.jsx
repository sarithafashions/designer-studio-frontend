// TAILOR_MASTER dashboard: what is waiting (new / cutting / with tailors / late), the tailor master's own work
// (today + last 14 days), items to cut or assign that are due soonest, and how busy each tailor is.
// Data: /items/queue/summary, /reports/my-activity (today and 14 days), /items/queue (dueSoonest), tailors withLoad.
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    FiInbox, FiScissors, FiUsers, FiAlertTriangle, FiCheckCircle, FiUserPlus, FiCalendar, FiClock, FiRefreshCw, FiArrowRight,
} from "react-icons/fi";
import { getQueueSummary, getQueue, listTailorsWithLoad } from "../../../api/production.js";
import { getMyActivity } from "../../../api/reports.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { PageHeader, Card, KpiCard, Button, BarList, EmptyState, ErrorBox, Skeleton } from "../../shared/components/ui.jsx";
import { ItemStatusBadge } from "../../shared/components/status.jsx";
import { formatDate, formatNumber } from "../../shared/lib/format.js";
import { todayIST, addDays } from "../../shared/lib/period.js";
import { getUserName } from "../../../utils/authUtils.jsx";
import { itemLabel, loadText, byLoad } from "../lib/workplace.js";
import { DueBadge } from "../Workplace/OrderCard.jsx";
import WorkChart from "./WorkChart.jsx";

const CUT = "TAILOR_MASTER_CUTTING";
const ASSIGNED = "ASSIGNED_TO_TAILOR";
const CHART_DAYS = 14;
const AUTO_REFRESH_MS = 3 * 60 * 1000;

const greeting = () => {
    const h = Number(new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }));
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

/** Settled promise → {data} or {error}. */
const settle = (p) => p.then((data) => ({ data })).catch((err) => ({ error: getErrorMessage(err) }));

export default function TailorMasterDashboardPage() {
    const navigate = useNavigate();
    const [s, setS] = useState({ loading: true });

    const load = useCallback((silent = false) => {
        if (!silent) setS((prev) => ({ ...prev, loading: true }));
        const today = todayIST();
        return Promise.all([
            settle(getQueueSummary()),
            settle(getMyActivity({ from: today, to: today })),
            settle(getMyActivity({ from: addDays(today, -(CHART_DAYS - 1)), to: today })),
            settle(getQueue({ statuses: ["ORDER_ACCEPTED", "CUTTING"], sort: "dueSoonest", pageSize: 8 })),
            settle(listTailorsWithLoad()),
        ]).then(([summary, today_, recent, dueSoon, tailors]) =>
            setS({ loading: false, summary, today: today_, recent, dueSoon, tailors }));
    }, []);
    useEffect(() => {
        load();
    }, [load]);
    useEffect(() => {
        const t = setInterval(() => document.visibilityState === "visible" && load(true), AUTO_REFRESH_MS);
        return () => clearInterval(t);
    }, [load]);

    const sum = s.summary?.data;
    const counts = sum?.countsByStatus || {};
    const mine = s.today?.data?.countsByType || {};
    const recent = s.recent?.data;
    const recentCounts = recent?.countsByType || {};
    const toWorkplace = (query = "") => navigate(`/tailorMaster/workplace${query}`);
    const name = getUserName();

    const tile = (key, onClick, icon, label, value, footer) => (
        <button key={key} type="button" className="so-kpi-btn" onClick={onClick}>
            <KpiCard loading={s.loading} icon={icon} label={label} value={value} footer={footer} />
        </button>
    );

    return (
        <>
            <PageHeader
                eyebrow="Tailor master"
                title={`${greeting()}${name ? `, ${name}` : ""}`}
                subtitle={formatDate(todayIST())}
                actions={
                    <div className="so-actions">
                        <Button variant="ghost" size="sm" onClick={() => load()} disabled={s.loading}>
                            <FiRefreshCw aria-hidden /> Refresh
                        </Button>
                        <Button size="sm" onClick={() => toWorkplace()}>
                            <FiScissors aria-hidden /> Open workplace
                        </Button>
                    </div>
                }
            />

            {s.summary?.error && <ErrorBox message={`Could not load your queue: ${s.summary.error}`} onRetry={() => load()} />}

            {sum?.late > 0 && (
                <button type="button" className="so-note tm-late-note" onClick={() => toWorkplace("?tab=all&due=overdue")}>
                    <FiAlertTriangle aria-hidden />
                    <span>
                        <b>{sum.late}</b> item{sum.late === 1 ? " is" : "s are"} past the delivery date — open them
                    </span>
                </button>
            )}

            <h2 className="tm-section">Waiting in your stages</h2>
            <div className="so-grid so-grid-kpi tm-kpis" style={{ marginBottom: 20 }}>
                {tile("new", () => toWorkplace(), <FiInbox aria-hidden />, "New — to cut", formatNumber(counts.ORDER_ACCEPTED), "Not started yet")}
                {tile("cut", () => toWorkplace("?tab=cutting"), <FiScissors aria-hidden />, "Cutting — to assign", formatNumber(counts.CUTTING), "Waiting for a tailor")}
                {tile("tailors", () => toWorkplace("?tab=tailors"), <FiUsers aria-hidden />, "With tailors",
                    formatNumber((counts.TAILOR_ASSIGNED || 0) + (counts.STITCHING || 0)),
                    `${formatNumber(counts.TAILOR_ASSIGNED)} waiting · ${formatNumber(counts.STITCHING)} stitching`)}
                {tile("late", () => toWorkplace("?tab=all&due=overdue"), <FiAlertTriangle aria-hidden />, "Late", formatNumber(sum?.late),
                    sum ? `${formatNumber(sum.dueToday)} due today · ${formatNumber(sum.dueThisWeek)} this week` : "")}
            </div>

            <h2 className="tm-section">Your work today</h2>
            <div className="so-grid so-grid-kpi tm-kpis" style={{ marginBottom: 20 }}>
                {tile("cutToday", () => toWorkplace("?tab=cutting"), <FiCheckCircle aria-hidden />, "Cut today", formatNumber(mine[CUT]), "Moved to cutting")}
                {tile("assignedToday", () => toWorkplace("?tab=tailors"), <FiUserPlus aria-hidden />, "Assigned today", formatNumber(mine[ASSIGNED]), "Incl. re-assignments")}
                {tile("dueToday", () => toWorkplace("?tab=all&due=today"), <FiCalendar aria-hidden />, "Due today", formatNumber(sum?.dueToday), "In your stages")}
                {tile("orders", () => toWorkplace("?tab=all"), <FiClock aria-hidden />, "Open orders", formatNumber(sum?.orders), `${formatNumber(sum?.totalItems)} items`)}
            </div>

            <div className="so-grid so-grid-main" style={{ marginBottom: 16 }}>
                <Card
                    title={`Your work — last ${CHART_DAYS} days`}
                    subtitle={recent ? `${formatNumber(recentCounts[CUT])} cut · ${formatNumber(recentCounts[ASSIGNED])} tailor assignments` : undefined}
                >
                    {s.loading ? <Skeleton height={220} /> : s.recent?.error ? <ErrorBox message={s.recent.error} /> : <WorkChart days={recent?.daily || []} />}
                </Card>

                <Card title="Tailors" subtitle="Current load: waiting + stitching">
                    {s.loading ? (
                        <Skeleton height={160} />
                    ) : s.tailors?.error ? (
                        <ErrorBox message={s.tailors.error} />
                    ) : !(s.tailors?.data || []).length ? (
                        <EmptyState compact title="No tailors in your shop" />
                    ) : (
                        <BarList
                            rows={byLoad(s.tailors.data).reverse().map((t) => ({
                                label: t.name || "Tailor",
                                value: (t.assigned || 0) + (t.inProgress || 0),
                                meta: loadText(t),
                            }))}
                            emptyText="No tailor has work right now"
                        />
                    )}
                </Card>
            </div>

            <Card
                title="Due soonest — still to cut or assign"
                subtitle="New and cutting items, nearest delivery date first"
                actions={
                    <Button variant="ghost" size="sm" onClick={() => toWorkplace("?tab=all")}>
                        Workplace <FiArrowRight aria-hidden />
                    </Button>
                }
            >
                {s.loading ? (
                    <Skeleton height={160} />
                ) : s.dueSoon?.error ? (
                    <ErrorBox message={s.dueSoon.error} />
                ) : !(s.dueSoon?.data?.content || []).length ? (
                    <EmptyState compact title="Nothing to cut or assign" message="New orders appear here as soon as they are created." />
                ) : (
                    <div className="so-list">
                        {s.dueSoon.data.content.map((item) => {
                            const open = () => navigate(`/tailorMaster/workplace/${encodeURIComponent(item.invoiceId)}`);
                            return (
                                <div key={`${item.invoiceId}-${item.itemUniqueId}`} className="so-list-row so-row-link" role="button" tabIndex={0}
                                    onClick={open} onKeyDown={(e) => e.key === "Enter" && open()}>
                                    <div className="so-list-main">
                                        <div className="so-list-title">{itemLabel(item)} · {item.customerName || "Customer"}</div>
                                        <div className="so-list-meta">
                                            <span className="so-mono">{item.invoiceId}</span>
                                        </div>
                                    </div>
                                    <div className="so-list-side tm-due-side">
                                        <ItemStatusBadge status={item.status} />
                                        <DueBadge dueDate={item.dueDate} daysOverdue={item.daysOverdue} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>
        </>
    );
}
