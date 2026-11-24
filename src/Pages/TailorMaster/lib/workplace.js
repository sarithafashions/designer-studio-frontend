// Helpers for the TAILOR_MASTER workplace: tabs, due-date text, tailor load, stage history adapter.
import { itemTimeline } from "../../shared/lib/invoice.js";
import { ACTIONS } from "../../../api/production.js";
import { formatDate } from "../../shared/lib/format.js";
import { todayIST, daysBetween } from "../../shared/lib/period.js";

/** Tabs of the workplace; `statuses` go to the queue as status=… (empty = whole TM queue). */
export const TABS = [
    { key: "new", label: "New", statuses: ["ORDER_ACCEPTED"] },
    { key: "cutting", label: "Cutting", statuses: ["CUTTING"] },
    { key: "tailors", label: "With tailors", statuses: ["TAILOR_ASSIGNED", "STITCHING"] },
    { key: "all", label: "All", statuses: [] },
];
export const tabOf = (key) => TABS.find((t) => t.key === key) || TABS[0];

/** Count for a tab from GET /items/queue/summary (items, not orders). */
export const tabCount = (summary, tab) => {
    if (!summary) return undefined;
    const counts = summary.countsByStatus || {};
    return tab.statuses.length ? tab.statuses.reduce((n, s) => n + (counts[s] || 0), 0) : summary.totalItems;
};

export const SORTS = [
    { key: "dueSoonest", label: "Due soonest" },
    { key: "oldest", label: "Oldest" },
    { key: "newest", label: "Newest" },
];
export const DUES = [
    { key: "", label: "Any date" },
    { key: "overdue", label: "Late" },
    { key: "today", label: "Due today" },
    { key: "week", label: "This week" },
];

/**
 * Delivery date of an order / item as {text, tone}: "3 days late" (danger), "Due today" (warning),
 * "Due tomorrow" / "Due in 4 days" (neutral), "No delivery date".
 */
export const dueInfo = (dueDate, daysOverdue, today = todayIST()) => {
    if (!dueDate) return { text: "No delivery date", tone: "neutral", date: "" };
    const date = formatDate(dueDate);
    if (daysOverdue > 0) return { text: `${daysOverdue} day${daysOverdue === 1 ? "" : "s"} late`, tone: "danger", date };
    const inDays = daysBetween(today, dueDate) - 1;
    if (inDays <= 0) return { text: "Due today", tone: "warning", date };
    if (inDays === 1) return { text: "Due tomorrow", tone: "neutral", date };
    return { text: `Due in ${inDays} days`, tone: "neutral", date };
};

/** Tailors sorted by current load (waiting + stitching), then name. */
export const byLoad = (tailors = []) =>
    [...tailors].sort((a, b) =>
        ((a.assigned || 0) + (a.inProgress || 0)) - ((b.assigned || 0) + (b.inProgress || 0))
        || String(a.name || "").localeCompare(String(b.name || "")));

export const loadText = (t) => {
    const parts = [`${t.assigned || 0} waiting`, `${t.inProgress || 0} stitching`];
    if (t.late) parts.push(`${t.late} late`);
    return parts.join(" · ");
};

const LAST_TAILOR = "tm.lastTailorId";
export const rememberTailor = (id) => {
    try {
        localStorage.setItem(LAST_TAILOR, id);
    } catch {
        /* storage unavailable: nothing to remember */
    }
};
export const lastTailor = () => {
    try {
        return localStorage.getItem(LAST_TAILOR);
    } catch {
        return null;
    }
};

/** Stage history of a work item (history[] uses userId) in the shape of the shared itemTimeline. */
export const workItemTimeline = (item, invoiceDate) =>
    itemTimeline(
        { assignmentHistory: (item?.history || []).map((h) => ({ tailorId: h.userId, action: h.action, timestamp: h.timestamp })) },
        invoiceDate,
    );

/** Item label: "Blouse ×2" (quantity shown only when not 1). */
export const itemLabel = (item) =>
    `${item.itemName || "Item"}${item.itemQuantity && item.itemQuantity !== 1 ? ` ×${item.itemQuantity}` : ""}`;

/** The item can be moved to cutting / (re-)assigned by the signed-in user (from availableActions). */
export const canCut = (item) => (item.availableActions || []).includes("CUTTING");
export const canAssign = (item) => (item.availableActions || []).includes(ACTIONS.ASSIGN_TAILOR);
