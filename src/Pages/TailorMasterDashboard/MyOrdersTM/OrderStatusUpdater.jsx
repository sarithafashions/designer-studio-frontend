import React, { useState } from "react";
import Swal from "sweetalert2";
import { updateItemStatus } from "../../../utils/workQueue.js";

const OrderStatusUpdater = ({ order, item, onItemRemove }) => {
    const [statusUpdates, setStatusUpdates] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    const handleOrderStatusUpdate = async () => {
        setIsLoading(true);
        const updatedStatus = statusUpdates[item.itemUniqueId];
        if (!updatedStatus) {
            Swal.fire({
                icon: "warning",
                title: "An error occurred",
                text: "Please select a status to update.",
                confirmButtonText: "OK",
            });
            setIsLoading(false);
            return;
        }
        try {
            // PATCH /invoices/{invoiceId}/items/{itemUniqueId}/status { status }
            await updateItemStatus(order.invoiceId, item.itemUniqueId, updatedStatus);
            Swal.fire({
                icon: "success",
                title: "Success",
                text: "Status updated successfully.",
            });

            if (onItemRemove) {
                onItemRemove(item.itemUniqueId);
            }
        } catch (error) {
            console.error("Failed to update status:", error);
            Swal.fire({
                icon: "error",
                title: "An error occurred",
                text: error.response?.data?.message || error.message || "Failed to update status.",
                confirmButtonText: "OK",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <td>
                <select
                    className="tailor-master-dashboard-status-select"
                    value={statusUpdates[item.itemUniqueId] || ""}
                    onChange={(e) => {
                        const newStatus = e.target.value;
                        setStatusUpdates((prev) => ({
                            ...prev,
                            [item.itemUniqueId]: newStatus,
                        }));
                    }}
                >
                    <option value="">--Select--</option>
                    <option value="CUTTING">CUTTING</option>
                </select>
            </td>
            <td>
                <button
                    className="tailor-master-dashboard-assign-btn"
                    onClick={handleOrderStatusUpdate}
                    disabled={isLoading}
                >
                    {isLoading ? "Updating" : "Update"}
                </button>
            </td>
        </>
    );
};

export default OrderStatusUpdater;
