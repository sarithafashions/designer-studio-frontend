// Helper functions for delivery urgency and status styling across staff production views

/**
 * Evaluates urgency of an expected delivery date relative to today.
 * @param {string|Date} expectedDeliveryDate
 * @returns {object} { level: 'overdue'|'today'|'tomorrow'|'normal'|'none', label: string, badgeClass: string, textClass: string, bgClass: string, daysLeft: number }
 */
export const getDeliveryUrgency = (expectedDeliveryDate) => {
    if (!expectedDeliveryDate) {
        return {
            level: 'none',
            label: 'No Due Date',
            badgeClass: 'bg-slate-100 text-slate-600 border border-slate-200',
            dotClass: 'bg-slate-400',
            daysLeft: null,
        };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = new Date(expectedDeliveryDate);
    due.setHours(0, 0, 0, 0);

    if (isNaN(due.getTime())) {
        return {
            level: 'none',
            label: 'Invalid Date',
            badgeClass: 'bg-slate-100 text-slate-600 border border-slate-200',
            dotClass: 'bg-slate-400',
            daysLeft: null,
        };
    }

    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        const overdueDays = Math.abs(diffDays);
        return {
            level: 'overdue',
            label: overdueDays === 1 ? 'Overdue by 1 day' : `Overdue by ${overdueDays} days`,
            badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200 font-semibold',
            dotClass: 'bg-rose-500 animate-pulse',
            daysLeft: diffDays,
        };
    }

    if (diffDays === 0) {
        return {
            level: 'today',
            label: 'Due Today 🔥',
            badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300 font-semibold',
            dotClass: 'bg-amber-500',
            daysLeft: 0,
        };
    }

    if (diffDays === 1) {
        return {
            level: 'tomorrow',
            label: 'Due Tomorrow',
            badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200',
            dotClass: 'bg-amber-400',
            daysLeft: 1,
        };
    }

    if (diffDays <= 3) {
        return {
            level: 'soon',
            label: `Due in ${diffDays} days`,
            badgeClass: 'bg-sky-50 text-sky-800 border border-sky-200',
            dotClass: 'bg-sky-400',
            daysLeft: diffDays,
        };
    }

    return {
        level: 'normal',
        label: `Due in ${diffDays} days`,
        badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        dotClass: 'bg-emerald-500',
        daysLeft: diffDays,
    };
};

/**
 * Returns human-readable label and styling for an item's production status.
 * @param {string} status
 * @returns {object} { label: string, badgeClass: string, isTerminal: boolean }
 */
export const getStatusMeta = (status) => {
    switch (status) {
        case 'ORDER_ACCEPTED':
            return {
                label: 'Cutting Queue',
                badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
                isTerminal: false,
            };
        case 'CUTTING':
            return {
                label: 'In Cutting',
                badgeClass: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
                isTerminal: false,
            };
        case 'TAILOR_ASSIGNED':
            return {
                label: 'Assigned to Tailor',
                badgeClass: 'bg-purple-50 text-purple-700 border border-purple-200',
                isTerminal: false,
            };
        case 'STITCHING':
            return {
                label: 'In Stitching',
                badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200',
                isTerminal: false,
            };
        case 'SHOP_ASSISTANT_ASSIGNED':
            return {
                label: 'Assigned Assistant',
                badgeClass: 'bg-cyan-50 text-cyan-800 border border-cyan-200',
                isTerminal: false,
            };
        case 'HEMMING':
            return {
                label: 'In Hemming',
                badgeClass: 'bg-teal-50 text-teal-800 border border-teal-200',
                isTerminal: false,
            };
        case 'IRONING':
            return {
                label: 'In Ironing',
                badgeClass: 'bg-teal-50 text-teal-800 border border-teal-200',
                isTerminal: false,
            };
        case 'READY_FOR_DELIVERY':
            return {
                label: 'Ready for Pickup',
                badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold',
                isTerminal: false,
            };
        case 'COMPLETED':
        case 'DELIVERED':
            return {
                label: 'Delivered',
                badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200',
                isTerminal: true,
            };
        default:
            return {
                label: status || 'Pending',
                badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200',
                isTerminal: false,
            };
    }
};

/**
 * Format a date string or timestamp into IST readable format (e.g., "18 Nov 2026")
 */
export const formatDisplayDate = (dateVal) => {
    if (!dateVal) return '-';
    try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return String(dateVal);
        return d.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            timeZone: 'Asia/Kolkata',
        });
    } catch {
        return String(dateVal);
    }
};
