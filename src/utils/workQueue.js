import axiosInstance from "../Pages/LoginPages/axios.js";

/*
 * Production work queue helpers (backend: modules/production).
 *
 * The backend works per ITEM:
 *   GET   /items/queue?status=A&status=B&pageNumber=&pageSize=   -> page of WorkItem
 *   GET   /invoices/{invoiceId}/items/{itemUniqueId}             -> WorkItem
 *   PATCH /invoices/{invoiceId}/items/{itemUniqueId}/status        { status }
 *   PUT   /invoices/{invoiceId}/items/{itemUniqueId}/tailor        { tailorId }
 *   PUT   /invoices/{invoiceId}/items/{itemUniqueId}/shop-assistant { shopAssistantId }
 *   GET   /items/assignees/tailors | /items/assignees/shop-assistants -> [{ userId, name }]
 *
 * WorkItem = { invoiceId, itemUniqueId, itemName, itemQuantity, imageUrl, status, tailor{userId,name},
 *              shopAssistant{userId,name}, measurements, measurementList, customerName,
 *              expectedDeliveryDate, invoiceDate, availableActions[], history[] }
 *
 * Which items a user gets depends on the role:
 *   TAILOR_MASTER  ORDER_ACCEPTED, CUTTING, TAILOR_ASSIGNED, STITCHING
 *   TAILOR         TAILOR_ASSIGNED, STITCHING                       (only items assigned to them)
 *   SHOP_ASSISTANT SHOP_ASSISTANT_ASSIGNED, HEMMING, IRONING        (only items assigned to them)
 *   SHOP_OWNER     every item not yet completed
 *
 * The existing screens were built around INVOICES that contain items, so groupByInvoice() turns the
 * queue back into that shape, using the field names the screens already read.
 */

const PAGE_SIZE = 100; // backend maximum
const MAX_PAGES = 20;  // safety stop: 2000 items

// Item in the shape the old screens use (old field names kept next to the new ones)
export const toLegacyItem = (workItem) => ({
    ...workItem,
    itemOrderStatus: workItem.status,
    assignedTo: workItem.tailor?.userId || null,
    assignedTailorName: workItem.tailor?.name || null,
    assignmentStatus: workItem.tailor ? "ASSIGNED" : null,
    assignedToWhichShopAssistant: workItem.shopAssistant?.userId || null,
    assignedShopAssistantName: workItem.shopAssistant?.name || null,
    shopAssistantStatus: workItem.shopAssistant ? "ASSIGNED" : null,
    availableActions: workItem.availableActions || [],
});

// [WorkItem] -> [{ id, invoiceId, customer: { name }, customerName, invoiceDate, expectedDeliveryDate, items: [...] }]
// Keeps the backend order (oldest invoice first).
export const groupByInvoice = (workItems) => {
    const byInvoice = new Map();
    (workItems || []).forEach((workItem) => {
        let invoice = byInvoice.get(workItem.invoiceId);
        if (!invoice) {
            invoice = {
                id: workItem.invoiceId,
                invoiceId: workItem.invoiceId,
                customer: { name: workItem.customerName || "" },
                customerName: workItem.customerName || "",
                invoiceDate: workItem.invoiceDate,
                expectedDeliveryDate: workItem.expectedDeliveryDate || "",
                items: [],
                checked: false,
            };
            byInvoice.set(workItem.invoiceId, invoice);
        }
        invoice.items.push(toLegacyItem(workItem));
    });
    return Array.from(byInvoice.values());
};

// All items of the signed-in user's queue (every page). `statuses` optionally narrows it.
export const fetchWorkQueue = async (statuses = []) => {
    const items = [];
    for (let page = 0; page < MAX_PAGES; page++) {
        const response = await axiosInstance.get("/items/queue", {
            params: { status: statuses.length ? statuses : undefined, pageNumber: page, pageSize: PAGE_SIZE },
            // status=A&status=B (not status[]=A)
            paramsSerializer: { indexes: null },
        });
        const data = response.data || {};
        items.push(...(data.content || []));
        if (data.lastPage !== false || !(data.content || []).length) break;
    }
    return items;
};

// The queue grouped into invoice rows
export const fetchQueueInvoices = async (statuses = []) => groupByInvoice(await fetchWorkQueue(statuses));

// invoiceDate (a timestamp) as yyyy-MM-dd in IST
export const invoiceDayIST = (invoiceDate) =>
    invoiceDate ? new Date(invoiceDate).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : "";

// Keeps invoices whose invoice date is within [from, to] (yyyy-MM-dd, inclusive). Empty bounds = open.
export const filterByInvoiceDate = (invoices, from, to) =>
    (invoices || []).filter((invoice) => {
        const day = invoiceDayIST(invoice.invoiceDate);
        if (from && day < from) return false;
        if (to && day > to) return false;
        return true;
    });

// Text search over invoice number and customer name
export const searchInvoices = (invoices, term) => {
    const text = (term || "").trim().toLowerCase();
    if (!text) return invoices || [];
    return (invoices || []).filter((invoice) =>
        (invoice.invoiceId || "").toLowerCase().includes(text) ||
        (invoice.customerName || "").toLowerCase().includes(text)
    );
};

const itemPath = (invoiceId, itemUniqueId) =>
    `/invoices/${encodeURIComponent(invoiceId)}/items/${encodeURIComponent(itemUniqueId)}`;

export const fetchWorkItem = async (invoiceId, itemUniqueId) =>
    (await axiosInstance.get(itemPath(invoiceId, itemUniqueId))).data;

// Next status, e.g. CUTTING / STITCHING / HEMMING / IRONING / ORDER_COMPLETED (must be in availableActions)
export const updateItemStatus = async (invoiceId, itemUniqueId, status) =>
    (await axiosInstance.patch(`${itemPath(invoiceId, itemUniqueId)}/status`, { status })).data;

export const assignTailor = async (invoiceId, itemUniqueId, tailorId) =>
    (await axiosInstance.put(`${itemPath(invoiceId, itemUniqueId)}/tailor`, { tailorId })).data;

export const assignShopAssistant = async (invoiceId, itemUniqueId, shopAssistantId) =>
    (await axiosInstance.put(`${itemPath(invoiceId, itemUniqueId)}/shop-assistant`, { shopAssistantId })).data;

export const fetchAssignableTailors = async () => (await axiosInstance.get("/items/assignees/tailors")).data || [];

export const fetchAssignableShopAssistants = async () =>
    (await axiosInstance.get("/items/assignees/shop-assistants")).data || [];

// Status actions only (availableActions also holds ASSIGN_TAILOR / ASSIGN_SHOP_ASSISTANT)
export const statusActions = (item) =>
    (item?.availableActions || []).filter((action) => !action.startsWith("ASSIGN_"));
