// Item production workflow (/v1/api/items/..., /invoices/{id}/items/{itemId}/...).
import axiosInstance from "../Pages/LoginPages/axios.js";

const enc = encodeURIComponent;
const itemUrl = (invoiceId, itemId) => `/invoices/${enc(invoiceId)}/items/${enc(itemId)}`;
const data = (promise) => promise.then((res) => res.data);

/** One item with tailor / shopAssistant {userId, name}, history and availableActions for the signed-in user. */
export const getWorkItem = (invoiceId, itemId) => data(axiosInstance.get(itemUrl(invoiceId, itemId)));

/** Move an item one step: {status}. */
export const updateItemStatus = (invoiceId, itemId, status) =>
    data(axiosInstance.patch(`${itemUrl(invoiceId, itemId)}/status`, { status }));

export const assignTailor = (invoiceId, itemId, tailorId) =>
    data(axiosInstance.put(`${itemUrl(invoiceId, itemId)}/tailor`, { tailorId }));
export const assignShopAssistant = (invoiceId, itemId, shopAssistantId) =>
    data(axiosInstance.put(`${itemUrl(invoiceId, itemId)}/shop-assistant`, { shopAssistantId }));
export const unassignTailor = (invoiceId, itemId) => data(axiosInstance.delete(`${itemUrl(invoiceId, itemId)}/tailor`));
export const unassignShopAssistant = (invoiceId, itemId) =>
    data(axiosInstance.delete(`${itemUrl(invoiceId, itemId)}/shop-assistant`));

/** [{userId, name}] */
export const listAssignableTailors = () => data(axiosInstance.get("/items/assignees/tailors")).then((d) => d || []);
export const listAssignableShopAssistants = () =>
    data(axiosInstance.get("/items/assignees/shop-assistants")).then((d) => d || []);

/** Actions returned in availableActions besides a next status name. */
export const ACTIONS = {
    ASSIGN_TAILOR: "ASSIGN_TAILOR",
    ASSIGN_SHOP_ASSISTANT: "ASSIGN_SHOP_ASSISTANT",
    UNASSIGN_TAILOR: "UNASSIGN_TAILOR",
    UNASSIGN_SHOP_ASSISTANT: "UNASSIGN_SHOP_ASSISTANT",
    COMPLETE: "COMPLETE", // shop owner: mark completed directly
};

/** Workflow order of item statuses. */
export const ITEM_STATUSES = [
    "ORDER_ACCEPTED", "CUTTING", "TAILOR_ASSIGNED", "STITCHING",
    "SHOP_ASSISTANT_ASSIGNED", "HEMMING", "IRONING", "ORDER_COMPLETED",
];

/**
 * Every open item of the shop (SHOP_OWNER queue), read page by page (100 per page, at most maxPages).
 * -> [{invoiceId, itemUniqueId, itemName, status, tailor: {userId, name}, shopAssistant: {...}, ...}]
 */
export const listOpenItems = async (maxPages = 20) => {
    const all = [];
    for (let pageNumber = 0; pageNumber < maxPages; pageNumber++) {
        const page = (await axiosInstance.get("/items/queue", { params: { pageNumber, pageSize: 100 } })).data;
        all.push(...(page?.content || []));
        if (!page || page.lastPage || !(page.content || []).length) break;
    }
    return all;
};

/** Query string for the queue: `status` repeated (status=A&status=B), blank values left out. */
const queueQuery = ({ statuses = [], search, sort, due, pageNumber = 0, pageSize = 20 } = {}) => {
    const q = new URLSearchParams();
    statuses.filter(Boolean).forEach((s) => q.append("status", s));
    if (search && search.trim()) q.set("search", search.trim());
    if (sort) q.set("sort", sort);
    if (due) q.set("due", due);
    q.set("pageNumber", String(pageNumber));
    q.set("pageSize", String(pageSize));
    return q.toString();
};

/** My work queue, items. Options: {statuses[], search, sort: oldest|newest|dueSoonest, due: today|overdue|week|none, pageNumber, pageSize}. */
export const getQueue = (options) => data(axiosInstance.get(`/items/queue?${queueQuery(options)}`));

/** My work queue grouped by invoice (paged per order); same options as getQueue. */
export const getQueueOrders = (options) => data(axiosInstance.get(`/items/queue/orders?${queueQuery(options)}`));

/** Counts of my queue: {today, countsByStatus, totalItems, orders, late, dueToday, dueThisWeek, withoutDueDate}. */
export const getQueueSummary = () => data(axiosInstance.get("/items/queue/summary"));

/** Tailors with their current load: [{userId, name, assigned, inProgress, late}]. */
export const listTailorsWithLoad = () =>
    data(axiosInstance.get("/items/assignees/tailors", { params: { withLoad: true } })).then((d) => d || []);

/** Shop assistants with their current load: [{userId, name, assigned, inProgress (hemming + ironing), late}]. */
export const listShopAssistantsWithLoad = () =>
    data(axiosInstance.get("/items/assignees/shop-assistants", { params: { withLoad: true } })).then((d) => d || []);

/** Shop owner: mark one item completed from any step (remaining steps skipped). -> the work item */
export const completeItem = (invoiceId, itemId, note) =>
    data(axiosInstance.post(`${itemUrl(invoiceId, itemId)}/complete`, note ? { note } : {}));

/** Shop owner: mark every not-completed item of the invoice completed. -> {completed, alreadyCompleted, failed} */
export const completeAllItems = (invoiceId, note) =>
    data(axiosInstance.post(`/invoices/${enc(invoiceId)}/items/complete`, note ? { note } : {}));
