import React, { useEffect, useState } from 'react';
import demoImage from '../../assets/signup.png';
import { useLocation, useNavigate, useParams } from "react-router-dom";
import DateConverterToIST from "../../config/DateConverterToIST.jsx";
import { toast } from "../../utils/toast.js";
import MeasurementModal from "../../Components/common/MeasurementModal.jsx";
import { fetchQueueInvoices } from "../../utils/workQueue.js";
import { FaArrowLeft, FaRulerVertical, FaTshirt, FaEye } from "react-icons/fa";

const TailorOrderDetails = () => {
    const { invoiceId } = useParams();
    const { state } = useLocation();

    const [orderData, setOrderData] = useState(state?.orderData || null);
    const [selectedDesign, setSelectedDesign] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(!state?.orderData);
    const navigate = useNavigate();

    // Measurement modal state
    const [selectedMeasurements, setSelectedMeasurements] = useState(null);
    const [showMeasurementModal, setShowMeasurementModal] = useState(false);

    useEffect(() => {
        const fetchOrderDetails = async () => {
            try {
                const invoices = await fetchQueueInvoices();
                const invoice = (invoices || []).find((inv) => inv.invoiceId === invoiceId);
                if (!invoice) {
                    throw new Error(`Order #${invoiceId} has no items in your work queue.`);
                }
                setOrderData(invoice);
            } catch (error) {
                toast.error(error?.response?.data?.message || error.message || "Failed to fetch order details");
            } finally {
                setLoading(false);
            }
        };

        if (!orderData) {
            fetchOrderDetails();
        }
    }, [invoiceId, orderData]);

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

    const handleViewMeasurements = (item) => {
        setSelectedMeasurements({
            title: item.itemName,
            measurements: item.measurements || item.measurementList || {},
        });
        setShowMeasurementModal(true);
    };

    const orders = orderData?.items || [];

    return (
        <div className="p-4 sm:p-8 max-w-6xl mx-auto min-h-screen bg-slate-50">
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-brand-maroon border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Header */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate(-1)}
                                className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:text-brand-maroon bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                            >
                                <FaArrowLeft className="text-xs" />
                                <span>Back to Queue</span>
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <span>Invoice #{orderData?.invoiceId}</span>
                                </h1>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Client: <strong className="text-slate-800">{orderData?.customer?.name || "Client"}</strong> &bull; Order Date: {DateConverterToIST(orderData?.invoiceDate)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Items Table Card */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
                            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                <FaTshirt className="text-brand-maroon" />
                                <span>Garment Production Items ({orders.length})</span>
                            </h2>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold border-b border-slate-200">
                                        <th className="py-3 px-6">Garment Item</th>
                                        <th className="py-3 px-6 text-center">Qty</th>
                                        <th className="py-3 px-6">Measurements</th>
                                        <th className="py-3 px-6">Design Pattern</th>
                                        <th className="py-3 px-6">Current Stage</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {orders.map((item, idx) => (
                                        <tr key={item.id || item.itemUniqueId || idx} className="hover:bg-slate-50/80 transition">
                                            <td className="py-4 px-6 font-semibold text-slate-900">
                                                {item.itemName}
                                            </td>
                                            <td className="py-4 px-6 text-center font-bold text-slate-700">
                                                {item.itemQuantity || 1}
                                            </td>
                                            <td className="py-4 px-6">
                                                <button
                                                    onClick={() => handleViewMeasurements(item)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-maroon bg-brand-maroon/10 hover:bg-brand-maroon/20 rounded-lg transition"
                                                >
                                                    <FaRulerVertical className="text-xs" />
                                                    <span>View Specs</span>
                                                </button>
                                            </td>
                                            <td className="py-4 px-6">
                                                <button
                                                    onClick={() => handleViewDesign(item.itemName, item.imageUrl)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                                                >
                                                    <FaEye className="text-xs text-slate-500" />
                                                    <span>View Design</span>
                                                </button>
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                                    {item.itemOrderStatus || "IN QUEUE"}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Design Modal */}
            {showModal && selectedDesign && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-fadeIn">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                            <h3 className="text-base font-bold text-slate-800">
                                {selectedDesign.title} Design Reference
                            </h3>
                            <button
                                onClick={closeModal}
                                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"
                            >
                                &times;
                            </button>
                        </div>
                        <div className="p-6 flex items-center justify-center bg-slate-50">
                            <img
                                src={selectedDesign.image}
                                alt={`Design for ${selectedDesign.title}`}
                                onError={(e) => {
                                    e.target.src = demoImage;
                                }}
                                className="max-h-96 rounded-lg object-contain border border-slate-200"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Read-Only Measurement Modal */}
            {showMeasurementModal && selectedMeasurements && (
                <MeasurementModal
                    itemName={selectedMeasurements.title}
                    measurements={selectedMeasurements.measurements}
                    existingMeasurements={selectedMeasurements.measurements}
                    onClose={() => setShowMeasurementModal(false)}
                    readOnly={true}
                />
            )}
        </div>
    );
};

export default TailorOrderDetails;
