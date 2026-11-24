import axios from "axios";
import { jwtDecode } from "jwt-decode";

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/v1/api`;

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Everything the app keeps in storage for the signed-in user (see Login.jsx).
const SESSION_KEYS = ["token", "user", "userId", "shopId", "shopName", "username", "role"];

// Requests that run without a session: a 401 from these must NOT log the user out
// (e.g. a wrong password on sign-in returns 401 "Invalid email or password").
const NO_SESSION_PATHS = ["/auth/sign-in", "/auth/password-reset", "/public/"];

const isNoSessionRequest = (url = "") => NO_SESSION_PATHS.some((path) => url.includes(path));

const clearSession = () => {
  SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
  sessionStorage.removeItem("pdfServiceWarmedUp");
};

// Centralized logout for an expired / revoked session.
export const handleLogout = (message = "Session expired") => {
  clearSession();

  // Store the logout reason temporarily
  sessionStorage.setItem("logoutReason", message);

  // Redirect to login with flag
  window.location.href = "/login?sessionExpired=true";
};

// User-initiated logout: revokes the token on the server (best effort), then clears the session.
export const signOut = async () => {
  const token = localStorage.getItem("token");
  if (token) {
    try {
      await axios.post(`${API_BASE_URL}/auth/sign-out`, null, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // The token may already be expired or revoked; the local session is cleared anyway.
    }
  }
  localStorage.clear();
  sessionStorage.clear();
  window.location.href = "/login";
};

// Turns any backend error body into one readable sentence.
//   - normal errors:      { message: "...", status: false }
//   - validation errors:  { fieldName: "message", otherField: "message" }   (HTTP 400)
export const getErrorMessage = (error, fallback = "Something went wrong. Please try again.") => {
  const data = error?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object") {
    if (data.message) return data.message;
    const fieldMessages = Object.values(data).filter((value) => typeof value === "string");
    if (fieldMessages.length) return fieldMessages.join("\n");
  }
  if (error?.response?.status === 403) return "You don't have access to do this.";
  return error?.message || fallback;
};

// --- Token refresh -----------------------------------------------------------------------------
// A token that expires within 5 minutes is swapped for a new one (POST /auth/token/refresh).
// Parallel requests share one refresh call.
let refreshPromise = null;

const refreshToken = async (token) => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_BASE_URL}/auth/token/refresh`, null, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((response) => {
        const newToken = response.data?.accessToken;
        if (!newToken) throw new Error("No token in refresh response");
        localStorage.setItem("token", newToken);
        return newToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

axiosInstance.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem("token");
    if (!token || isNoSessionRequest(config.url)) {
      return config;
    }

    let expiresAt;
    try {
      expiresAt = jwtDecode(token).exp * 1000;
    } catch {
      handleLogout("Your session is invalid. Please log in again.");
      return Promise.reject(new axios.Cancel("Invalid session"));
    }

    if (expiresAt <= Date.now()) {
      handleLogout("Your session has expired. Please log in again.");
      return Promise.reject(new axios.Cancel("Session expired"));
    }

    let activeToken = token;
    if (expiresAt < Date.now() + 5 * 60 * 1000) {
      try {
        activeToken = await refreshToken(token);
      } catch {
        // Still valid for a few minutes; the next request tries again.
      }
    }

    config.headers.Authorization = `Bearer ${activeToken}`;
    return config;
  },
  (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const response = error.response;
    if (!response) {
      // Network error, CORS block or cancelled request.
      return Promise.reject(error);
    }

    // Validation errors (a map of field -> message) get a `message`, so screens that show
    // error.response.data.message keep working.
    // (Blob bodies, from PDF downloads, are parsed by utils/downloadPdf.js instead.)
    if (response.data && typeof response.data === "object" && !(response.data instanceof Blob)
        && !response.data.message) {
      response.data.message = getErrorMessage(error);
    }

    // 401 on an authenticated request = expired, revoked (signed out / password reset) or invalid token.
    if (response.status === 401 && !isNoSessionRequest(error.config?.url)) {
      handleLogout("Your session has expired. Please log in again.");
      return Promise.reject(error);
    }

    // 403 = signed in, but this role / shop may not do it.     -> message from getErrorMessage
    // 409 = someone else changed the record first (invoice, payment, item status)
    //       -> the screen should reload the record and let the user retry.
    return Promise.reject(error);
  }
);

export default axiosInstance;
