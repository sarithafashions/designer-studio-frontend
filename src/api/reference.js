// Reference data served by the backend (so lists are not hardcoded in the UI).
import axiosInstance from "../Pages/LoginPages/axios.js";
import { PAYMENT_METHOD_OPTIONS } from "../constants/paymentMethods.js";

let paymentMethodsPromise = null;

/**
 * Canonical payment methods (GET /reference/payment-methods), fetched once per page load.
 * Falls back to the local list if the call fails, so forms still work.
 */
export const getPaymentMethods = () => {
    if (!paymentMethodsPromise) {
        paymentMethodsPromise = axiosInstance
            .get("/reference/payment-methods")
            .then((res) => (Array.isArray(res.data) && res.data.length ? res.data : PAYMENT_METHOD_OPTIONS))
            .catch(() => {
                paymentMethodsPromise = null; // retry next time
                return PAYMENT_METHOD_OPTIONS;
            });
    }
    return paymentMethodsPromise;
};
