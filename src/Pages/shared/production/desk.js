// TAILOR_MASTER screens (old functionality, new UI): date ranges, urgency, stage labels, track steps,
// measurements and Excel rows. Data comes from utils/workQueue.js (whole queue grouped by invoice).
import { getTemplateForGarment } from "../../../constants/measurementTemplates.js";
import { todayIST, addDays } from "../lib/period.js";
import { parseDueDate, formatDate } from "../lib/format.js";

// ------------------------------------------------------------------ date ranges (IST, yyyy-MM-dd)

const lastDayOfMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m = 1-12

/** {from, to} for a range key; custom = {from, to}. */
export const rangeOf = (key, custom = {}, today = todayIST()) => {
    const [y, m] = today.split("-").map(Number);
    switch (key) {
        case "yesterday":
            return { from: addDays(today, -1), to: addDays(today, -1) };
        case "week": {
            const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
            return { from: addDays(today, -dow), to: addDays(today, 6 - dow) };
        }
        case "month":
            return { from: `${y}-${String(m).padStart(2, "0")}-01`, to: `${y}-${String(m).padStart(2, "0")}-${lastDayOfMonth(y, m)}` };
        case "year":
            return { from: `${y}-01-01`, to: `${y}-12-31` };
        case "custom":
            return { from: custom.from || "", to: custom.to || "" };
        default:
            return { from: today, to: today };
    }
};

// ------------------------------------------------------------------ due-date pills (cutting queue, assign board)

/** Instant filter by delivery date (cutting queue, assign board, a tailor's items). */
export const DUE_FILTERS = [
    { key: "all", label: "All" },
    { key: "today", label: "Due today" },
    { key: "overdue", label: "Overdue" },
];

/** Does `days` (from daysUntil; null = no date) pass the due filter `key`? */
export const dueMatches = (days, key) => {
    switch (key) {
        case "overdue":
            return days !== null && days < 0;
        case "today":
            return days === 0;
        default:
            return true;
    }
};

/** Valid due filter from a URL value (default "all"). */
export const dueKeyOf = (value) => (DUE_FILTERS.some((f) => f.key === value) ? value : "all");

/** Pill options with counts: count(key) -> number. */
export const dueOptions = (count) => DUE_FILTERS.map((f) => ({ ...f, count: count(f.key) }));

// ------------------------------------------------------------------ urgency + stage

/** Days from today to the delivery date (negative = overdue); null without a readable date. */
export const daysUntil = (expectedDeliveryDate, today = todayIST()) => {
    const due = expectedDeliveryDate ? parseDueDate(expectedDeliveryDate) : null;
    return due ? Math.round((new Date(`${due}T00:00:00Z`) - new Date(`${today}T00:00:00Z`)) / 86400000) : null;
};

/** Delivery urgency (same wording as before): {label, tone}. */
export const urgencyOf = (expectedDeliveryDate, today = todayIST()) => {
    if (!expectedDeliveryDate) return { label: "No due date", tone: "neutral", title: "No due date" };
    const due = parseDueDate(expectedDeliveryDate);
    if (!due) return { label: "Invalid date", tone: "neutral", title: String(expectedDeliveryDate) };
    const days = daysUntil(expectedDeliveryDate, today);
    const title = `Due: ${formatDate(due)}`;
    if (days < 0) return { label: `Overdue by ${-days} day${days === -1 ? "" : "s"}`, tone: "danger", title };
    if (days === 0) return { label: "Due today", tone: "warning", title };
    if (days === 1) return { label: "Due tomorrow", tone: "warning", title };
    return { label: `Due in ${days} days`, tone: days <= 3 ? "info" : "success", title };
};

const STAGES = {
    ORDER_ACCEPTED: "Cutting queue",
    CUTTING: "In cutting",
    TAILOR_ASSIGNED: "Assigned to tailor",
    STITCHING: "In stitching",
    SHOP_ASSISTANT_ASSIGNED: "Assigned assistant",
    HEMMING: "In hemming & ironing",
    IRONING: "In hemming & ironing",
    ORDER_COMPLETED: "Ready",
    ORDER_DELIVERED: "Delivered",
};
export const stageLabel = (status) => STAGES[status] || status || "Pending";

// ------------------------------------------------------------------ track status (8 steps)

// HEMMING and IRONING are two backend statuses shown as one step: IRONING counts as HEMMING on screen.
const trackKey = (status) => (status === "IRONING" ? "HEMMING" : status);

export const TRACK_STEPS = [
    ["ORDER_ACCEPTED", "Item accepted", "The order has been reviewed and accepted. Preparations are underway."],
    ["CUTTING", "Cutting", "The tailor master has begun cutting work on the garment. Materials and initial setup are complete."],
    ["TAILOR_ASSIGNED", "Tailor assigned", "The tailor has been assigned for the garment."],
    ["STITCHING", "Stitching", "The garment is being stitched and crafted with care."],
    ["SHOP_ASSISTANT_ASSIGNED", "Shop assistant assigned", "The garment has been assigned to the shop assistant."],
    ["HEMMING", "Hemming & ironing", "The sewing is complete, and the garment is now being hemmed and ironed."],
    ["ORDER_COMPLETED", "Item completed", "The garment has been ironed and is ready to deliver."],
    ["ORDER_DELIVERED", "Delivered", "The order is complete! The garment is delivered."],
].map(([key, label, description]) => ({ key, label, description }));

/** Step states for the current status: [{...step, state: "done" | "current" | "todo"}]. */
export const trackSteps = (status) => {
    const index = TRACK_STEPS.findIndex((s) => s.key === trackKey(status));
    return TRACK_STEPS.map((s, i) => ({ ...s, state: index < 0 ? "todo" : i < index ? "done" : i === index ? "current" : "todo" }));
};

// ------------------------------------------------------------------ measurements

/**
 * Read-only measurement view: the garment template's fields first (in order), then any other stored keys;
 * notes / Remarks separately. Falls back to measurementList ({name, value, unit}) when there is no map.
 * -> { rows: [{name, value, unit}], notes }
 */
export const measurementView = (item) => {
    const map = item?.measurements && typeof item.measurements === "object" ? item.measurements : null;
    if (!map || !Object.keys(map).length) {
        const list = Array.isArray(item?.measurementList) ? item.measurementList.filter((m) => m && m.name) : [];
        const notes = list.find((m) => /^(notes|remarks)$/i.test(m.name));
        return { rows: list.filter((m) => m !== notes).map((m) => ({ name: m.name, value: m.value ?? "", unit: m.unit || "" })), notes: notes?.value || "" };
    }
    const names = [];
    getTemplateForGarment(item.itemName || "").forEach((field) => {
        if (typeof field === "object" && field.fields) names.push(...field.fields);
        else if (field !== "Remarks") names.push(field);
    });
    Object.keys(map).forEach((k) => {
        if (k !== "notes" && k !== "Remarks" && !names.includes(k)) names.push(k);
    });
    return { rows: names.map((name) => ({ name, value: map[name] ?? "", unit: "" })), notes: map.notes || map.Remarks || "" };
};

// ------------------------------------------------------------------ lists

/** Item names that never show in the cutting queue (no cutting work). */
export const NOT_CUT_ITEMS = ["Embroidery", "Lining Material", "Saree Fall", "Saree Pico", "Designing"];

/** Hide placeholder items. */
export const deskItems = (invoice) => (invoice.items || []).filter((i) => i.itemName !== "NoUse");

/** Cutting queue: items not cut yet, without the no-cutting garments. */
export const cuttingItems = (invoice) =>
    (invoice.items || []).filter((i) => i.itemOrderStatus === "ORDER_ACCEPTED" && !NOT_CUT_ITEMS.includes(i.itemName));

/** Rows per page (same as the shop owner tables; no page-size picker). */
export const PAGE_SIZE = 20;

/** One page of an in-memory list in the PaginatedResponse shape used by <Pagination>. pageNumber is 0-based. */
export const pageOf = (rows, pageNumber, size = PAGE_SIZE) => {
    const totalPages = Math.max(1, Math.ceil(rows.length / size));
    const current = Math.min(pageNumber, totalPages - 1);
    return { content: rows.slice(current * size, (current + 1) * size), pageNumber: current, totalPages, totalElements: rows.length };
};

/** Excel rows for the selected invoices (one row per item). withTailor adds the Tailor column. */
export const exportRows = (invoices, pickItems, withTailor) =>
    invoices.flatMap((inv) =>
        pickItems(inv).map((i) => ({
            InvoiceID: inv.invoiceId,
            CustomerName: inv.customerName || "",
            GarmentItem: i.itemName,
            OrderDate: formatDate(inv.invoiceDate),
            DueDate: parseDueDate(inv.expectedDeliveryDate) ? formatDate(parseDueDate(inv.expectedDeliveryDate)) : "",
            Status: i.itemOrderStatus,
            ...(withTailor ? { Tailor: i.assignedTailorName || "Unassigned" } : {}),
        })),
    );

// ------------------------------------------------------------------ jobs (one item of an invoice)

/** Sort key for "soonest due first": no date last. */
const dueKey = (days) => (days === null ? Number.MAX_SAFE_INTEGER : days);

/** [{invoice, item, days}] -> sorted soonest / most overdue first (stable). */
export const byDue = (jobs) => [...jobs].sort((a, b) => dueKey(a.days) - dueKey(b.days));

/** Flatten invoices into jobs {key, invoice, item, days}, keeping only items that pass `keep(item, invoice)`. */
export const jobsOf = (invoices, keep = () => true, today = todayIST()) =>
    (invoices || []).flatMap((invoice) =>
        deskItems(invoice).filter((item) => keep(item, invoice)).map((item) => ({
            key: `${invoice.invoiceId}|${item.itemUniqueId}`,
            invoice,
            item,
            days: daysUntil(invoice.expectedDeliveryDate, today),
        })));

/** Free-text match over invoice no., customer and item name. */
export const jobMatches = (job, term) => {
    const text = (term || "").trim().toLowerCase();
    if (!text) return true;
    return [job.invoice.invoiceId, job.invoice.customerName, job.item.itemName]
        .some((v) => (v || "").toLowerCase().includes(text));
};

/** Work a tailor has in hand: assigned (not started) + stitching. */
export const inHand = (t) => (t?.assigned ?? 0) + (t?.inProgress ?? 0);

// ------------------------------------------------------------------ follow-up (tailors and their items)

/** Items a tailor is working on (assigned or stitching), soonest delivery first. */
export const tailorJobs = (jobs, tailorId) => byDue(jobs.filter((j) => j.item.assignedTo === tailorId));

// ------------------------------------------------------------------ bulk actions

/** Runs `action(job)` for each job one after another. -> {done, failed: [{job, error}]} */
export const runEach = async (jobs, action) => {
    let done = 0;
    const failed = [];
    for (const job of jobs) {
        try {
            await action(job);
            done++;
        } catch (error) {
            failed.push({ job, error });
        }
    }
    return { done, failed };
};

// ------------------------------------------------------------------ my work (activity report)

/** My work ranges (longer periods are read in chunks of 366 days). */
export const WORK_RANGES = [
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "week", label: "This week" },
    { key: "month", label: "This month" },
    { key: "year", label: "This year" },
    { key: "custom", label: "Custom range" },
];

/** Busiest day of a daily series: {date, count} or null when all are zero. */
export const busiestDay = (days = []) =>
    days.reduce((best, d) => (d.count > (best?.count || 0) ? d : best), null);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayLabel = (ymd) => `${Number(ymd.slice(8, 10))} ${MONTHS[Number(ymd.slice(5, 7)) - 1]}`;

/**
 * Chart for the My work period:
 * - today / yesterday / this week -> the last 7 days, day by day;
 * - this month -> the month, week by week (Sun–Sat weeks, cut to the month);
 * - this year -> month by month;
 * - custom -> up to 31 days day by day, up to 366 days month by month, longer year by year.
 * -> {from, to, group: "day" | "week" | "month" | "year", title}
 */
export const chartPlan = (range, applied, today = todayIST()) => {
    if (range === "today" || range === "yesterday" || range === "week") {
        return { from: addDays(today, -6), to: today, group: "day", title: "Last 7 days" };
    }
    if (range === "month") return { ...applied, group: "week", title: "This month, week by week" };
    if (range === "year") return { ...applied, group: "month", title: "This year, month by month" };
    const days = applied.from && applied.to ? Math.round((new Date(`${applied.to}T00:00:00Z`) - new Date(`${applied.from}T00:00:00Z`)) / 86400000) + 1 : 0;
    if (days <= 31) return { ...applied, group: "day", title: "Day by day" };
    if (days <= 366) return { ...applied, group: "month", title: "Month by month" };
    return { ...applied, group: "year", title: "Year by year" };
};

/** Daily counts [{date, count}] -> chart bars [{key, label, title, count}] grouped by day / week / month / year. */
export const groupBars = (daily = [], group = "day") => {
    const bars = new Map();
    daily.forEach(({ date, count }) => {
        const ymd = String(date).slice(0, 10);
        let key;
        let start = ymd;
        if (group === "week") {
            const dow = new Date(`${ymd}T00:00:00Z`).getUTCDay(); // 0 = Sunday
            key = addDays(ymd, -dow);
        } else if (group === "month") {
            key = ymd.slice(0, 7);
        } else if (group === "year") {
            key = ymd.slice(0, 4);
        } else {
            key = ymd;
        }
        const bar = bars.get(key);
        if (bar) {
            bar.count += Number(count) || 0;
            bar.end = ymd;
        } else {
            bars.set(key, { key, start, end: ymd, count: Number(count) || 0 });
        }
    });
    const list = [...bars.values()];
    const manyYears = list.length > 0 && list[0].key.slice(0, 4) !== list[list.length - 1].key.slice(0, 4);
    return list.map((b) => {
        if (group === "week") {
            const label = b.start === b.end ? dayLabel(b.start) : `${dayLabel(b.start)}–${dayLabel(b.end)}`;
            return { key: b.key, label, title: `Week ${label}`, count: b.count };
        }
        if (group === "month") {
            const m = MONTHS[Number(b.key.slice(5, 7)) - 1];
            return { key: b.key, label: manyYears ? `${m} ${b.key.slice(2, 4)}` : m, title: `${m} ${b.key.slice(0, 4)}`, count: b.count };
        }
        if (group === "year") return { key: b.key, label: b.key, title: b.key, count: b.count };
        return { key: b.key, label: dayLabel(b.key), title: formatDate(b.key), count: b.count };
    });
};

/** Splits [from, to] into pieces of at most `max` days (the daily report limit). -> [{from, to}] */
export const chunkRange = (from, to, max = 366) => {
    const pieces = [];
    let start = from;
    while (start && to && start <= to) {
        const end = addDays(start, max - 1) < to ? addDays(start, max - 1) : to;
        pieces.push({ from: start, to: end });
        start = addDays(end, 1);
    }
    return pieces;
};

// ------------------------------------------------------------------ item history timings (Track popup, follow-up)

/** Stage trace from the work item's history [{userId, action, timestamp}] -> [{action, actorId, start, end}] (end null = now). */
export const workTimeline = (item, invoiceDate) => {
    const entries = (item?.history || [])
        .filter((e) => e && e.timestamp)
        .map((e) => ({ action: e.action, actorId: e.userId || null, start: e.timestamp }))
        .sort((a, b) => new Date(a.start) - new Date(b.start));
    const steps = entries.length && entries[0].action === "ORDER_ACCEPTED" ? entries
        : [{ action: "ORDER_ACCEPTED", actorId: null, start: invoiceDate || null }, ...entries];
    return steps.map((s, i) => ({ ...s, end: i + 1 < steps.length ? steps[i + 1].start : null }));
};

/** Per track step: when it was first reached and when it ended (null = still in it). -> {KEY: {start, end}} */
export const stepTimes = (timeline) => {
    const times = {};
    timeline.forEach((s) => {
        if (!s.action) return;
        const key = trackKey(s.action); // hemming + ironing make one step: from hemming started to completed
        if (!times[key]) times[key] = { start: s.start, end: s.end };
        else times[key].end = s.end;
    });
    return times;
};

/** When the item entered its current status (latest history entry with that action), or null. */
export const inStatusSince = (item, invoiceDate) => {
    const timeline = workTimeline(item, invoiceDate);
    const key = trackKey(item.itemOrderStatus);
    // the earliest entry of the current (merged) step since the item last entered it
    let i = timeline.length - 1;
    while (i >= 0 && trackKey(timeline[i].action) !== key) i--;
    let since = null;
    for (; i >= 0 && trackKey(timeline[i].action) === key; i--) since = timeline[i].start;
    return since;
};

/** When the item was (last) given to its current tailor, or null. */
export const withTailorSince = (item) => {
    const entry = [...(item?.history || [])].reverse()
        .find((e) => e && e.timestamp && e.action === "TAILOR_ASSIGNED" && (!item.assignedTo || e.userId === item.assignedTo));
    return entry?.timestamp || null;
};
