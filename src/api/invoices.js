// Invoices, payments and receipts (/v1/api/invoices/..., /receipts, /payment-receipts).
// A SHOP_OWNER is scoped to their own shop by the backend.
import axiosInstance from "../Pages/LoginPages/axios.js";
import { downloadPdf } from "../utils/downloadPdf.js";

const enc = encodeURIComponent;
const data = (promise) => promise.then((res) => res.data);

/**
 * Paged list. params: status (pending | delivered | all), search, stage (NEW | IN_PRODUCTION | READY | DELIVERED),
 * itemStatus, paymentStatus (Dues | Partial | Paid), from, to (yyyy-MM-dd), sort (newest | oldest | dueSoonest | dueLatest),
 * pageNumber, pageSize. -> { content, pageNumber, pageSize, totalElements, totalPages, lastPage }
 */
export const listInvoices = (params = {}) => data(axiosInstance.get("/invoices", { params }));

/** Full invoice: customer, items (measurements, assignmentHistory), amounts, paymentHistories, stage, receiptNo. */
/** GET /invoices/customer-lookup?phone= -> { found, name, email, alternatePhone, address, customerState, invoiceCount } */
export const lookupCustomer = (phone) => data(axiosInstance.get("/invoices/customer-lookup", { params: { phone } }));

export const getInvoice = (invoiceId) => data(axiosInstance.get(`/invoices/${enc(invoiceId)}`));

/** Partial edit (JSON): expectedDeliveryDate, notes, discount, items (complete list), customer {...}. */
export const editInvoice = (invoiceId, changes) => data(axiosInstance.patch(`/invoices/${enc(invoiceId)}`, changes));

/** Delete (archive) an invoice without a receipt; reason optional (≤ 300 chars). */
export const deleteInvoice = (invoiceId, reason) =>
    data(axiosInstance.delete(`/invoices/${enc(invoiceId)}`, { params: reason ? { reason } : {} }));

/** Totals + payments (each with its paymentReceiptNo). */
export const getInvoiceAccount = (invoiceId) => data(axiosInstance.get(`/invoices/${enc(invoiceId)}/account`));

/** Record a payment {amount, paymentMethod, transactionId?} -> account incl. the new paymentReceipt. */
export const recordPayment = (invoiceId, body) => data(axiosInstance.post(`/invoices/${enc(invoiceId)}/payments`, body));

/** Discount {amount (before GST), reason?}. */
export const applyDiscount = (invoiceId, body) => data(axiosInstance.post(`/invoices/${enc(invoiceId)}/discount`, body));

/** Final receipt = delivery (fully paid and every item completed). */
export const generateReceipt = (invoiceId) => data(axiosInstance.post(`/invoices/${enc(invoiceId)}/receipt`));

export const listPaymentReceipts = (invoiceId) => data(axiosInstance.get(`/invoices/${enc(invoiceId)}/payment-receipts`));

// ---- PDFs (open in a new tab, or download when open = false)
export const openInvoicePdf = (invoiceId, open = true) =>
    downloadPdf(`/invoices/${enc(invoiceId)}/pdf`, `Invoice_${invoiceId}.pdf`, { open });
export const openReceiptPdf = (receiptNo, open = true) =>
    downloadPdf(`/receipts/${enc(receiptNo)}/pdf`, `Receipt_${receiptNo}.pdf`, { open });
export const openPaymentReceiptPdf = (paymentReceiptNo, open = true) =>
    downloadPdf(`/payment-receipts/${enc(paymentReceiptNo)}/pdf`, `PaymentReceipt_${paymentReceiptNo}.pdf`, { open });

// ---- Create / edit items (multipart: the JSON part + images named item_{index}_{name}.{ext})
const withImages = (jsonPart, json, images) => {
    const form = new FormData();
    form.append(jsonPart, new Blob([JSON.stringify(json)], { type: "application/json" }));
    images.forEach(({ index, file }) => {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        form.append("images", new File([file], `item_${index}_image.${ext}`, { type: file.type }));
    });
    return form;
};

/** POST /invoices. images: [{index, file}] (index = the item's position). -> the created invoice */
export const createInvoice = (json, images = []) =>
    data(axiosInstance.post("/invoices", withImages("invoiceJson", json, images), { headers: { "Content-Type": "multipart/form-data" } }));

/** PATCH /invoices/{id} with images (multipart editJson), or JSON when there are no images. */
export const editInvoiceWithImages = (invoiceId, json, images = []) =>
    images.length
        ? data(axiosInstance.patch(`/invoices/${enc(invoiceId)}`, withImages("editJson", json, images), { headers: { "Content-Type": "multipart/form-data" } }))
        : editInvoice(invoiceId, json);
