import React, { useEffect, useState } from 'react';
import demoImage from '../../../assets/no-images.png';
import './OrderDetails.css';
import {useLocation, useNavigate, useParams} from "react-router-dom";
import DateConverterToIST from "../../../config/DateConverterToIST.jsx";
import { fetchQueueInvoices, toLegacyItem } from "../../../utils/workQueue.js";
import Swal from "sweetalert2";
import MeasurementModal from "../../../Components/common/MeasurementModal.jsx";
import OrderStatusUpdater from "../MyOrdersTM/OrderStatusUpdater.jsx";
import TailorMasterTrackStatus from "../TailorMasterTrackStatus.jsx";
import AssignTailor from "../AssignTailor/AssignTailor.jsx";

const OrderDetails = () => {
    const { invoiceId } = useParams();
    const { state } = useLocation();
    // console.log(state);
    const location = useLocation();
    const basePath = location.pathname.split("/").slice(0, 3).join("/");


    const [orderData, setOrderData] = useState(state?.orderData || null);

    // console.log("orderData", orderData);
    const [selectedDesign, setSelectedDesign] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(!state?.orderData);
    const navigate = useNavigate();

    //tailor master view and assign

    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [showTrackStatus, setShowTrackStatus] = useState(false);
    const [showAssignPopup, setShowAssignPopup] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [assigned, setAssigned] = useState(null);

    const handleAssignClick = (order, currentItem) => {
        setSelectedOrder(order);
        console.log("setSelectedOrder", order);
        setShowAssignPopup(true);
    };

    const handleTrackStatusView = (order) => {
        setSelectedCustomer(order);
        setShowTrackStatus(true);
    };

    // After an assignment: refresh that item's row with the work item the backend returned
    const handleConfirmationData = (updatedItem) => {
        setAssigned("ASSIGNED");
        if (updatedItem && updatedItem.itemUniqueId) {
            setOrders(prev => prev.map(item =>
                item.itemUniqueId === updatedItem.itemUniqueId ? { ...item, ...toLegacyItem(updatedItem) } : item
            ));
        }
    };


    const isValidIdFormat = (id) => {
        return /^\d{4}-\d{2}-\d{2}-\d{4}-\d{5}$/.test(id);
    };

    // useEffect(() => {
    //     const idToValidate = orderID.orderId || invoiceId;
    //
    //     if (!idToValidate || !isValidIdFormat(idToValidate)) {
    //         navigate('*');
    //     }
    //
    // }, [orderID.constructor, invoiceId, navigate]);

    useEffect(() => {
        const fetchOrderDetails = async () => {
            try {
                // The order's items from the user's work queue (the tailor master can't read invoices).
                // On the "my-orders" (cutting) page only items still waiting for cutting are shown.
                const statuses = basePath === "/tailorMaster/my-orders" ? ["ORDER_ACCEPTED"] : [];
                const invoice = (await fetchQueueInvoices(statuses)).find(inv => inv.invoiceId === invoiceId);
                if (!invoice) {
                    throw new Error(`Order ${invoiceId} has no items in your work queue.`);
                }
                setOrderData(invoice);
            } catch (error) {
                Swal.fire({
                    icon: "error",
                    title: "Error",
                    text: error?.response?.data?.message || error.message || "Failed to fetch order details",
                });
            } finally {
                setLoading(false);
            }
        };

        if (!orderData) {
            fetchOrderDetails();
        }
    }, [invoiceId]);

    const handleViewDesign = (itemName, imageUrl) => {
        setSelectedDesign({
            title: itemName,
            image: imageUrl || demoImage,
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedDesign(null);
    };

    // this code for measurements popup
    const [selectedMeasurements, setSelectedMeasurements] = useState(null);
    const [showMeasurementModal, setShowMeasurementModal] = useState(false);
    const handleViewMeasurements = React.useCallback((order) => {
        setSelectedMeasurements({
            title: order.itemName,
            measurements: order.measurements || {}
        });
        setShowMeasurementModal(true);
    }, []);

    const [orders, setOrders] = useState(orderData?.items || []);
    // When the order is loaded after the first render (opened by URL), show its items
    useEffect(() => {
        if (orderData?.items) {
            setOrders(orderData.items);
        }
    }, [orderData]);
    // console.log("orders",orders);

    return (
        <div className="order-details--container">
            {loading ? (
                <div className="order-details--spinner"></div>
            ) : (
                <>
                    <div className="order-details--header">
                        <button className="total-receipts-container-back-btn"
                                onClick={() => navigate(-1)}
                        >
                            Back
                        </button>
                        <h2 className="order-details--title">Order Items</h2>
                        <p className="order-details--customer-info">
                            Customer Name: <strong>{orderData?.customer?.name}</strong> | Invoice
                            ID: <strong>{orderData?.invoiceId}</strong>
                        </p>
                    </div>

                    <div className="order-details--table-wrapper">
                        <table className="order-details--table">
                            <thead>
                            <tr className="order-details--table-header">
                                <th className="order-details--table-head">Order Date</th>
                                <th className="order-details--table-head">Item Name</th>
                                <th className="order-details--table-head">Qty</th>
                                <th className="order-details--table-head">Measurement</th>
                                <th className="order-details--table-head">Design</th>
                                <th className="order-details--table-head">Status</th>
                                {basePath === "/tailorMaster/my-orders" && (
                                    <>
                                        <th className="order-details--table-head">Actions</th>
                                    </>
                                )}
                            </tr>
                            </thead>
                            <tbody>
                            {orders.map((order, index) => (
                                <tr key={order.id || index} className="order-details--table-row">
                                    <td className="order-details--table-cell order-details--date-cell">
                                        <input
                                            type="text"
                                            value={DateConverterToIST(orderData.invoiceDate)}
                                            readOnly
                                            className="order-details--input"
                                        />
                                    </td>
                                    <td className="order-details--table-cell order-details--item-cell">
                                        <input
                                            type="text"
                                            value={order.itemName}
                                            readOnly
                                            className="order-details--input"
                                        />
                                    </td>
                                    <td className="order-details--table-cell order-details--quantity-cell">
                                        <input
                                            type="number"
                                            value={order.itemQuantity}
                                            readOnly
                                            className="order-details--input order-details--quantity-input"
                                        />
                                    </td>
                                    <td className="order-details--table-cell order-details--measurement-cell">
                                        <button className="order-details--measurement-btn" onClick={()=> handleViewMeasurements(order)}>
                                            View
                                        </button>
                                    </td>
                                    <td className="order-details--table-cell order-details--design-cell">
                                        <button
                                            className="order-details--design-btn"
                                            onClick={() =>
                                                handleViewDesign(order.itemName, order.imageUrl)
                                            }
                                        >
                                            View Design
                                        </button>
                                    </td>

                                    {basePath === "/tailorMaster/my-orders" ? (
                                        <OrderStatusUpdater
                                            order={orderData}
                                            item={order}
                                            onItemRemove={(itemId) => {
                                                setOrders((prevOrders) =>
                                                    prevOrders.filter((o) => o.itemUniqueId !== itemId)
                                                );
                                            }}
                                        />
                                    ):
                                        <td>
                                            <button
                                                className={`tailor-master-dashboard-assign-btn ${
                                                    order.assignmentStatus ? 'assigned ' : ''
                                                }`}
                                                // availableActions (from the work queue) says whether this user may assign now
                                                disabled={Array.isArray(order.availableActions) && !order.availableActions.includes("ASSIGN_TAILOR")}
                                                title={Array.isArray(order.availableActions) && !order.availableActions.includes("ASSIGN_TAILOR")
                                                    ? "A tailor can be assigned after cutting (and before a shop assistant is assigned)" : ""}
                                                onClick={() => handleAssignClick({orderData, currentItem: order})}
                                            >
                                                {order.assignmentStatus ? 'ASSIGNED' : 'Assign Tailor'}
                                            </button>
                                            <button
                                                className="tailor-master-dashboard-details-btn"
                                                onClick={() => handleTrackStatusView({...order, currentItem: order})}
                                            >
                                                Track Status
                                            </button>
                                        </td>
                                    }
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {showModal && (
                <div className="order-details--modal">
                    <div className="order-details--modal-overlay" onClick={closeModal}></div>
                    <div className="order-details--modal-content">
                        <button className="order-details--modal-close" onClick={closeModal}>
                            &times;
                        </button>
                        <h3 className="order-details--modal-title">{selectedDesign.title} Design</h3>
                        <div className="order-details--modal-image-wrapper">
                            <img
                                src={selectedDesign.image}
                                alt={`Design for ${selectedDesign.title}`}
                                onError={(e) => (e.target.src = demoImage)}
                                className="order-details--modal-image"
                            />
                        </div>
                    </div>
                </div>
            )}

            {showMeasurementModal && (
                <MeasurementModal
                    itemName={selectedMeasurements.title}
                    measurements={selectedMeasurements.measurements}
                    existingMeasurements={selectedMeasurements.measurements}
                    onClose={() => setShowMeasurementModal(false)}
                    readOnly={true}
                />
            )}

            {/*assign components*/}
            <AssignTailor
                show={showAssignPopup}
                onClose={() => setShowAssignPopup(false)}
                order={selectedOrder || {}}
                onData={handleConfirmationData}
            />

            {/* Track Status Modal */}
            {showTrackStatus && selectedCustomer && (
                <TailorMasterTrackStatus customer={selectedCustomer} onClose={() => setShowTrackStatus(false)} />
            )}
        </div>
    );
};

export default OrderDetails;
