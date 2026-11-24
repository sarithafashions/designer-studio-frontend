import React from 'react';
import './OrderStatusModal.css';

const steps = [
    "ORDER_ACCEPTED",
    "CUTTING",
    "TAILOR_ASSIGNED",
    "STITCHING",
    "SHOP_ASSISTANT_ASSIGNED",
    "HEMMING",
    "IRONING",
    "ORDER_COMPLETED",
    "ORDER_DELIVERED",
];

const descriptions = {
    "ORDER_ACCEPTED": "The order has been reviewed and accepted by the tailor. Preparations are underway!",
    "CUTTING": "The tailor master has begun cutting work on the garment. Materials and initial setup are complete.",
    "TAILOR_ASSIGNED": "The tailor has been assigned for the garment.",
    "STITCHING": "The garment is being stitched and crafted with care.",
    "SHOP_ASSISTANT_ASSIGNED": "The garment has been assigned to shop assistant.",
    "HEMMING": "The sewing is complete, and the garment is now ready for hemming.",
    "IRONING": "The sewing is complete, and the garment is now ready for ironing.",
    "ORDER_COMPLETED": "The garment has been ironed and is ready to deliver",
    "ORDER_DELIVERED": "The order is complete! The garment is delivered as per the preference."
};

const OrderStatusModal = ({ customer, onClose }) => {
    const currentStatus = customer.currentItem.itemOrderStatus;
    const currentStep = steps.indexOf(currentStatus);
    console.log("customer",customer);

    return (
        <div className="view-order-status-overlay">
            <div className="view-order-status-modal">
                <div className="view-order-status-header">
                    <h2 className="view-order-status-title">Order Status</h2>
                    <span className="view-order-status-close" onClick={onClose}>&times;</span>
                </div>

                <div className="view-order-status-customer-info">
                    <p className="view-order-status-customer-name">
                        <span className="view-order-status-label">Customer Name:</span>
                        <span className="view-order-status-value">{customer?.customer?.name}</span>
                    </p>
                    <p className="view-order-status-invoice">
                        <span className="view-order-status-label">Invoice ID:</span>
                        <span className="view-order-status-value">{customer.invoiceId}</span>
                    </p>
                </div>

                <div className="view-order-status-progress-container">
                    <div className="view-order-status-timeline">
                        {steps.map((step, index) => {
                            let statusClass = '';
                            if (index < currentStep) statusClass = 'completed';
                            else if (index === currentStep) statusClass = 'current';
                            else statusClass = 'upcoming';

                            return (
                                <div key={index} className={`view-order-status-step ${statusClass}`}>
                                    <div className="view-order-status-dot-container">
                                        <div className="view-order-status-dot"></div>
                                        {index < steps.length - 1 && (
                                            <div className="view-order-status-line"></div>
                                        )}
                                    </div>
                                    <div className="view-order-status-content">
                                        <h3 className="view-order-status-step-title">{step}</h3>
                                        <p className="view-order-status-step-description">{descriptions[step]}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderStatusModal;
