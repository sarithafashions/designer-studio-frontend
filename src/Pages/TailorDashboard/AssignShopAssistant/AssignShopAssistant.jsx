import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import './AssignShopAssistant.css';
import {useNavigate} from "react-router-dom";
import { assignShopAssistant, fetchAssignableShopAssistants } from "../../../utils/workQueue.js";

const AssignShopAssistant = ({ show, onClose, order, onData }) => {
    const [tailors, setTailors] = useState([]);
    const [selectedTailor, setSelectedTailor] = useState('');
    const [loading, setLoading] = useState(false);
    const [btnLoading, setBtnLoading] = useState(false);
    const [assignedTailor, setAssignedTailor] = useState(null);

    // Passes the updated work item back so the caller can refresh
    const confirmationData = (updatedItem) => {
        onData(updatedItem || "success");
    }

    const fetchData = async () => {
        setLoading(true);
        try {
            // GET /items/assignees/shop-assistants -> [{ userId, name }] (shop assistants of the user's shop)
            const res = { data: await fetchAssignableShopAssistants() };

            if (res.data.length === 0) {
                Swal.fire({
                    title: 'No Shop Assistant Available',
                    text: 'There are no Shop Assistant registered in the Shop.',
                    icon: 'warning',
                    confirmButtonColor: '#3b82f6',
                    willClose: () => onClose(),
                });
                setTailors([]);
            } else {
                setTailors(res.data);
                if (order.currentItem?.assignedToWhichShopAssistant) {
                    const assigned = res.data.find(tailor => tailor.userId === order.currentItem.assignedToWhichShopAssistant);
                    if (assigned) {
                        setAssignedTailor(assigned.name);
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching Shop Assistant:", error);
            Swal.fire({
                title: 'Error',
                text: 'Failed to fetch Shop Assistant. Please try again.',
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
                title: 'Select Shop Assistant',
                text: 'Please select a Shop Assistant before assigning',
                icon: 'warning',
                confirmButtonColor: '#3b82f6'
            });
            return;
        }

        try {
            setBtnLoading(true);

            // PUT /invoices/{invoiceId}/items/{itemUniqueId}/shop-assistant { shopAssistantId } -> the updated item
            // (allowed from STITCHING: stitch first, then hand over)
            const updatedItem = await assignShopAssistant(order.invoiceId, order.currentItem.itemUniqueId, selectedTailor.userId);
            const response = { status: 200, data: { tailorName: updatedItem.shopAssistant?.name || selectedTailor.name } };

            if (response.status === 200) {
                Swal.fire({
                    title: 'Success!',
                    text: `Order #${order.invoiceId} successfully assigned to ${response.data.tailorName}`,
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
                text: error.response?.data?.message || error.message || 'Could not assign the shop assistant.',
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
                    <h3 className="assign-tailor-title">Assign Shop Assistant</h3>
                    <div className="assign-tailor-order-info">
                        <div className="assign-tailor-info-row">
                            <span className="assign-tailor-label">Customer:</span>
                            <span className="assign-tailor-value">{order.customer?.customerId || order.customer?.name || order.customerName}</span>
                        </div>
                        <div className="assign-tailor-info-row">
                            <span className="assign-tailor-label">Invoice ID:</span>
                            <span className="assign-tailor-value">{order.invoiceId}</span>
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
                    <label className="assign-tailor-select-label">Select Shop Assistant:</label>

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
                            <option value="">-- Select Shop Assistant --</option>
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

export default AssignShopAssistant;
