import React, { useState, useEffect } from 'react';
import { FaTimes, FaCheck, FaRulerVertical } from 'react-icons/fa';
import { getTemplateForGarment } from '../../constants/measurementTemplates.js';
import './MeasurementModal.css';

const MeasurementModal = ({
    onClose,
    itemName = '',
    itemIndex = null,
    onSave,
    existingMeasurements,
    measurements: incomingMeasurements,
    readOnly = false,
}) => {
    const activeExisting = existingMeasurements || incomingMeasurements || {};
    const [measurements, setMeasurements] = useState({});
    const [notes, setNotes] = useState('');

    useEffect(() => {
        const template = getTemplateForGarment(itemName);
        const initial = {};

        template.forEach((field) => {
            if (typeof field === 'object' && field.fields) {
                field.fields.forEach((sub) => {
                    initial[sub] = activeExisting?.[sub] ?? '';
                });
            } else if (field !== 'Remarks') {
                initial[field] = activeExisting?.[field] ?? '';
            }
        });

        // Also restore any additional existing keys
        if (activeExisting) {
            Object.keys(activeExisting).forEach((key) => {
                if (key !== 'notes' && key !== 'Remarks') {
                    initial[key] = activeExisting[key] ?? '';
                }
            });
        }

        setMeasurements(initial);
        setNotes(activeExisting?.notes || activeExisting?.Remarks || '');
    }, [itemName, activeExisting]);

    const handleFieldChange = (key, val) => {
        // Allow empty or positive decimal numbers
        if (val === '' || /^\d*\.?\d*$/.test(val)) {
            setMeasurements((prev) => ({
                ...prev,
                [key]: val,
            }));
        }
    };

    const hasAnyMeasurement = () => {
        const hasValues = Object.values(measurements).some((v) => v !== '' && v !== null && v !== undefined);
        return hasValues || notes.trim().length > 0;
    };

    const handleSave = () => {
        const payload = {
            ...measurements,
            notes: notes.trim(),
            Remarks: notes.trim(),
        };

        if (itemIndex !== null && itemIndex !== undefined) {
            onSave(itemIndex, payload);
        } else {
            onSave(payload);
        }
        onClose();
    };

    const template = getTemplateForGarment(itemName);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-brand-maroon/10 text-brand-maroon flex items-center justify-center">
                            <FaRulerVertical className="text-lg" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800 flex items-center">
                                Measurements: <span className="text-brand-maroon ml-1">{itemName || 'Garment'}</span>
                                {readOnly && (
                                    <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded ml-2 border border-slate-200">
                                        View Mode
                                    </span>
                                )}
                            </h3>
                            <p className="text-xs text-slate-500">
                                {readOnly ? 'Recorded garment measurements (inches / cm)' : 'Enter measurements in inches / cm'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                        aria-label="Close modal"
                    >
                        <FaTimes className="text-lg" />
                    </button>
                </div>

                {/* Form Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {template.map((field) => {
                            if (field === 'Remarks') return null;

                            if (typeof field === 'object' && field.fields) {
                                return (
                                    <React.Fragment key={field.name}>
                                        {field.fields.map((subField) => (
                                            <div key={subField} className="flex flex-col gap-1">
                                                <label className="text-xs font-medium text-slate-700">
                                                    {subField}
                                                </label>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    placeholder="-"
                                                    disabled={readOnly}
                                                    value={measurements[subField] ?? ''}
                                                    onChange={(e) => handleFieldChange(subField, e.target.value)}
                                                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none transition ${
                                                        readOnly
                                                            ? 'bg-slate-50 border-slate-200 text-slate-800 font-semibold cursor-default'
                                                            : 'bg-white border-slate-200 focus:ring-2 focus:ring-brand-maroon/30 focus:border-brand-maroon'
                                                    }`}
                                                />
                                            </div>
                                        ))}
                                    </React.Fragment>
                                );
                            }

                            return (
                                <div key={field} className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-slate-700">
                                        {field}
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="-"
                                        disabled={readOnly}
                                        value={measurements[field] ?? ''}
                                        onChange={(e) => handleFieldChange(field, e.target.value)}
                                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none transition ${
                                            readOnly
                                                ? 'bg-slate-50 border-slate-200 text-slate-800 font-semibold cursor-default'
                                                : 'bg-white border-slate-200 focus:ring-2 focus:ring-brand-maroon/30 focus:border-brand-maroon'
                                        }`}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    {/* Notes / Special Instructions */}
                    <div className="flex flex-col gap-1 pt-2 border-t border-slate-100">
                        <label className="text-xs font-medium text-slate-700">
                            Notes / Remarks / Custom Requests
                        </label>
                        <textarea
                            rows={2}
                            placeholder={readOnly ? 'No special instructions recorded.' : 'Add any specific cuts, pattern instructions, or customer notes...'}
                            disabled={readOnly}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none transition resize-none ${
                                readOnly
                                    ? 'bg-slate-50 border-slate-200 text-slate-800 cursor-default'
                                    : 'bg-white border-slate-200 focus:ring-2 focus:ring-brand-maroon/30 focus:border-brand-maroon'
                            }`}
                        />
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/50">
                    {readOnly ? (
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 text-sm font-semibold rounded-lg text-white bg-brand-maroon hover:bg-brand-maroon-hover transition shadow-sm"
                        >
                            Close
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={!hasAnyMeasurement()}
                                className={`flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg text-white shadow-sm transition ${
                                    hasAnyMeasurement()
                                        ? 'bg-brand-maroon hover:bg-brand-maroon-hover cursor-pointer'
                                        : 'bg-slate-300 cursor-not-allowed'
                                }`}
                            >
                                <FaCheck className="text-xs" />
                                Save Measurements
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MeasurementModal;
