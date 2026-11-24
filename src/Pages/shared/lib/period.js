// Period filter logic (Today · This week · This month · Custom · Overall).
// All dates are IST calendar days as yyyy-MM-dd strings — the format every report endpoint takes
// (from / to are inclusive on the backend).

export const PERIODS = [
    { key: "today", label: "Today" },
    { key: "week", label: "This week" },
    { key: "month", label: "This month" },
    { key: "custom", label: "Custom" },
    { key: "overall", label: "Overall" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Today in IST as yyyy-MM-dd. */
export const todayIST = () =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" })
        .format(new Date());

// Day arithmetic on yyyy-MM-dd strings, done in UTC so DST/time zone never interferes.
const parse = (ymd) => new Date(`${ymd}T00:00:00Z`);
const fmt = (d) => d.toISOString().slice(0, 10);
export const addDays = (ymd, n) => fmt(new Date(parse(ymd).getTime() + n * DAY_MS));
export const daysBetween = (from, to) => Math.round((parse(to) - parse(from)) / DAY_MS) + 1;

/**
 * Range for a period. Returns { from, to } (both null for "overall").
 * The week starts on Monday.
 */
export const rangeFor = (key, custom = {}) => {
    const today = todayIST();
    switch (key) {
        case "today":
            return { from: today, to: today };
        case "week": {
            const dow = parse(today).getUTCDay(); // 0 = Sunday
            return { from: addDays(today, -((dow + 6) % 7)), to: today };
        }
        case "month":
            return { from: `${today.slice(0, 8)}01`, to: today };
        case "custom":
            return { from: custom.from || today, to: custom.to || today };
        default:
            return { from: null, to: null };
    }
};

/**
 * The comparison range: the same number of days immediately before.
 * ("This month" on the 17th compares with the 17 days before the 1st.)
 */
export const previousRange = ({ from, to }) => {
    if (!from || !to) return null;
    const n = daysBetween(from, to);
    return { from: addDays(from, -n), to: addDays(from, -1), days: n };
};

/** Human label for the comparison, e.g. "vs yesterday", "vs previous 7 days". */
export const comparisonLabel = (key, range) => {
    if (key === "today") return "vs yesterday";
    const prev = previousRange(range);
    return prev ? `vs previous ${prev.days} day${prev.days === 1 ? "" : "s"}` : "";
};

/** % change; null when there is nothing to compare against. */
export const percentChange = (current, previous) => {
    const c = Number(current) || 0;
    const p = Number(previous) || 0;
    if (p === 0) return c === 0 ? 0 : null;
    return ((c - p) / Math.abs(p)) * 100;
};

/** Query params for a range: omit nulls. */
export const rangeParams = ({ from, to } = {}) => {
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    return params;
};

/** Initial filter value for a page, e.g. initialPeriod("month"). */
export const initialPeriod = (key = "month") => ({ key, ...rangeFor(key) });
