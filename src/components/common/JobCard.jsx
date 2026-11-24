import React, { useState } from 'react';
import {
    FaRulerVertical,
    FaHistory,
    FaUserCheck,
    FaCheck,
    FaPlay,
    FaCut,
    FaTshirt,
    FaCalendarAlt,
    FaUser,
} from 'react-icons/fa';
import { getDeliveryUrgency, getStatusMeta, formatDisplayDate } from '../../utils/urgencyHelper.js';
import MeasurementModal from './MeasurementModal.jsx';
import './JobCard.css';

/**
 * Reusable Production Job Card for Staff Boards (Tailor, Master, Shop Assistant)
 */
const JobCard = ({
    order,
    item,
    role = 'tailor', // 'tailor' | 'tailorMaster' | 'shopAssistant'
    onStatusUpdate,
    onAssignTailor,
    onAssignShopAssistant,
    onTrackStatus,
    onToggleCheck,
    isChecked = false,
}) => {
    const [showMeasurements, setShowMeasurements] = useState(false);

    const urgency = getDeliveryUrgency(order.expectedDeliveryDate);
    const statusMeta = getStatusMeta(item.itemOrderStatus || item.status);

    const customerName = order.customer?.name || order.customerName || 'Customer';
    const invoiceId = order.invoiceId || order.id || 'N/A';
    const itemName = item.itemName || 'Garment';
    const quantity = item.itemQuantity || 1;
    const currentStatus = item.itemOrderStatus || item.status || '';

    // Handle primary action depending on role and current item status
    const renderPrimaryAction = () => {
        if (role === 'tailor') {
            if (currentStatus === 'TAILOR_ASSIGNED') {
                return (
                    <button
                        onClick={() => onStatusUpdate && onStatusUpdate(order, item, 'STITCHING')}
                        className="job-card-btn job-card-btn-primary flex items-center justify-center gap-1.5"
                        title="Start Stitching"
                    >
                        <FaPlay className="text-xs" />
                        <span>Start Stitching</span>
                    </button>
                );
            }
            if (currentStatus === 'STITCHING') {
                return (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            onClick={() => onAssignShopAssistant && onAssignShopAssistant(order, item)}
                            className={`job-card-btn ${
                                item.shopAssistantStatus === 'ASSIGNED'
                                    ? 'job-card-btn-assigned'
                                    : 'job-card-btn-secondary'
                            } flex items-center justify-center gap-1.5`}
                            title="Assign Shop Assistant"
                        >
                            <FaUserCheck className="text-xs" />
                            <span>
                                {item.shopAssistantStatus === 'ASSIGNED'
                                    ? item.assignedShopAssistantName || 'Assistant Assigned'
                                    : 'Assign Assistant'}
                            </span>
                        </button>
                    </div>
                );
            }
        }

        if (role === 'tailorMaster') {
            if (currentStatus === 'ORDER_ACCEPTED') {
                return (
                    <button
                        onClick={() => onStatusUpdate && onStatusUpdate(order, item, 'CUTTING')}
                        className="job-card-btn job-card-btn-primary flex items-center justify-center gap-1.5"
                    >
                        <FaCut className="text-xs" />
                        <span>Mark Cut</span>
                    </button>
                );
            }
            return (
                <button
                    onClick={() => onAssignTailor && onAssignTailor(order, item)}
                    className={`job-card-btn ${
                        item.assignmentStatus === 'ASSIGNED' || item.assignedTo
                            ? 'job-card-btn-assigned'
                            : 'job-card-btn-primary'
                    } flex items-center justify-center gap-1.5`}
                >
                    <FaUserCheck className="text-xs" />
                    <span>
                        {item.assignmentStatus === 'ASSIGNED' || item.assignedTailorName
                            ? `Tailor: ${item.assignedTailorName || 'Assigned'}`
                            : 'Assign Tailor'}
                    </span>
                </button>
            );
        }

        if (role === 'shopAssistant') {
            if (currentStatus === 'SHOP_ASSISTANT_ASSIGNED') {
                return (
                    <button
                        onClick={() => onStatusUpdate && onStatusUpdate(order, item, 'IRONING')}
                        className="job-card-btn job-card-btn-primary flex items-center justify-center gap-1.5"
                    >
                        <FaPlay className="text-xs" />
                        <span>Start Ironing</span>
                    </button>
                );
            }
            if (currentStatus === 'IRONING' || currentStatus === 'HEMMING') {
                return (
                    <button
                        onClick={() => onStatusUpdate && onStatusUpdate(order, item, 'READY_FOR_DELIVERY')}
                        className="job-card-btn job-card-btn-success flex items-center justify-center gap-1.5"
                    >
                        <FaCheck className="text-xs" />
                        <span>Mark Ready</span>
                    </button>
                );
            }
        }

        return null;
    };

    return (
        <div className="job-card-container">
            {/* Top row: Checkbox, Invoice ID, and Due Urgency Badge */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                    {onToggleCheck && (
                        <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => onToggleCheck(order.id || order.invoiceId)}
                            className="w-4 h-4 rounded border-slate-300 text-brand-maroon focus:ring-brand-maroon cursor-pointer"
                            aria-label={`Select order ${invoiceId}`}
                        />
                    )}
                    <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                        #{invoiceId}
                    </span>
                </div>

                {/* Due Date Urgency Pill */}
                <div
                    className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs transition-all ${urgency.badgeClass}`}
                    title={order.expectedDeliveryDate ? `Due: ${order.expectedDeliveryDate}` : 'No due date'}
                >
                    <span className={`w-2 h-2 rounded-full ${urgency.dotClass}`} />
                    <span>{urgency.label}</span>
                </div>
            </div>

            {/* Garment Details & Status */}
            <div className="flex items-start justify-between gap-3 pt-1">
                <div className="flex items-start gap-2.5">
                    <div className="w-10 h-10 rounded-lg bg-brand-maroon/10 text-brand-maroon flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FaTshirt className="text-lg" />
                    </div>
                    <div>
                        <h4 className="text-base font-bold text-slate-900 leading-tight">
                            {itemName}
                            {quantity > 1 && (
                                <span className="ml-2 text-xs font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                                    ×{quantity}
                                </span>
                            )}
                        </h4>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                            <FaUser className="text-[10px] text-slate-400" />
                            <span className="font-medium text-slate-700">{customerName}</span>
                        </p>
                    </div>
                </div>

                {/* Stage Badge */}
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${statusMeta.badgeClass}`}>
                    {statusMeta.label}
                </span>
            </div>

            {/* Middle Info Meta */}
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1.5">
                    <FaCalendarAlt className="text-slate-400 text-xs" />
                    <span>Ordered: <strong className="text-slate-700">{formatDisplayDate(order.invoiceDate)}</strong></span>
                </div>
                <div className="truncate">
                    {item.assignedTailorName ? (
                        <span>✂️ Tailor: <strong className="text-slate-800">{item.assignedTailorName}</strong></span>
                    ) : item.assignedShopAssistantName ? (
                        <span>🧵 Assistant: <strong className="text-slate-800">{item.assignedShopAssistantName}</strong></span>
                    ) : (
                        <span className="text-slate-400 italic">No staff assigned</span>
                    )}
                </div>
            </div>

            {/* Bottom Actions Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                    {/* View Measurements Tap */}
                    <button
                        type="button"
                        onClick={() => setShowMeasurements(true)}
                        className="job-card-btn job-card-btn-outline flex items-center gap-1.5"
                        title="View Measurements"
                    >
                        <FaRulerVertical className="text-xs text-brand-maroon" />
                        <span>Measurements</span>
                    </button>

                    {/* Track Status */}
                    {onTrackStatus && (
                        <button
                            type="button"
                            onClick={() => onTrackStatus({ ...order, currentItem: item })}
                            className="job-card-btn job-card-btn-ghost flex items-center gap-1.5"
                            title="Timeline & Track Status"
                        >
                            <FaHistory className="text-xs text-slate-500" />
                            <span className="hidden sm:inline">Track</span>
                        </button>
                    )}
                </div>

                {/* Role Specific Action */}
                <div className="flex items-center gap-2">
                    {renderPrimaryAction()}
                </div>
            </div>

            {/* Read-Only Measurement Modal */}
            {showMeasurements && (
                <MeasurementModal
                    onClose={() => setShowMeasurements(false)}
                    itemName={itemName}
                    measurements={item.measurements || item.measurementList || {}}
                    existingMeasurements={item.measurements || item.measurementList || {}}
                    readOnly={true}
                />
            )}
        </div>
    );
};

export default JobCard;
