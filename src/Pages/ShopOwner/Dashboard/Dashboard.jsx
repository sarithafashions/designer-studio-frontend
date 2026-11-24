// SHOP_OWNER Dashboard: period filter, KPIs (with change vs the previous period), cash-flow trend,
// payment-method / expense-category splits, production stages and today's deliveries.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    FiFilePlus, FiPlusCircle, FiTruck, FiTrendingUp, FiDownload, FiCreditCard,
    FiActivity, FiAlertTriangle, FiArchive, FiClock, FiCheckCircle,
} from "react-icons/fi";
import { MdFullscreen, MdCurrencyRupee } from "react-icons/md";
import { getFinancialSummary, getDailyFinancials, getMonthlyFinancials, getDeliveries, getProduction } from "../../../api/reports.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { PageHeader,Modal, Card, KpiCard, Delta, Button, BarList, Badge, EmptyState, ErrorBox, Skeleton } from "../../shared/components/ui.jsx";
import PeriodFilter from "../../shared/components/PeriodFilter.jsx";
import ReportDownloadModal from "../../shared/components/ReportDownloadModal.jsx";
import { FEATURES } from "../../shared/lib/features.js";
import TrendChart from "../../shared/components/TrendChart.jsx";
import InvoiceWizard from "../Invoices/wizard/InvoiceWizard.jsx";
import { initialPeriod, previousRange, comparisonLabel, percentChange, rangeParams, todayIST } from "../../shared/lib/period.js";
import { trendPlan, trendParams, bucketTrend } from "../../shared/lib/trend.js";
import { formatMoney, formatMoneyShort, formatNumber, formatDate, humanize, formatAmount } from "../../shared/lib/format.js";

const ITEM_STATUS_ORDER = [
    "ORDER_ACCEPTED", "CUTTING", "TAILOR_ASSIGNED", "STITCHING",
    "SHOP_ASSISTANT_ASSIGNED", "HEMMING", "IRONING", "ORDER_COMPLETED",
];

const PERIOD_TEXT = {
    today: "Today",
    week: "This week",
    month: "This month",
    overall: "All time",
};

// Each section loads on its own so one failing call does not blank the page.
function useSection(loader, deps) {
    const [state, setState] = useState({ loading: true, data: null, error: null });
    const run = useCallback(() => {
        let live = true;
        setState((s) => ({ ...s, loading: true, error: null }));
        loader()
            .then((data) => live && setState({ loading: false, data, error: null }))
            .catch((err) => live && setState({ loading: false, data: null, error: getErrorMessage(err, "Could not load") }));
        return () => {
            live = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
    useEffect(() => run(), [run]);
    return [state, run];
}

export default function Dashboard() {
    const navigate = useNavigate();
    const [period, setPeriod] = useState(() => initialPeriod("month"));
    const [wizardOpen, setWizardOpen] = useState(false);
    const [reportOpen, setReportOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [view, setView] = useState("chart");
    const periodKey = `${period.key}|${period.from}|${period.to}`;
    const prev = useMemo(() => previousRange(period), [periodKey]); // eslint-disable-line react-hooks/exhaustive-deps
    const plan = useMemo(() => trendPlan(period), [periodKey]); // eslint-disable-line react-hooks/exhaustive-deps

    const [summary, reloadSummary] = useSection(
        () =>
            Promise.all([
                getFinancialSummary(rangeParams(period)),
                prev ? getFinancialSummary(rangeParams(prev)).catch(() => null) : Promise.resolve(null),
            ]).then(([current, previous]) => ({ current, previous })),
        [periodKey],
    );
    const [series, reloadSeries] = useSection(
        () => (plan.source === "monthly" ? getMonthlyFinancials(trendParams(plan)) : getDailyFinancials(trendParams(plan)))
            .then((rows) => bucketTrend(plan, rows || [])),
        [periodKey],
    );
    // Production steps are "right now" (not the date filter): items of invoices not delivered yet, up to Item completed.
    // from = to = today only keeps the report's turnaround part (not shown here) small.
    const [production, reloadProduction] = useSection(() => {
        const today = todayIST();
        return getProduction({ from: today, to: today });
    }, []);
    const [deliveries, reloadDeliveries] = useSection(() => getDeliveries(), []);

    const cur = summary.data?.current;
    const old = summary.data?.previous;
    const compareText = comparisonLabel(period.key, period);
    const showDelta = !!old;

    const onFullscreen = () => {
      setIsFullscreen(!isFullscreen);
    }


    const footer = (currentValue, previousValue, goodWhen, extra) => (
        <>
            {showDelta && <Delta value={percentChange(currentValue, previousValue)} goodWhen={goodWhen} />}
            <span>{showDelta ? compareText : extra}</span>
        </>
    );

    const periodText =
        period.key === "custom" ? `${formatDate(period.from)} – ${formatDate(period.to)}` : PERIOD_TEXT[period.key];

    return (
        <>
            <PageHeader
                eyebrow={localStorage.getItem("shopName") || "Dashboard"}
                title="Dashboard"
                subtitle={`${periodText} · figures in IST`}
                actions={
                    <div className="so-actions" style={{ alignItems: "center" }}>
                        <PeriodFilter value={period} onChange={setPeriod} />
                        {FEATURES.branchReportExport && (
                            <Button variant="secondary" onClick={() => setReportOpen(true)}>
                                <FiDownload aria-hidden /> Download report
                            </Button>
                        )}
                    </div>
                }
            />

            {FEATURES.branchReportExport && (
                <ReportDownloadModal open={reportOpen} onClose={() => setReportOpen(false)}
                    branchName={localStorage.getItem("shopName") || ""} />
            )}
            <InvoiceWizard
                open={wizardOpen}
                onClose={(inv) => {
                    setWizardOpen(false);
                    if (inv?.invoiceId) navigate(`/shopOwner/invoices/${encodeURIComponent(inv.invoiceId)}`);
                }}
                onDone={() => reloadSummary()}
            />

            {/* Quick actions */}
            <div className="so-actions" style={{ marginBottom: 20 }}>
                <Button onClick={() => setWizardOpen(true)}>
                    <FiFilePlus aria-hidden /> New invoice
                </Button>
                <Button variant="secondary" onClick={() => navigate("/shopOwner/expenses")}>
                    <FiPlusCircle aria-hidden /> Add expense / petty cash
                </Button>
                <Button variant="secondary" onClick={() => navigate("/shopOwner/invoices")}>
                    <FiCreditCard aria-hidden /> Collect a payment
                </Button>
                <Button variant="secondary" onClick={() => navigate("/shopOwner/deliveries")}>
                    <FiTruck aria-hidden /> Today&apos;s deliveries
                </Button>
            </div>

            {summary.error && (
                <div style={{ marginBottom: 16 }}>
                    <ErrorBox message={summary.error} onRetry={reloadSummary} />
                </div>
            )}

            {/* KPI row 1: money in the period */}
            <div className="so-grid so-grid-kpi" style={{ marginBottom: 16 }}>
                <KpiCard
                    loading={summary.loading}
                    icon={<FiTrendingUp aria-hidden />}
                    label="Sales (invoiced)"
                    value={formatAmount(cur?.sales?.invoicedAmount)}
                    footer={footer(cur?.sales?.invoicedAmount, old?.sales?.invoicedAmount, "up",
                        `${formatNumber(cur?.sales?.invoiceCount)} invoices`)}
                />
                <KpiCard
                    loading={summary.loading}
                    icon={<FiDownload aria-hidden />}
                    label="Collected"
                    value={formatAmount(cur?.collections?.total)}
                    footer={footer(cur?.collections?.total, old?.collections?.total, "up", "payments received")}
                />
                <KpiCard
                    loading={summary.loading}
                    icon={<FiCreditCard aria-hidden />}
                    label="Expenses"
                    value={formatAmount(cur?.expenses?.total)}
                    footer={footer(cur?.expenses?.total, old?.expenses?.total, "down",
                        `${formatNumber(cur?.expenses?.count)} entries`)}
                />
                <KpiCard
                    loading={summary.loading}
                    icon={<FiActivity aria-hidden />}
                    label="Net cash flow"
                    value={formatAmount(cur?.netCashFlow)}
                    footer={footer(cur?.netCashFlow, old?.netCashFlow, "up", "collected − expenses")}
                />
            </div>

            {/* KPI row 2: position + counts */}
            <div className="so-grid so-grid-kpi" style={{ marginBottom: 24 }}>
                <KpiCard
                    loading={summary.loading}
                    icon={<FiClock aria-hidden />}
                    label="Outstanding balance"
                    value={formatAmount(cur?.outstanding?.balanceDue)}
                    footer={<span>{formatNumber(cur?.outstanding?.openInvoiceCount)} open invoices · right now</span>}
                />
                <KpiCard
                    loading={summary.loading}
                    icon={<MdCurrencyRupee aria-hidden />}
                    label="Petty cash balance"
                    value={formatAmount(cur?.pettyCash?.currentBalance)}
                    footer={<span>{formatAmount(cur?.pettyCash?.added)} added in period</span>}
                />
                <KpiCard
                    loading={summary.loading}
                    icon={<FiCheckCircle aria-hidden />}
                    label="Receipts (delivered)"
                    value={formatNumber(cur?.receiptCount)}
                    footer={footer(cur?.receiptCount, old?.receiptCount, "up", "receipts generated")}
                />
                <KpiCard
                    loading={summary.loading}
                    icon={<FiArchive aria-hidden />}
                    label="Deleted invoices"
                    value={formatNumber(cur?.deletedInvoiceCount)}
                    footer={
                        <button
                            type="button"
                            className="so-linkbtn"
                            style={{ padding: 0, width: "auto", fontSize: 12 }}
                            onClick={() => navigate("/shopOwner/invoices?tab=deleted")}
                        >
                            View deleted invoices →
                        </button>
                    }
                />
            </div>

            {/* Cash-flow trend (left) + items by production step (right) */}
            <div className="so-grid so-grid-main" style={{ marginBottom: 16, alignItems: "start" }}>
            <Card title="Cash flow" subtitle={series.data?.label || plan.label} actions={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onFullscreen}
                  title={`Expand ${view}`}
                  aria-label="Expand"
                >
                  <MdFullscreen size={20} />
                </Button>
              }
              >
                    {series.error ? (
                        <ErrorBox message={series.error} onRetry={reloadSeries} />
                    ) : series.loading ? (
                        <Skeleton height={300} />
                    ) : (

                  <TrendChart
                    rows={series.data?.rows || []}
                    view={view}
                    onViewChange={setView}
                  />
                    )}
                </Card>

                <Modal
                    open={isFullscreen}
                    onClose={() => setIsFullscreen(false)}
                    title={`Cash flow (${series.data?.label || plan.label})`}
                    size="lg"
                >
                    {series.error ? (
                        <ErrorBox message={series.error} onRetry={reloadSeries} />
                    ) : series.loading ? (
                        <Skeleton height={450} />
                    ) : (
                        <div style={{ minHeight: 450 }}>
                            <TrendChart rows={series.data?.rows || []} view={view} onViewChange={setView} fullscreen />
                        </div>
                    )}
                </Modal>

                <Card
                    title="Items by production step"
                    subtitle={
                        production.data
                            ? `${formatNumber(production.data.total?.openItems || 0)} items not delivered yet · right now`
                            : "Items not delivered yet · right now"
                    }
                >
                    {production.error ? (
                        <ErrorBox message={production.error} onRetry={reloadProduction} />
                    ) : production.loading ? (
                        <Skeleton height={120} />
                    ) : (
                        <BarList
                            rows={stageRows(production.data?.total?.stages)}
                            format={formatNumber}
                            emptyText="No items in production"
                        />
                    )}
                </Card>
            </div>

            {/* Bottom row: payment methods, expenses, today's deliveries */}
            <div className="so-grid so-grid-3">
                <Card title="Collected by payment method" subtitle={periodText}>
                    {summary.loading ? (
                        <Skeleton height={120} />
                    ) : (
                        <BarList
                            rows={(cur?.collections?.byPaymentMethod || []).map((m) => ({
                                label: m.paymentMethod || "Not recorded",
                                value: m.amount,
                                meta: `${formatNumber(m.count)} payments`,
                            }))}
                            format={formatMoneyShort}
                            color="var(--so-series-2)"
                            emptyText="No payments in this period"
                        />
                    )}
                </Card>

                <Card
                    title="Expenses by category"
                    subtitle={
                        cur
                            ? `Shop ${formatMoneyShort(cur.expenses?.shopExpenses)} · Employees ${formatMoneyShort(cur.expenses?.employeeExpenses)}`
                            : periodText
                    }
                >
                    {summary.loading ? (
                        <Skeleton height={120} />
                    ) : (
                        <BarList
                            rows={(cur?.expenses?.byType || []).slice(0, 8).map((t) => ({
                                label: t.expenseType || "Uncategorised",
                                value: t.amount,
                                meta: `${formatNumber(t.count)}×`,
                            }))}
                            format={formatMoneyShort}
                            color="var(--so-series-3)"
                            emptyText="No expenses in this period"
                        />
                    )}
                </Card>

                <DeliveriesCard
                    state={deliveries}
                    reload={reloadDeliveries}
                    onOpen={() => navigate("/shopOwner/deliveries")}
                />
            </div>
        </>
    );
}

// Bar colour per phase: cutting coral, tailoring plum, finishing amber, ready green (the step name is always shown too).
const STEP_COLOR = {
    ORDER_ACCEPTED: "#ff7759", CUTTING: "#ff7759",
    TAILOR_ASSIGNED: "#8a3462", STITCHING: "#8a3462",
    SHOP_ASSISTANT_ASSIGNED: "#eda100", HEMMING: "#eda100", IRONING: "#eda100",
    ORDER_COMPLETED: "#1f9d6b",
};

// Every step from Item accepted to Item completed, in workflow order (zero when empty); nothing once all are zero.
const stageRows = (stages = []) => {
    const byStatus = Object.fromEntries((stages || []).map((st) => [st.status, st.items || 0]));
    if (!Object.values(byStatus).some(Boolean)) return [];
    // hemming and ironing are one step on screen: one bar with both counts
    return ITEM_STATUS_ORDER.filter((k) => k !== "IRONING").map((k) => ({
        label: humanize(k),
        value: (byStatus[k] || 0) + (k === "HEMMING" ? byStatus.IRONING || 0 : 0),
        color: STEP_COLOR[k],
    }));
};

/* ------------------------------------------------------------------ Today's deliveries */
// Counts only (no order list, so the card never grows); "View all" opens the deliveries page.
function DeliveriesCard({ state, reload, onOpen }) {
    const d = state.data;
    const s = d?.summary;
    return (
        <Card
            title="Today's deliveries"
            subtitle={d?.date ? formatDate(d.date) : "Due, ready and overdue orders"}
            actions={
                <Button variant="ghost" size="sm" onClick={onOpen}>
                    View all
                </Button>
            }
        >
            {state.error ? (
                <ErrorBox message={state.error} onRetry={reload} />
            ) : state.loading ? (
                <Skeleton height={220} />
            ) : (
                <div className="so-stack">
                    <div className="so-stats">
                        <div className="so-stat">
                            <div className="so-stat-value">{s?.dueCount ?? 0}</div>
                            <div className="so-stat-label">Due today</div>
                        </div>
                        <div className="so-stat">
                            <div className="so-stat-value">{s?.dueReadyCount ?? 0}</div>
                            <div className="so-stat-label">Ready</div>
                        </div>
                        <div className="so-stat">
                            <div className="so-stat-value">{s?.overdueCount ?? 0}</div>
                            <div className="so-stat-label">Overdue</div>
                        </div>
                        <div className="so-stat">
                            <div className="so-stat-value">{s?.deliveredCount ?? 0}</div>
                            <div className="so-stat-label">Delivered</div>
                        </div>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--so-slate)" }}>
                        Balance to collect on due + overdue: <b style={{ color: "var(--so-primary)" }}>{formatMoney(s?.balanceToCollect)}</b>
                    </div>

                </div>
            )}
        </Card>
    );
}
