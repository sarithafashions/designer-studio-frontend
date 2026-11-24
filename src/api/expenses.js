// Expenses (/v1/api/expenses...). A SHOP_OWNER is scoped to their own shop by the backend.
import axiosInstance from "../Pages/LoginPages/axios.js";

const data = (promise) => promise.then((res) => res.data);

/**
 * Paged list. params: from, to, search, paymentMethod, type (shop | employee), employeeUserId, expenseType,
 * sort, pageNumber, pageSize.
 */
export const listExpenses = (params = {}) => data(axiosInstance.get("/expenses", { params }));

/** Totals for the same filters (total, by type / method / kind). */
export const getExpenseSummary = (params = {}) => data(axiosInstance.get("/expenses/summary", { params }));

/** Shop expense (Cash comes out of petty cash; refused when it is too low). */
export const createShopExpense = (body) => data(axiosInstance.post("/expenses", body));

/** Employee expense (salary, advance, ...): body + employeeUserId. */
export const createEmployeeExpense = (body) => data(axiosInstance.post("/employee-expenses", body));

/** Change amount, notes, category, date, payment method or employee (only the fields sent). */
export const updateExpense = (id, changes) => data(axiosInstance.patch(`/expenses/${encodeURIComponent(id)}`, changes));

/** Delete with a reason (kept in the Deleted tab). */
export const deleteExpense = (id, reason) =>
    data(axiosInstance.delete(`/expenses/${encodeURIComponent(id)}`, { params: reason ? { reason } : {} }));

/** Deleted expenses (paged): from, to, search, type, pageNumber, pageSize. */
export const listDeletedExpenses = (params = {}) => data(axiosInstance.get("/expenses/deleted", { params }));

// ---- Petty cash (/shops/{shopId}/petty-cash)
const pettyUrl = () => `/shops/${encodeURIComponent(localStorage.getItem("shopId") || "")}/petty-cash`;
export const addPettyCash = (amount) => data(axiosInstance.post(pettyUrl(), { amount }));
export const listPettyCashTopUps = (params = {}) => data(axiosInstance.get(pettyUrl(), { params }));

/** One category list per kind ("Travel" replaces the old "Travel Expenses"). */
export const SHOP_CATEGORIES = ["Rent", "Electricity Bill", "Materials", "Refreshment", "Travel", "Other"];
export const EMPLOYEE_CATEGORIES = ["Salary", "Advance", "Refreshment", "Travel", "Miscellaneous"];
/** Categories that can list line items, and the request field they go in. */
export const DETAIL_FIELD = { Refreshment: "refreshmentDetails", Travel: "travelDetails", Miscellaneous: "miscellaneousDetails" };
