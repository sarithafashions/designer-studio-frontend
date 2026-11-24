// Invoice helpers shared by the list and detail pages.
import { parseDueDate } from "./format.js";
import { todayIST } from "./period.js";

/** Days late (> 0) for an undelivered invoice, else 0. */
export const daysOverdue = (expectedDeliveryDate, stage) => {
    if (stage === "DELIVERED") return 0;
    const due = parseDueDate(expectedDeliveryDate);
    if (!due) return 0;
    const today = todayIST();
    if (due >= today) return 0;
    return Math.round((new Date(`${today}T00:00:00Z`) - new Date(`${due}T00:00:00Z`)) / 86400000);
};

/** True when the backend answered 409: the invoice changed meanwhile (reload and retry). */
export const isConflict = (error) => error?.response?.status === 409;

/**
 * Per-item stage trace from assignmentHistory [{tailorId = who acted, action, timestamp}].
 * The item starts as ORDER_ACCEPTED at the invoice date; each entry starts a step, the next entry ends it.
 * Returns [{action, actorId, start, end}] oldest first (end = null for the current step).
 */
export const itemTimeline = (item, invoiceDate) => {
    const entries = [...(item?.assignmentHistory || [])]
        .filter((e) => e && e.timestamp)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const steps = [];
    if (!entries.length || entries[0].action !== "ORDER_ACCEPTED") {
        steps.push({ action: "ORDER_ACCEPTED", actorId: null, start: invoiceDate || null });
    }
    entries.forEach((e) =>
        steps.push({
            action: e.action,
            actorId: e.tailorId || null,
            start: e.timestamp,
            markedByShopOwner: !!e.markedByShopOwner,
            skippedFrom: e.skippedFrom || null,
            note: e.note || null,
        }),
    );
    return steps.map((s, i) => ({ ...s, end: i + 1 < steps.length ? steps[i + 1].start : null }));
};

/** Steps skipped when an item is marked completed from `status` (e.g. STITCHING -> hemming & ironing). */
export const remainingSteps = (status) => {
    const order = ["ORDER_ACCEPTED", "CUTTING", "TAILOR_ASSIGNED", "STITCHING", "SHOP_ASSISTANT_ASSIGNED", "HEMMING", "IRONING"];
    const i = order.indexOf(status);
    // HEMMING and IRONING are one step on screen ("hemming & ironing"): already in it means nothing of it is skipped
    const work = { CUTTING: "cutting", STITCHING: "stitching", HEMMING: "hemming & ironing" };
    return order.slice(i < 0 ? 0 : i + 1).map((s) => work[s]).filter(Boolean);
};

/**
 * The backend moves needed to reach `next` from `status`. Hemming and ironing are shown as one step, so moving on
 * from HEMMING (where the backend offers IRONING) finishes the item: IRONING then ORDER_COMPLETED.
 */
export const movesTo = (status, next) => (status === "HEMMING" && next === "IRONING" ? ["IRONING", "ORDER_COMPLETED"] : [next]);

/** Item measurements as [{name, value, unit}] from measurementList or the measurements map. */
export const measurementsOf = (item) => {
    if (Array.isArray(item?.measurementList) && item.measurementList.length) {
        return item.measurementList.filter((m) => m && m.name);
    }
    return Object.entries(item?.measurements || {}).map(([name, value]) => ({ name, value, unit: "" }));
};
