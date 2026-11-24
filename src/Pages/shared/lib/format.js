// Formatters shared by the SHOP_OWNER pages. Money is INR (en-IN grouping, 2 dp);
// dates are shown in IST whatever the browser's time zone is.

const IST = "Asia/Kolkata";

const moneyFmt = new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const moneyShortFmt = new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
});
const numberFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

/** ₹1,23,456.00 */
export const formatMoney = (value) => moneyFmt.format(Number(value) || 0);

/** ₹1,23,456 (no paise) for KPI tiles and chart tooltips */
// export const formatMoneyShort = (value) => moneyShortFmt.format(Math.round(Number(value) || 0));

export const formatMoneyShort = (value) => value;
/** Compact axis labels: ₹950, ₹12.5K, ₹3.2L, ₹1.1Cr */
export const formatMoneyAxis = (value) => {
    const n = Number(value) || 0;
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)}Cr`;
    if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)}L`;
    if (abs >= 1e3) return `${sign}₹${trim(abs / 1e3)}K`;
    return `${sign}₹${Math.round(abs)}`;
};
const trim = (n) => (n >= 100 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, ""));

export const formatNumber = (value) => numberFmt.format(Number(value) || 0);

const amountFmt = new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2,
});
/** ₹1,23,456.5 — KPI amounts: rupee sign, Indian grouping, paise only when there are any */
export const formatAmount = (value) => amountFmt.format(Number(value) || 0);

const toDate = (value) => {
    if (!value) return null;
    // A plain yyyy-MM-dd is a calendar day: pin it to IST noon so it never shifts a day.
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00+05:30`);
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
};

/** 17 Nov 2026 */
export const formatDate = (value) => {
    const d = toDate(value);
    return d ? d.toLocaleDateString("en-IN", { timeZone: IST, day: "numeric", month: "short", year: "numeric" }) : "—";
};

/** 17 Nov 2026, 4:05 pm */
export const formatDateTime = (value) => {
    const d = toDate(value);
    return d
        ? d.toLocaleString("en-IN", { timeZone: IST, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
        : "—";
};

/** 17 Nov */
export const formatDayShort = (value) => {
    const d = toDate(value);
    return d ? d.toLocaleDateString("en-IN", { timeZone: IST, day: "numeric", month: "short" }) : "";
};

/** "2026-11" -> Nov 2026 / Nov '26 */
export const formatMonth = (yyyyMm, short = false) => {
    if (!yyyyMm) return "";
    const d = new Date(`${yyyyMm}-15T12:00:00+05:30`);
    return d.toLocaleDateString("en-IN", { timeZone: IST, month: "short", year: short ? "2-digit" : "numeric" });
};

// Item statuses whose code says "order" but which describe one item. HEMMING and IRONING are still two statuses in
// the backend but are shown as one step, "Hemming & ironing" (the shop assistant does both before marking completed).
const LABELS = {
    ORDER_ACCEPTED: "Item accepted", ORDER_COMPLETED: "Item completed", ORDER_DELIVERED: "Delivered",
    HEMMING: "Hemming & ironing", IRONING: "Hemming & ironing",
};

/** CUTTING -> Cutting, ORDER_COMPLETED -> Item completed */
export const humanize = (value) => {
    if (!value) return "";
    if (LABELS[value]) return LABELS[value];
    const s = String(value).replace(/_/g, " ").toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
};

export const initials = (name = "") =>
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "?";

/**
 * Expected delivery dates are free text in old data: yyyy-MM-dd(…), dd-MM-yyyy, dd/MM/yyyy, yyyy/MM/dd, dd.MM.yyyy.
 * Returns yyyy-MM-dd or null.
 */
export const parseDueDate = (value) => {
    if (!value) return null;
    const s = String(value).trim();
    let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return null;
};

/** Due-date text for display: "25 Nov 2026" or the raw value if unreadable. */
export const formatDueDate = (value) => {
    const d = parseDueDate(value);
    return d ? formatDate(d) : value || "—";
};

/** Duration between two instants: "2d 4h", "35m". */
export const formatDuration = (start, end) => {
    const a = new Date(start).getTime();
    const b = new Date(end).getTime();
    if (Number.isNaN(a) || Number.isNaN(b) || b < a) return "";
    const mins = Math.round((b - a) / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ${mins % 60}m`;
    return `${Math.floor(hours / 24)}d ${hours % 24}h`;
};
