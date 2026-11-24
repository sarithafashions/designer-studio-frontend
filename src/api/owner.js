// Platform owner reads for one branch (the shop owner's helpers use the signed-in shop from localStorage;
// the owner passes the branch explicitly). View only.
import axiosInstance from "../Pages/LoginPages/axios.js";
import { downloadPdf } from "../utils/downloadPdf.js";

const enc = encodeURIComponent;
const data = (promise) => promise.then((res) => res.data);

/** Every branch: [{shopId, shopName, shopType, gstNumber, ownerName, shopContactNumber, shopAddress, shopState, pettyCash, totalExpense}]. */
export const listShopSummaries = () => data(axiosInstance.get("/shops/summaries")).then((d) => d || []);

/** Staff of a branch: [{userId, name, email, phone, roles[], accountCreationDate, lastLoginDate, ...}]. */
export const listBranchEmployees = (shopId) => data(axiosInstance.get(`/shops/${enc(shopId)}/employees`)).then((d) => d || []);

/** Petty cash top-ups of a branch (paged): [{amount, addedAt, addedBy, addedByName}]. params: {from, to, pageNumber, pageSize} */
export const listBranchPettyCash = (shopId, params = {}) => data(axiosInstance.get(`/shops/${enc(shopId)}/petty-cash`, { params }));

/** Receipts (paged). params: {shopId, from, to, search, pageNumber, pageSize} */
export const listReceipts = (params = {}) => data(axiosInstance.get("/receipts", { params }));

/** PDFs of another branch (the owner passes the branch). */
export const openBranchInvoicePdf = (invoiceId, shopId) =>
    downloadPdf(`/invoices/${enc(invoiceId)}/pdf`, `Invoice_${invoiceId}.pdf`, { params: { shopId }, open: true });
/** One invoice of a branch, read only (the platform OWNER passes shopId). */
export const getBranchInvoice = (invoiceId, shopId) => data(axiosInstance.get(`/invoices/${enc(invoiceId)}`, { params: { shopId } }));
/** Payment receipts of one invoice of a branch (one per payment). */
export const listBranchPaymentReceipts = (invoiceId, shopId) =>
    data(axiosInstance.get(`/invoices/${enc(invoiceId)}/payment-receipts`, { params: { shopId } }));
export const openBranchPaymentReceiptPdf = (paymentReceiptNo, shopId) =>
    downloadPdf(`/payment-receipts/${enc(paymentReceiptNo)}/pdf`, `PaymentReceipt_${paymentReceiptNo}.pdf`, { params: { shopId }, open: true });
export const openBranchReceiptPdf = (receiptNo) =>
    downloadPdf(`/receipts/${enc(receiptNo)}/pdf`, `Receipt_${receiptNo}.pdf`, { open: true });

// ------------------------------------------------------------------ admin (platform owner only)

/** New branch + its shop owner account: {shopName, shopAddress, gstNumber, ownerName, ownerEmailId, ownerNumber, password, salary}. */
export const createBranch = (body) => data(axiosInstance.post("/shops", body));

/** Branch details; only the fields sent change: {shopName, shopAddress, shopContactNumber, gstNumber}. */
export const updateBranch = (shopId, body) => data(axiosInstance.put(`/shops/${enc(shopId)}`, body));

/** Shop owner's account: {name, phone, email, password, salary, reason}; a new email / password signs them out. */
export const updateShopOwner = (shopId, body) => data(axiosInstance.put(`/shops/${enc(shopId)}/owner`, body));

/** Add cash to a branch's petty cash. */
export const addBranchPettyCash = (shopId, amount) => data(axiosInstance.post(`/shops/${enc(shopId)}/petty-cash`, { amount }));

/** New staff account in a branch: {name, email, password, roles: [ROLE], shopId, phone, salary, address}. */
export const createUser = (body) => data(axiosInstance.post("/auth/users", body));

/** Staff accounts that work in no branch. */
export const listUnassignedUsers = () => data(axiosInstance.get("/employees/unassigned")).then((d) => d || []);

/** Put a user in a branch (moves them when they work in another one). */
export const assignUser = (userId, shopId) => data(axiosInstance.put(`/employees/${enc(userId)}/assignment`, { shopId }));

/** Take a user out of a branch (the account stays; in-progress items go back one step). */
export const unassignUser = (shopId, userId) => data(axiosInstance.delete(`/shops/${enc(shopId)}/employees/${enc(userId)}/assignment`));

/** Change a staff member's details: {name, email, phone, salary, address}. */
export const updateBranchEmployee = (shopId, userId, changes) =>
    data(axiosInstance.patch(`/shops/${enc(shopId)}/employees/${enc(userId)}`, changes));

/** Delete a staff account for good. */
export const deleteUserAccount = (shopId, userId) => data(axiosInstance.delete(`/shops/${enc(shopId)}/employees/${enc(userId)}`));
