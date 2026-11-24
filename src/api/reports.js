// Reports API (/v1/api/reports/...). A SHOP_OWNER is always scoped to their own shop by the backend.
// Dates are yyyy-MM-dd IST calendar days; from / to are inclusive and optional.
import axiosInstance from "../Pages/LoginPages/axios.js";
import { downloadFile } from "../utils/downloadPdf.js";

const get = (url, params) => axiosInstance.get(url, { params }).then((res) => res.data);

/** KPIs: sales, collections (byPaymentMethod), expenses (byPaymentMethod, byType), petty cash, net, outstanding, counts. */
export const getFinancialSummary = (params = {}) => get("/reports/financials/summary", params);

/**
 * Platform owner: one row per branch for the period: {shopId, shopName, ownerName, employeeCount, pettyCash,
 * invoiceCount, invoicedAmount, paidInvoiceCount, deliveredInvoiceCount, collected, expenses, cashExpenses,
 * netCashFlow, pendingOrders, outstanding, receiptCount}. params: {from, to}
 */
export const getShopsOverview = (params = {}) => get("/reports/shops/overview", params);

/** One row per day (≤ 366 days); default the last 30 days. */
export const getDailyFinancials = (params = {}) => get("/reports/financials/daily", params);

/** One row per month; with no dates: from the first month with data up to now. */
export const getMonthlyFinancials = (params = {}) => get("/reports/financials/monthly", params);

/**
 * Production health: {today, from, to, branches[{shopId, shopName, openItems, overdueItems, stages[{status, items, overdue,
 * avgDaysInStage, maxDaysInStage}], turnaround{deliveredOrders, avgDaysToDeliver, onTimePercent, withDueDate,
 * stageTimes[{status, avgHours, samples}]}}], total}. params: {shopId, from, to}
 */
export const getProduction = (params = {}) => get("/reports/production", params);

/**
 * Customers: {totalCustomers, activeCustomers, newCustomers, returningCustomers, repeatRate, avgSpendPerCustomer,
 * months[{month, newCustomers, returningCustomers}], top[...], withDues[...], customersWithDues, totalDue}. params: {shopId, from, to}
 */
export const getCustomers = (params = {}) => get("/reports/customers", params);

/** Due today / overdue / delivered today for a date (default today). */
export const getDeliveries = (params = {}) => get("/reports/deliveries", params);

/** Signed-in staff member's own activity: {employeeId, from, to, total, countsByType, daily[{date, count}]}. params: {from, to} */
export const getMyActivity = (params = {}) => get("/reports/my-activity", params);

/**
 * Analytics for a role. role=SHOP_OWNER gives the shop's itemStatusCounts, totalItems, invoiceCount,
 * averageRevenuePerInvoice, receiptCount, deletedInvoiceCount for the period.
 */
export const getEmployeeAnalytics = (params) => get("/reports/activities/employee-analytics", params);

/** Activity log, newest first; invoiceId narrows it to one invoice (timeline). */
export const getActivities = (params = {}) => get("/reports/activities", params);

/** Deleted invoices (paged) and one deleted invoice in full. */
export const getDeletedInvoices = (params = {}) => get("/reports/deleted-invoices", params);
export const getDeletedInvoice = (archiveId) => get(`/reports/deleted-invoices/${encodeURIComponent(archiveId)}`);

/** Activity totals per employee for the period: [{employeeId, employeeName, total, countsByType, lastActivityAt}]. */
export const getActivityByEmployee = (params = {}) => get("/reports/activities/by-employee", params);

/** Activities per day: [{date, count}] (employeeId narrows to one person). */
export const getActivityDaily = (params = {}) => get("/reports/activities/daily", params);

/**
 * Downloads the branch report: GET /reports/branch-report?shopId&from&to&format=xlsx|pdf (any range up to 366 days;
 * a shop owner always gets their own branch). Saves the file with the server's name; resolves to that name.
 */
export const downloadBranchReport = ({ shopId, from, to, format = "xlsx" }) =>
    downloadFile("/reports/branch-report", {
        params: { ...(shopId ? { shopId } : {}), from, to, format },
        fallbackName: `SarithaFashions_report_${from}_${to}.${format}`,
    });
