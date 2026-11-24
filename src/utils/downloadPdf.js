import axios from "axios";
import axiosInstance from "../Pages/LoginPages/axios.js";

/**
 * Downloads a PDF from the backend and saves it in the browser.
 *
 * Every PDF in the new backend is a GET that returns the file itself (application/pdf):
 *   - GET /invoices/{invoiceId}/pdf            (OWNER adds ?shopId=)
 *   - GET /receipts/{receiptNo}/pdf            (OWNER adds ?shopId=)
 *   - GET /payment-receipts/{no}/pdf
 *   - GET /public/documents/{invoices|receipts|payment-receipts}/{token}   (customers, no login)
 *
 * @param {string} url       path relative to /v1/api, e.g. `/invoices/${id}/pdf`
 * @param {string} filename  e.g. `${invoiceId}.pdf`
 * @param {object} [options]
 * @param {object} [options.params]  query parameters, e.g. { shopId }
 * @param {boolean} [options.open]   true = open in a new tab instead of saving
 * @param {import("axios").AxiosInstance} [options.client]  defaults to the signed-in axios instance
 */
export const downloadPdf = async (url, filename, { params, open = false, client = axiosInstance } = {}) => {
  let response;
  try {
    response = await client.get(url, { params, responseType: "blob" });
  } catch (error) {
    // With responseType "blob" the error body is a Blob too: turn it back into { message } for the screen.
    await readBlobError(error);
    throw error;
  }

  const blob = new Blob([response.data], { type: "application/pdf" });
  const objectUrl = window.URL.createObjectURL(blob);

  if (open) {
    window.open(objectUrl, "_blank", "noopener");
  } else {
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename || "document.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  // Give the browser time to start the download / open the tab before releasing the blob.
  setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60_000);
  return blob;
};

/**
 * Customer download links (no login): GET /v1/api/public/documents/{kind}/{token} -> the PDF.
 * kind: "invoices" | "receipts" | "payment-receipts". Uses plain axios: no Authorization header and no
 * logout-on-401 interceptor. An invalid / expired link is a 400 with { message } (made readable here).
 * @returns {Promise<Blob>} the PDF
 */
export const fetchPublicPdf = async (kind, token) => {
  try {
    const response = await axios.get(
      `${import.meta.env.VITE_API_BASE_URL}/v1/api/public/documents/${kind}/${encodeURIComponent(token)}`,
      { responseType: "blob" }
    );
    return new Blob([response.data], { type: "application/pdf" });
  } catch (error) {
    await readBlobError(error);
    throw error;
  }
};

/**
 * Downloads any file the backend returns (Excel, PDF …) and saves it with the server's file name
 * (Content-Disposition), or `fallbackName` when the header is missing.
 * @param {string} url  path relative to /v1/api
 * @param {object} [options]
 * @param {object} [options.params]  query parameters
 * @param {string} [options.fallbackName]
 * @returns {Promise<string>} the file name used
 */
export const downloadFile = async (url, { params, fallbackName = "download" } = {}) => {
  let response;
  try {
    response = await axiosInstance.get(url, { params, responseType: "blob" });
  } catch (error) {
    await readBlobError(error);
    throw error;
  }
  const disposition = response.headers?.["content-disposition"] || "";
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  const name = star ? decodeURIComponent(star[1]) : plain ? plain[1] : fallbackName;

  const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60_000);
  return name;
};

/** Replaces a Blob error body with the parsed JSON, so error.response.data.message works as usual. */
const readBlobError = async (error) => {
  const data = error?.response?.data;
  if (!(data instanceof Blob)) return;
  try {
    const text = await data.text();
    error.response.data = JSON.parse(text);
  } catch {
    // Not JSON: leave the body as it is.
  }
};
