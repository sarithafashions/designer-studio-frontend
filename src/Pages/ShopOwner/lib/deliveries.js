// Helpers for the Deliveries page: WhatsApp / call links, filtering, Excel rows.
import { formatMoney, formatDate, formatDateTime, humanize } from "../../shared/lib/format.js";

/** Digits for tel: / wa.me — a 10-digit Indian mobile gets the 91 country code. */
export const phoneDigits = (phone) => {
    const d = String(phone || "").replace(/\D/g, "");
    if (d.length === 10) return `91${d}`;
    return d;
};

export const telLink = (phone) => (phone ? `tel:${String(phone).replace(/[^\d+]/g, "")}` : null);

/** wa.me link with a ready-made message (opens WhatsApp / WhatsApp Web; nothing is sent automatically). */
export const whatsappLink = (order, shopName) => {
    const digits = phoneDigits(order.customerPhone);
    if (!digits) return null;
    const name = order.customerName ? ` ${order.customerName}` : "";
    const lines = [];
    if (order.ready) {
        lines.push(`Hi${name}, your order ${order.invoiceId} is ready for pickup at ${shopName}.`);
    } else if (order.daysOverdue > 0) {
        lines.push(`Hi${name}, sorry for the delay on your order ${order.invoiceId}. We are finishing it and will update you soon.`);
    } else {
        lines.push(`Hi${name}, an update on your order ${order.invoiceId} from ${shopName}: it is being finished for delivery.`);
    }
    if (order.balanceDue > 0) lines.push(`Balance to pay: ${formatMoney(order.balanceDue)}.`);
    lines.push("Thank you!");
    return `https://wa.me/${digits}?text=${encodeURIComponent(lines.join(" "))}`;
};

export const QUICK_FILTERS = [
    { key: "all", label: "All" },
    { key: "ready", label: "Ready" },
    { key: "production", label: "In production" },
    { key: "unpaid", label: "Balance due" },
];

/** Search (name / phone / invoice no.) + quick filter, for due and overdue orders. */
export const filterOrders = (orders = [], search = "", quick = "all") => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
        if (q && ![o.customerName, o.customerPhone, o.invoiceId].some((v) => String(v || "").toLowerCase().includes(q))) {
            return false;
        }
        if (quick === "ready") return o.ready;
        if (quick === "production") return !o.ready;
        if (quick === "unpaid") return o.balanceDue > 0;
        return true;
    });
};

export const searchDelivered = (rows = [], search = "") => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
        [r.customerName, r.customerPhone, r.invoiceId, r.receiptNo, ...(r.items || []).map((i) => i.itemName)]
            .some((v) => String(v || "").toLowerCase().includes(q)),
    );
};

/** Which view a date gets: "today" (overdue + due + delivered), "future" (expected only), "past" (delivered only). */
export const viewOf = (date, today) => (date === today ? "today" : date > today ? "future" : "past");

const sum = (list, key) => (list || []).reduce((t, o) => t + (Number(o[key]) || 0), 0);
/** Balance still to collect on the orders expected that day (the backend total also adds every earlier open order). */
export const balanceOf = (orders) => sum(orders, "balanceDue");
/** Total invoice value of the receipts in a list. */
export const deliveredValue = (rows) => sum(rows, "totalAmountWithGST");

/** Rows for the Excel export of one day, limited to the lists the view shows. */
export const exportRows = (data, view = "today") => {
    const open = (list, group) =>
        (list || []).map((o) => ({
            List: group,
            "Invoice no.": o.invoiceId,
            Customer: o.customerName || "",
            Phone: o.customerPhone || "",
            "Expected delivery": formatDate(o.expectedDeliveryDate),
            "Days late": o.daysOverdue || 0,
            Ready: o.ready ? "Yes" : "No",
            Items: (o.items || []).map((i) => `${i.itemName} (${humanize(i.status)})`).join(", "),
            "Items done": `${o.completedItemCount}/${o.itemCount}`,
            Total: o.totalAmountWithGST,
            "Balance due": o.balanceDue,
            Payment: o.paymentStatus === "Dues" ? "Unpaid" : o.paymentStatus,
            "Receipt no.": "",
            "Delivered at": "",
        }));
    const delivered = (data?.delivered || []).map((r) => ({
        List: "Delivered",
        "Invoice no.": r.invoiceId,
        Customer: r.customerName || "",
        Phone: r.customerPhone || "",
        "Expected delivery": formatDate(r.expectedDeliveryDate),
        "Days late": "",
        Ready: "",
        Items: (r.items || []).map((i) => i.itemName).join(", "),
        "Items done": r.itemCount ? `${r.itemCount}/${r.itemCount}` : "",
        Total: r.totalAmountWithGST,
        "Balance due": 0,
        Payment: "Paid",
        "Receipt no.": r.receiptNo,
        "Delivered at": formatDateTime(r.deliveredAt),
    }));
    if (view === "future") return open(data?.due, "Expected");
    if (view === "past") return delivered;
    return [...open(data?.overdue, "Overdue"), ...open(data?.due, "Due"), ...delivered];
};
