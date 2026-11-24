// Shop employees (/v1/api/shops/{shopId}/employees).
import axiosInstance from "../Pages/LoginPages/axios.js";

export const currentShopId = () => localStorage.getItem("shopId");

/** Employees of the signed-in user's shop: [{userId, name, email, phone, ...}]. */
export const listShopEmployees = (params = {}) => {
    const shopId = currentShopId();
    if (!shopId) return Promise.resolve([]);
    return axiosInstance
        .get(`/shops/${encodeURIComponent(shopId)}/employees`, { params })
        .then((res) => res.data || []);
};

const enc = encodeURIComponent;
const shopUrl = (userId) => `/shops/${enc(currentShopId())}/employees/${enc(userId)}`;

/** Staff not working in any shop (can be added to this one). */
export const listUnassignedStaff = () => axiosInstance.get("/employees/unassigned").then((res) => res.data || []);

/** Add an existing staff account to this shop. */
export const assignToMyShop = (userId) =>
    axiosInstance.put(`/employees/${enc(userId)}/assignment`, { shopId: currentShopId() }).then((res) => res.data);

/** Change name / email / phone / salary / address (only the fields sent). */
export const updateEmployee = (userId, changes) => axiosInstance.patch(shopUrl(userId), changes).then((res) => res.data);

/** Remove from the shop — the account stays and can be added again. */
export const removeFromShop = (userId) => axiosInstance.delete(`${shopUrl(userId)}/assignment`).then((res) => res.data);

/** Delete the account permanently (in-progress items go back one step). */
export const deleteEmployeeAccount = (userId) => axiosInstance.delete(shopUrl(userId)).then((res) => res.data);

/** Roles that work on items, in the order used to pick an employee's analytics role. */
export const WORK_ROLES = ["TAILOR_MASTER", "TAILOR", "SHOP_ASSISTANT"];
export const workRoleOf = (employee) => WORK_ROLES.find((r) => (employee?.roles || []).includes(r)) || null;
