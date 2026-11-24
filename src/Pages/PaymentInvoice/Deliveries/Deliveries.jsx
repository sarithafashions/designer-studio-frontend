import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import axiosInstance from "../../LoginPages/axios.js";
import { downloadPdf } from "../../../utils/downloadPdf.js";
import "./Deliveries.css";

// Today's delivery dashboard (client requirement): GET /reports/deliveries?date=yyyy-MM-dd
//   due       - not delivered, expected delivery on the date (ready orders first)
//   overdue   - not delivered, expected delivery before the date (most overdue first)
//   delivered - receipts generated on the date
//   summary   - counts + balance still to collect on due and overdue orders

const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // yyyy-MM-dd

const money = (value) =>
    `₹${(Number(value) || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const formatDate = (value) =>
    value ? new Date(value).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric" }) : "-";

const formatTime = (value) =>
    value ? new Date(value).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }) : "-";

const statusLabel = (status) => (status || "").replace(/_/g, " ").toLowerCase();

const Deliveries = () => {
    const navigate = useNavigate();
    const [date, setDate] = useState(todayIST());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [downloading, setDownloading] = useState("");

    const load = useCallback(async (day) => {
        setLoading(true);
        setError("");
        try {
            const response = await axiosInstance.get("/reports/deliveries", { params: { date: day } });
            setData(response.data);
        } catch (err) {
            setData(null);
            setError(err.response?.data?.message || "Could not load the deliveries.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load(date);
    }, [date, load]);

    // Opens the invoice page (payments, receipt, items)
    const openInvoice = (invoiceId) => {
        navigate(`/shopOwner/invoices/${encodeURIComponent(invoiceId)}`);
    };

    const downloadReceipt = async (receiptNo) => {
        setDownloading(receiptNo);
        try {
            await downloadPdf(`/receipts/${encodeURIComponent(receiptNo)}/pdf`, `${receiptNo}.pdf`);
        } catch (err) {
            Swal.fire({ icon: "error", title: "Error", text: err.response?.data?.message || "Could not download the receipt." });
        } finally {
            setDownloading("");
        }
    };

    const summary = data?.summary;
    const isToday = date === todayIST();

    const renderOrder = (order, kind) => (
        <div key={order.invoiceId} className={`deliveries-card ${kind === "overdue" ? "is-overdue" : order.ready ? "is-ready" : ""}`}>
            <div className="deliveries-card-head">
                <div>
                    <div className="deliveries-customer">{order.customerName || "-"}</div>
                    <div className="deliveries-muted">
                        {order.customerPhone ? <a href={`tel:${order.customerPhone}`}>{order.customerPhone}</a> : "-"}
                        {" · "}{order.invoiceId}
                    </div>
                </div>
                <div className="deliveries-badges">
                    {kind === "overdue" && (
                        <span className="deliveries-badge overdue">
                            {order.daysOverdue} day{order.daysOverdue === 1 ? "" : "s"} late
                        </span>
                    )}
                    <span className={`deliveries-badge ${order.ready ? "ready" : "progress"}`}>
                        {order.ready ? "Ready" : `In production ${order.completedItemCount}/${order.itemCount}`}
                    </span>
                </div>
            </div>

            <ul className="deliveries-items">
                {(order.items || []).map((item, index) => (
                    <li key={index}>
                        <span>{item.itemName} × {item.itemQuantity}</span>
                        <span className={`deliveries-item-status ${item.status === "ORDER_COMPLETED" ? "done" : ""}`}>
                            {statusLabel(item.status)}
                        </span>
                    </li>
                ))}
            </ul>

            <div className="deliveries-card-foot">
                <div className="deliveries-muted">
                    Due {formatDate(order.expectedDeliveryDate)} · Total {money(order.totalAmountWithGST)}
                    {order.balanceDue > 0
                        ? <> · <strong className="deliveries-balance">To collect {money(order.balanceDue)}</strong></>
                        : <> · <strong className="deliveries-paid">Paid</strong></>}
                </div>
                <button className="deliveries-btn" onClick={() => openInvoice(order.invoiceId)}>
                    {order.balanceDue > 0 ? "Collect payment" : order.ready ? "Deliver" : "Open"}
                </button>
            </div>
        </div>
    );

    const section = (title, list, kind, emptyText) => (
        <section className="deliveries-section">
            <h3>{title} <span className="deliveries-count">{list?.length || 0}</span></h3>
            {list && list.length > 0
                ? <div className="deliveries-grid">{list.map(order => renderOrder(order, kind))}</div>
                : <p className="deliveries-empty">{emptyText}</p>}
        </section>
    );

    return (
        <div className="deliveries-page">
            <div className="deliveries-header">
                <h2>{isToday ? "Today's deliveries" : `Deliveries on ${formatDate(date)}`}</h2>
                <div className="deliveries-date">
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value || todayIST())} />
                    {!isToday && <button className="deliveries-btn secondary" onClick={() => setDate(todayIST())}>Today</button>}
                    <button className="deliveries-btn secondary" onClick={() => load(date)} disabled={loading}>Refresh</button>
                </div>
            </div>

            {error && <p className="deliveries-error">{error}</p>}

            {loading && !data ? (
                <p className="deliveries-empty">Loading…</p>
            ) : summary && (
                <>
                    <div className="deliveries-summary">
                        <div className="deliveries-stat">
                            <span>Due {isToday ? "today" : "this day"}</span>
                            <strong>{summary.dueCount}</strong>
                            <small>{summary.dueReadyCount} ready · {summary.dueInProductionCount} in production</small>
                        </div>
                        <div className="deliveries-stat overdue">
                            <span>Overdue</span>
                            <strong>{summary.overdueCount}</strong>
                            <small>not delivered after the due date</small>
                        </div>
                        <div className="deliveries-stat done">
                            <span>Delivered</span>
                            <strong>{summary.deliveredCount}</strong>
                            <small>receipts generated</small>
                        </div>
                        <div className="deliveries-stat">
                            <span>To collect</span>
                            <strong>{money(summary.balanceToCollect)}</strong>
                            <small>on due + overdue orders</small>
                        </div>
                    </div>

                    {summary.withoutDeliveryDateCount > 0 && (
                        <p className="deliveries-note">
                            {summary.withoutDeliveryDateCount} open order{summary.withoutDeliveryDateCount === 1 ? " has" : "s have"} no
                            delivery date and {summary.withoutDeliveryDateCount === 1 ? "is" : "are"} not listed. Set it in View &amp; Edit Order.
                        </p>
                    )}

                    {section("Overdue", data.overdue, "overdue", "No overdue orders.")}
                    {section(isToday ? "Due today" : "Due on this day", data.due, "due", "No orders due on this day.")}

                    <section className="deliveries-section">
                        <h3>Delivered <span className="deliveries-count">{data.delivered?.length || 0}</span></h3>
                        {data.delivered && data.delivered.length > 0 ? (
                            <div className="deliveries-table-wrap">
                                <table className="deliveries-table">
                                    <thead>
                                    <tr>
                                        <th>Time</th>
                                        <th>Receipt</th>
                                        <th>Invoice</th>
                                        <th>Customer</th>
                                        <th>Total</th>
                                        <th></th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {data.delivered.map(row => (
                                        <tr key={row.receiptNo}>
                                            <td>{formatTime(row.deliveredAt)}</td>
                                            <td>{row.receiptNo}</td>
                                            <td>{row.invoiceId}</td>
                                            <td>{row.customerName}{row.customerPhone ? ` (${row.customerPhone})` : ""}</td>
                                            <td>{money(row.totalAmountWithGST)}</td>
                                            <td>
                                                <button className="deliveries-btn secondary"
                                                        disabled={downloading === row.receiptNo}
                                                        onClick={() => downloadReceipt(row.receiptNo)}>
                                                    {downloading === row.receiptNo ? "…" : "Receipt PDF"}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : <p className="deliveries-empty">Nothing delivered on this day yet.</p>}
                    </section>
                </>
            )}
        </div>
    );
};

export default Deliveries;
