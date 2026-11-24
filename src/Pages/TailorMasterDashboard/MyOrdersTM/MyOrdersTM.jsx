import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from "react-router-dom";
import {
    fetchQueueInvoices,
    filterByInvoiceDate,
    searchInvoices,
    updateItemStatus,
    toLegacyItem,
} from "../../../utils/workQueue.js";
import DateConverterToIST from "../../../config/DateConverterToIST.jsx";
import { toast } from "../../../utils/toast.js";
import './MyOrdersTM.css';
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import JobCard from "../../../Components/common/JobCard.jsx";
import MeasurementModal from "../../../Components/common/MeasurementModal.jsx";
import { getDeliveryUrgency, getStatusMeta } from "../../../utils/urgencyHelper.js";
import {
    FaThLarge,
    FaListUl,
    FaFileExcel,
    FaArrowLeft,
    FaRulerVertical,
    FaCheckCircle,
    FaCut,
} from "react-icons/fa";

const MyOrdersTM = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [orders, setOrders] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [ordersPerPage, setOrdersPerPage] = useState(12);
    const pageSizeOptions = [12, 24, 48];
    const [isLoading, setIsLoading] = useState(false);
    const [statusUpdates, setStatusUpdates] = useState({});
    const [backendSearchResults, setBackendSearchResults] = useState([]);
    const [totalElements, setTotalElements] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    // View toggles
    const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
    const [previewMeasurementItem, setPreviewMeasurementItem] = useState(null);

    const navigate = useNavigate();
    const latestRequestId = useRef(0);

    // Date filters
    const [filtersApplied, setFiltersApplied] = useState(false);
    const [appliedStartDate, setAppliedStartDate] = useState("");
    const [appliedEndDate, setAppliedEndDate] = useState("");
    const [dateRange, setDateRange] = useState("today");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const excludedItems = ["Embroidery", "Lining Material", "Saree Fall", "Saree Pico", "Designing"];
    const requiredStatus = "ORDER_ACCEPTED";

    function formatDateLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    const fetchData = async (
        page = currentPage,
        size = ordersPerPage,
        start = appliedStartDate,
        end = appliedEndDate
    ) => {
        setIsLoading(true);
        let pageNum = Number(page);
        if (!Number.isFinite(pageNum) || pageNum < 1) pageNum = 1;
        let pageSizeNum = Number(size);
        if (!Number.isFinite(pageSizeNum) || pageSizeNum <= 0) pageSizeNum = ordersPerPage || 12;

        const reqId = ++latestRequestId.current;

        try {
            const all = filterByInvoiceDate(await fetchQueueInvoices(["ORDER_ACCEPTED"]), start, end);
            if (reqId !== latestRequestId.current) return;

            setOrders(all.slice((pageNum - 1) * pageSizeNum, pageNum * pageSizeNum));
            setTotalElements(all.length);
            setTotalPages(Math.max(1, Math.ceil(all.length / pageSizeNum)));
            setCurrentPage(pageNum);
        } catch (error) {
            if (reqId !== latestRequestId.current) return;
            setOrders([]);
            setTotalElements(0);
            setTotalPages(1);
            toast.error("Could not fetch cutting queue.");
        } finally {
            if (reqId === latestRequestId.current) setIsLoading(false);
        }
    };

    useEffect(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = formatDateLocal(today);

        setStartDate(todayStr);
        setEndDate(todayStr);
        setAppliedStartDate(todayStr);
        setAppliedEndDate(todayStr);
        setFiltersApplied(true);
        setCurrentPage(1);

        fetchData(1, ordersPerPage, todayStr, todayStr);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const performBackendSearch = async (term) => {
        if (!term || !term.trim()) {
            setBackendSearchResults([]);
            return;
        }

        try {
            setIsLoading(true);
            const all = await fetchQueueInvoices(["ORDER_ACCEPTED"]);
            const results = searchInvoices(all, term.trim());
            if (results.length === 0) {
                toast.info(`No cutting orders matching "${term}".`);
                setBackendSearchResults([]);
                return;
            }

            setBackendSearchResults(results);
            setCurrentPage(1);
        } catch (error) {
            toast.error("Search failed.");
        } finally {
            setIsLoading(false);
        }
    };

    const filteredOrders = orders.map((order) => ({
        ...order,
        items: (order.items || []).filter(
            (item) =>
                !excludedItems.includes(item.itemName) &&
                item.itemOrderStatus === requiredStatus
        ),
    }));

    const displayData =
        backendSearchResults && backendSearchResults.length > 0
            ? backendSearchResults
            : filteredOrders;

    // Flatten items for JobCard display
    const visibleFlattenedItems = displayData.flatMap((order) =>
        (order.items || []).map((item) => ({ ...item, orderRef: order }))
    );

    const [selectAll, setSelectAll] = useState(false);
    const handleSelectAll = (e) => {
        const isChecked = e.target.checked;
        setSelectAll(isChecked);
        setOrders((prev) => prev.map((order) => ({ ...order, checked: isChecked })));
        if (backendSearchResults.length > 0) {
            setBackendSearchResults((prev) =>
                prev.map((order) => ({ ...order, checked: isChecked }))
            );
        }
    };

    const handleCheckboxChange = (orderId) => {
        setOrders((prev) => {
            const updated = prev.map((order) =>
                order.id === orderId || order.invoiceId === orderId
                    ? { ...order, checked: !order.checked }
                    : order
            );
            setSelectAll(updated.length > 0 && updated.every((o) => o.checked));
            return updated;
        });

        if (backendSearchResults.length > 0) {
            setBackendSearchResults((prev) => {
                const updated = prev.map((order) =>
                    order.id === orderId || order.invoiceId === orderId
                        ? { ...order, checked: !order.checked }
                        : order
                );
                return updated;
            });
        }
    };

    const selectedCount = displayData.filter((order) => order.checked).length;

    const exportToExcel = () => {
        const selectedOrders = displayData.filter((order) => order.checked);
        if (selectedOrders.length === 0) {
            toast.warning("Please select at least one order to export.");
            return;
        }

        const excelData = selectedOrders.flatMap((order) =>
            (order.items || []).map((item) => ({
                InvoiceID: order.invoiceId,
                CustomerName: order.customer?.name || "",
                GarmentItem: item.itemName || "",
                OrderDate: DateConverterToIST(order.invoiceDate),
                DueDate: order.expectedDeliveryDate || "",
                Status: item.itemOrderStatus || "",
            }))
        );

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "CuttingOrders");

        const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const data = new Blob([excelBuffer], { type: "application/octet-stream" });
        saveAs(data, `Cutting_Orders_${new Date().toISOString().split("T")[0]}.xlsx`);

        toast.success(`${selectedOrders.length} order(s) exported to Excel.`);
        setOrders((prev) => prev.map((order) => ({ ...order, checked: false })));
        setSelectAll(false);
    };

    const handleOrderStatusUpdate = async (order, item, directStatus = null) => {
        setIsLoading(true);
        const updatedStatus = directStatus || statusUpdates[item.itemUniqueId] || "CUTTING";

        try {
            await updateItemStatus(order.invoiceId, item.itemUniqueId, updatedStatus);
            toast.success(`Marked #${order.invoiceId} (${item.itemName}) as ${updatedStatus}`);
            await fetchData(currentPage, ordersPerPage, appliedStartDate, appliedEndDate);
        } catch (error) {
            toast.error(error.response?.data?.message || error.message || "Failed to update cutting status.");
        } finally {
            setStatusUpdates((prev) => {
                const updated = { ...prev };
                delete updated[item.itemUniqueId];
                return updated;
            });
            setIsLoading(false);
        }
    };

    const handleApplyFilters = () => {
        let startParam = "";
        let endParam = "";
        const today = new Date();
        let start, end;

        if (dateRange !== "custom") {
            switch (dateRange) {
                case "today":
                    start = new Date();
                    start.setHours(0, 0, 0, 0);
                    end = new Date(start);
                    break;
                case "yesterday":
                    start = new Date();
                    start.setDate(start.getDate() - 1);
                    start.setHours(0, 0, 0, 0);
                    end = new Date(start);
                    break;
                case "week":
                    start = new Date(today);
                    start.setDate(today.getDate() - 8);
                    start.setHours(0, 0, 0, 0);
                    end = new Date(today);
                    end.setDate(today.getDate() - 1);
                    end.setHours(23, 59, 59, 999);
                    break;
                case "month":
                    start = new Date(today.getFullYear(), today.getMonth(), 1);
                    end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    break;
                case "year":
                    start = new Date(today.getFullYear(), 0, 1);
                    end = new Date(today.getFullYear(), 11, 31);
                    break;
                default:
                    break;
            }

            if (start && end) {
                startParam = formatDateLocal(start);
                endParam = formatDateLocal(end);
            }
        } else {
            if (startDate && endDate) {
                const startCustom = new Date(startDate + "T00:00:00");
                const endCustom = new Date(endDate + "T23:59:59");
                startParam = formatDateLocal(startCustom);
                endParam = formatDateLocal(endCustom);
            } else {
                toast.warning("Please select both start and end dates.");
                return;
            }
        }

        setAppliedStartDate(startParam);
        setAppliedEndDate(endParam);
        setFiltersApplied(true);
        setBackendSearchResults([]);
        setCurrentPage(1);
        fetchData(1, ordersPerPage, startParam, endParam);
    };

    const handleRemoveFilters = () => {
        setDateRange("today");
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = formatDateLocal(today);

        setStartDate(todayStr);
        setEndDate(todayStr);
        setAppliedStartDate(todayStr);
        setAppliedEndDate(todayStr);
        setFiltersApplied(true);
        setBackendSearchResults([]);
        setCurrentPage(1);
        fetchData(1, ordersPerPage, todayStr, todayStr);
    };

    const paginate = (pageNumber) => {
        setCurrentPage(pageNumber);
        fetchData(pageNumber, ordersPerPage, appliedStartDate, appliedEndDate);
    };

    const handleItemsPerPageChange = (e) => {
        const newSize = Number(e.target.value);
        setOrdersPerPage(newSize);
        setCurrentPage(1);
        fetchData(1, newSize, appliedStartDate, appliedEndDate);
    };

    return (
        <div className="tailor-master-dashboard-container">
            <main className="tailor-master-dashboard-content">
                <div className="tailor-master-dashboard-orders-container">
                    {/* Header bar with Back button */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate(-1)}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-brand-maroon bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                            >
                                <FaArrowLeft className="text-[11px]" />
                                <span>Back to Master Desk</span>
                            </button>
                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <FaCut className="text-brand-maroon" />
                                <span>Cutting Production Queue ({visibleFlattenedItems.length} items)</span>
                            </h2>
                        </div>
                    </div>

                    {/* Filter controls */}
                    <div className="tailor-master-dashboard-table-header flex-wrap gap-4">
                        <div className="filters flex items-center flex-wrap gap-3">
                            <div className="filter-group">
                                <label htmlFor="date-range">Date Range</label>
                                <select
                                    id="date-range"
                                    value={dateRange}
                                    onChange={(e) => setDateRange(e.target.value)}
                                >
                                    <option value="today">Today</option>
                                    <option value="yesterday">Yesterday</option>
                                    <option value="week">Last Week</option>
                                    <option value="month">This Month</option>
                                    <option value="year">This Year</option>
                                    <option value="custom">Custom Range</option>
                                </select>
                            </div>

                            {dateRange === "custom" && (
                                <>
                                    <div className="filter-group" id="custom-date-range">
                                        <label htmlFor="start-date">Start Date</label>
                                        <input
                                            type="date"
                                            id="start-date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                        />
                                    </div>
                                    <div className="filter-group" id="custom-date-range-end">
                                        <label htmlFor="end-date">End Date</label>
                                        <input
                                            type="date"
                                            id="end-date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                        />
                                    </div>
                                </>
                            )}

                            <div className="filter-group">
                                <button id="apply-filters" onClick={handleApplyFilters}>
                                    Apply
                                </button>
                            </div>
                            <div className="filter-group">
                                <button
                                    id="apply-filters"
                                    style={{ background: "#64748B" }}
                                    onClick={handleRemoveFilters}
                                >
                                    Reset
                                </button>
                            </div>
                        </div>

                        {/* View Switcher & Export */}
                        <div className="flex items-center gap-3">
                            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                                <button
                                    onClick={() => setViewMode("cards")}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                                        viewMode === "cards"
                                            ? "bg-white text-brand-maroon shadow-sm"
                                            : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                    <FaThLarge className="text-xs" />
                                    <span>Job Cards</span>
                                </button>
                                <button
                                    onClick={() => setViewMode("table")}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                                        viewMode === "table"
                                            ? "bg-white text-brand-maroon shadow-sm"
                                            : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                    <FaListUl className="text-xs" />
                                    <span>Table View</span>
                                </button>
                            </div>

                            <button
                                onClick={exportToExcel}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold transition shadow-sm"
                            >
                                <FaFileExcel className="text-xs" />
                                <span>Export ({selectedCount})</span>
                            </button>
                        </div>
                    </div>

                    {/* Cards View (Mobile/Tablet Friendly) */}
                    {viewMode === "cards" ? (
                        <div className="p-6">
                            {isLoading ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {[...Array(6)].map((_, i) => (
                                        <div
                                            key={i}
                                            className="h-44 bg-slate-100 rounded-xl animate-pulse border border-slate-200"
                                        />
                                    ))}
                                </div>
                            ) : visibleFlattenedItems.length > 0 ? (
                                <div className="job-cards-grid">
                                    {visibleFlattenedItems.map((item, idx) => (
                                        <JobCard
                                            key={`${item.orderRef.invoiceId}-${item.itemUniqueId || idx}`}
                                            order={item.orderRef}
                                            item={item}
                                            role="tailorMaster"
                                            isChecked={item.orderRef.checked}
                                            onToggleCheck={handleCheckboxChange}
                                            onStatusUpdate={handleOrderStatusUpdate}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-200">
                                    <FaCheckCircle className="text-4xl text-emerald-500 mx-auto mb-3" />
                                    <h3 className="text-lg font-bold text-slate-800">
                                        No Cutting Tasks in Queue
                                    </h3>
                                    <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
                                        All cutting orders for the chosen date range have been cut and moved to stitching.
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Traditional Table View */
                        <div className="tailor-master-dashboard-table-responsive">
                            {isLoading ? (
                                <div className="p-6 text-center text-slate-500">Loading orders...</div>
                            ) : (
                                <table className="tailor-master-dashboard-orders-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 40 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectAll}
                                                    onChange={handleSelectAll}
                                                />
                                            </th>
                                            <th>Invoice ID</th>
                                            <th>Customer Name</th>
                                            <th>Garment Item</th>
                                            <th>Order Date</th>
                                            <th>Due Urgency</th>
                                            <th>Measurements</th>
                                            <th>Cutting Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayData.length > 0 ? (
                                            displayData.flatMap((order, index) =>
                                                (order.items || []).map((item, itemIndex) => {
                                                    const urgency = getDeliveryUrgency(order.expectedDeliveryDate);
                                                    return (
                                                        <tr key={`${order.invoiceId}-${itemIndex}`} className="tailor-master-dashboard-table-row">
                                                            <td>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={order.checked || false}
                                                                    onChange={() => handleCheckboxChange(order.id || order.invoiceId)}
                                                                />
                                                            </td>
                                                            <td className="font-mono font-bold text-slate-800">
                                                                {order.invoiceId}
                                                            </td>
                                                            <td className="font-medium text-slate-900">
                                                                {order.customer?.name}
                                                            </td>
                                                            <td className="font-semibold text-slate-800">
                                                                {item.itemName}
                                                            </td>
                                                            <td className="text-slate-600 text-xs">
                                                                {DateConverterToIST(order.invoiceDate)}
                                                            </td>
                                                            <td>
                                                                <span
                                                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs ${urgency.badgeClass}`}
                                                                >
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${urgency.dotClass}`} />
                                                                    {urgency.label}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setPreviewMeasurementItem({
                                                                            name: item.itemName,
                                                                            measurements: item.measurements || item.measurementList || {},
                                                                        })
                                                                    }
                                                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-brand-maroon bg-brand-maroon/10 hover:bg-brand-maroon/20 rounded-md transition"
                                                                >
                                                                    <FaRulerVertical className="text-[11px]" />
                                                                    <span>View</span>
                                                                </button>
                                                            </td>
                                                            <td>
                                                                <button
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-maroon hover:bg-brand-maroon-hover text-white text-xs font-semibold rounded-md shadow-sm transition"
                                                                    onClick={() => handleOrderStatusUpdate(order, item, "CUTTING")}
                                                                >
                                                                    <FaCut className="text-xs" />
                                                                    <span>Mark Cut</span>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )
                                        ) : (
                                            <tr>
                                                <td colSpan="8" className="text-center py-8 text-slate-500">
                                                    No cutting orders found matching your search.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* Pagination */}
            <div className="tailor-master-dashboard-pagination-container">
                <div className="tailor-master-dashboard-pagination-controls">
                    <div className="tailor-master-dashboard-page-size-selector">
                        <span>Items per page:</span>
                        <select
                            value={ordersPerPage}
                            onChange={handleItemsPerPageChange}
                            className="tailor-master-dashboard-page-size-dropdown"
                        >
                            {pageSizeOptions.map((size) => (
                                <option key={size} value={size}>
                                    {size}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="tailor-master-dashboard-page-info">
                        Showing {(currentPage - 1) * ordersPerPage + 1} to{" "}
                        {Math.min(currentPage * ordersPerPage, totalElements)} of {totalElements} entries
                    </div>

                    <div className="tailor-master-dashboard-page-navigation">
                        <button
                            onClick={() => paginate(1)}
                            disabled={currentPage === 1}
                            className="tailor-master-dashboard-page-nav-button"
                        >
                            «
                        </button>
                        <button
                            onClick={() => paginate(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="tailor-master-dashboard-page-nav-button"
                        >
                            ‹
                        </button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNumber;
                            if (totalPages <= 5) pageNumber = i + 1;
                            else if (currentPage <= 3) pageNumber = i + 1;
                            else if (currentPage >= totalPages - 2)
                                pageNumber = totalPages - 4 + i;
                            else pageNumber = currentPage - 2 + i;
                            return (
                                <button
                                    key={pageNumber}
                                    onClick={() => paginate(pageNumber)}
                                    className={`tailor-master-dashboard-page-number ${
                                        currentPage === pageNumber ? "active" : ""
                                    }`}
                                >
                                    {pageNumber}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => paginate(currentPage + 1)}
                            disabled={currentPage >= totalPages}
                            className="tailor-master-dashboard-page-nav-button"
                        >
                            ›
                        </button>
                        <button
                            onClick={() => paginate(totalPages)}
                            disabled={currentPage >= totalPages}
                            className="tailor-master-dashboard-page-nav-button"
                        >
                            »
                        </button>
                    </div>
                </div>
            </div>

            {/* Read-Only Measurement Modal */}
            {previewMeasurementItem && (
                <MeasurementModal
                    onClose={() => setPreviewMeasurementItem(null)}
                    itemName={previewMeasurementItem.name}
                    measurements={previewMeasurementItem.measurements}
                    existingMeasurements={previewMeasurementItem.measurements}
                    readOnly={true}
                />
            )}
        </div>
    );
};

export default MyOrdersTM;
