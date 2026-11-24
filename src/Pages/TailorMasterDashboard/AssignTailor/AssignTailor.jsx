import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import './AssignTailor.css';
import { assignTailor, fetchAssignableTailors } from "../../../utils/workQueue.js";
import {useNavigate} from "react-router-dom";

const AssignTailor = ({ show, onClose, order, onData }) => {
    const [tailors, setTailors] = useState([]);
    const [selectedTailor, setSelectedTailor] = useState('');
    const [loading, setLoading] = useState(false);
    const [btnLoading, setBtnLoading] = useState(false);
    const [assignedTailor, setAssignedTailor] = useState(null);

    // Passes the updated work item back so the caller can refresh that row
    const confirmationData = (updatedItem) => {
        onData(updatedItem || "success");
    }

    // console.log("ordersss",order)
    console.log("show",show)
    console.log("onDATA",onData)

    const fetchData = async () => {
        setLoading(true);
        try {
            // GET /items/assignees/tailors -> [{ userId, name }] (tailors of the user's shop)
            const res = { data: await fetchAssignableTailors() };
            // console.log("res",res.data);

            if (res.data.length === 0) {
                Swal.fire({
                    title: 'No Tailors Available',
                    text: 'There are no tailors registered in the Shop.',
                    icon: 'warning',
                    confirmButtonColor: '#3b82f6',
                    willClose: () => onClose(),
                });
                setTailors([]);
            } else {
                setTailors(res.data);
                if (order.currentItem?.assignedTo) {
                    const assigned = res.data.find(tailor => tailor.userId === order.currentItem.assignedTo);
                    if (assigned) {
                        setAssignedTailor(assigned.name);
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching tailors:", error);
            Swal.fire({
                title: 'Error',
                text: 'Failed to fetch tailors. Please try again.',
                icon: 'error',
                confirmButtonColor: '#ef4444',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (show) {
            fetchData();
        }
    }, [show]);

    useEffect(() => {
        if (!show) {
            setSelectedTailor('');
        }
    }, [show]);

    const handleAssignOrder = async () => {
        if (!selectedTailor) {
            Swal.fire({
                title: 'Select Tailor',
                text: 'Please select a tailor before assigning',
                icon: 'warning',
                confirmButtonColor: '#3b82f6'
            });
            return;
        }

        try {
            setBtnLoading(true);

            // PUT /invoices/{invoiceId}/items/{itemUniqueId}/tailor { tailorId } -> the updated work item
            const updatedItem = await assignTailor(order.orderData.invoiceId, order.currentItem.itemUniqueId, selectedTailor.userId);
            const response = { status: 200, data: { tailorName: updatedItem.tailor?.name || selectedTailor.name } };
            if (response.status === 200) {
                Swal.fire({
                    title: 'Success!',
                    text: `Order #${order?.orderData?.invoiceId} successfully assigned to ${response.data.tailorName}`,
                    icon: 'success',
                    confirmButtonColor: '#10b981',
                    willClose: () => {
                        onClose();
                        setSelectedTailor('');
                    }
                });
                confirmationData(updatedItem);
            }

        } catch (error) {
            console.error('Error assigning order:', error);
            Swal.fire({
                title: 'Failed!',
                text: error.response?.data?.message || error.message || 'Could not assign the tailor.',
                icon: 'error',
                confirmButtonColor: '#ef4444'
            });
        } finally {
            setBtnLoading(false);
        }
    };


    const handleCancel = () => {
        onClose();
        setSelectedTailor('');
        setAssignedTailor(null);
    };

    if (!show) return null;

    return (
        <div className="assign-tailor-overlay">
            <div className="assign-tailor-modal">
                <div className="assign-tailor-header">
                    <h3 className="assign-tailor-title">Assign Tailors</h3>
                    <div className="assign-tailor-order-info">
                        <div className="assign-tailor-info-row">
                            <span className="assign-tailor-label">Customer ID:</span>
                            <span className="assign-tailor-value">{order?.orderData?.customer?.customerId}</span>
                        </div>
                        <div className="assign-tailor-info-row">
                            <span className="assign-tailor-label">Invoice ID:</span>
                            <span className="assign-tailor-value">{order?.orderData?.invoiceId}</span>
                        </div>
                    </div>
                </div>

                <div className="assign-tailor-body">
                    {
                        !loading &&
                        <>
                            {assignedTailor ? (
                                <div className="assign-tailor-assigned-message">
                                    <p>This order is already assigned to <strong
                                        className="assign-tailor-highlight">{assignedTailor}</strong>.</p>
                                </div>
                            ) : null}
                        </>
                    }
                    <label className="assign-tailor-select-label">Select Tailor:</label>

                    {loading ? (
                        <div className="assign-tailor-skeleton-loader"></div>
                    ) : (
                        <select
                            value={selectedTailor?.userId || ''}
                            onChange={(e) => {
                                const selected = tailors.find(t => t.userId === e.target.value);
                                setSelectedTailor(selected || '');
                            }}
                            className="assign-tailor-select"
                        >
                            <option value="">-- Select Tailor --</option>
                            {tailors.map((tailor, idx) => (
                                <option key={idx} value={tailor.userId}>
                                    {tailor.name}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                <div className="assign-tailor-footer">
                    <button
                        className="assign-tailor-btn assign-tailor-cancel-btn"
                        onClick={handleCancel}
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        className="assign-tailor-btn assign-tailor-confirm-btn"
                        onClick={handleAssignOrder}
                        disabled={!selectedTailor || btnLoading}
                    >
                        {btnLoading ? "Loading..." : "Assign Order"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AssignTailor;













