// Cash-flow trend: which series to load for a period filter, and how to group it.
//   Today      -> last 7 days, one bar per day
//   This week  -> Mon..Sun of this week, one bar per day (days still to come show empty)
//   This month -> this month in weeks (1–7, 8–14, 15–21, 22–28, 29–end)
//   Custom     -> by length: up to 31 days per day, up to 92 days per week, up to 24 months per month, then per year
//   Overall    -> per month; per year once the history is longer than 24 months
// The backend has daily (max 366 days) and monthly series; weeks and years are summed here.
import { addDays, daysBetween, todayIST } from "./period.js";
import { formatDate, formatDayShort, formatMonth } from "./format.js";

const MAX_MONTHS = 24; // longer than this -> one bar per year
const SUM_KEYS = ["invoiceCount", "invoicedAmount", "collected", "expenses", "netCashFlow"];

const parse = (ymd) => new Date(`${ymd}T00:00:00Z`);
const monthEnd = (ymd) => {
    const d = parse(`${ymd.slice(0, 8)}01`);
    d.setUTCMonth(d.getUTCMonth() + 1);
    d.setUTCDate(0);
    return d.toISOString().slice(0, 10);
};
const weekStart = (ymd) => addDays(ymd, -((parse(ymd).getUTCDay() + 6) % 7)); // Monday
const shortRange = (from, to) => {
    const a = formatDayShort(from);
    const b = formatDayShort(to);
    if (from === to) return a;
    // "1–7 Nov" when both days are in the same month
    return from.slice(0, 7) === to.slice(0, 7) ? `${a.split(" ")[0]}–${b}` : `${a} – ${b}`;
};

/** What to fetch and how to group it: { source: "daily"|"monthly", grain: "day"|"week"|"month"|"year", params, from, to, label }. */
export const trendPlan = (period) => {
    const today = todayIST();
    switch (period.key) {
        case "today":
            return { source: "daily", grain: "day", from: addDays(today, -6), to: today, label: "Last 7 days, per day" };
        case "week": {
            const from = weekStart(today);
            return { source: "daily", grain: "day", from, to: addDays(from, 6), fetchTo: today, label: "This week, per day" };
        }
        case "month": {
            const from = `${today.slice(0, 8)}01`;
            return { source: "daily", grain: "monthWeeks", from, to: monthEnd(today), fetchTo: today, label: "This month, per week" };
        }
        case "overall":
            return { source: "monthly", grain: "auto", from: null, to: null, label: "All time" };
        default: {
            const { from, to } = period;
            const days = daysBetween(from, to);
            if (days <= 31) return { source: "daily", grain: "day", from, to, label: "Per day" };
            if (days <= 92) return { source: "daily", grain: "week", from, to, label: "Per week" };
            return { source: "monthly", grain: "auto", from, to, label: "Per month" };
        }
    }
};

/** Query params for the plan's request. */
export const trendParams = (plan) => {
    const p = {};
    if (plan.from) p.from = plan.from;
    const to = plan.fetchTo || plan.to;
    if (to) p.to = to;
    return p;
};

const empty = () => Object.fromEntries(SUM_KEYS.map((k) => [k, 0]));
const add = (acc, r) => SUM_KEYS.forEach((k) => (acc[k] += Number(r[k]) || 0));

/**
 * Groups the backend rows into chart buckets: [{ key, label, title, ...sums }].
 * Returns { rows, label } (the label may change, e.g. "All time, per year").
 */
export const bucketTrend = (plan, raw = []) => {
    if (plan.source === "monthly") {
        const months = raw.filter((r) => r.month);
        const perYear = months.length > MAX_MONTHS;
        if (!perYear) {
            return {
                label: plan.from ? plan.label : "All time, per month",
                rows: months.map((r) => ({ ...r, key: r.month, label: formatMonth(r.month, true), title: formatMonth(r.month) })),
            };
        }
        const years = new Map();
        months.forEach((r) => {
            const y = r.month.slice(0, 4);
            if (!years.has(y)) years.set(y, { key: y, label: y, title: y, ...empty() });
            add(years.get(y), r);
        });
        return { label: plan.from ? "Per year" : "All time, per year", rows: [...years.values()] };
    }

    // daily source: fill every day of the plan (days with no rows, or still to come, count as zero)
    const byDate = new Map(raw.filter((r) => r.date).map((r) => [String(r.date).slice(0, 10), r]));
    const days = [];
    for (let d = plan.from; d <= plan.to; d = addDays(d, 1)) days.push({ date: d, ...empty(), ...(byDate.get(d) || {}) });

    if (plan.grain === "day") {
        return {
            label: plan.label,
            rows: days.map((r) => ({ ...r, key: r.date, label: formatDayShort(r.date), title: formatDate(r.date) })),
        };
    }

    // weeks: calendar chunks of the month (1–7, 8–14 ...) or Monday-start weeks clipped to a custom range
    const groupOf = plan.grain === "monthWeeks"
        ? (d) => `${d.slice(0, 8)}${String(Math.floor((Number(d.slice(8)) - 1) / 7) * 7 + 1).padStart(2, "0")}`
        : (d) => (weekStart(d) < plan.from ? plan.from : weekStart(d));
    const weeks = new Map();
    days.forEach((r) => {
        const k = groupOf(r.date);
        if (!weeks.has(k)) weeks.set(k, { key: k, from: r.date, to: r.date, ...empty() });
        const w = weeks.get(k);
        w.to = r.date;
        add(w, r);
    });
    return {
        label: plan.label,
        rows: [...weeks.values()].map((w) => ({
            ...w,
            label: shortRange(w.from, w.to),
            title: `${formatDate(w.from)} – ${formatDate(w.to)}`,
        })),
    };
};
