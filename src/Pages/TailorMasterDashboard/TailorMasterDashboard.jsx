import React, { useEffect, useState } from 'react';
import './TailorMasterDashboard.css';
import { useNavigate, useSearchParams } from "react-router-dom";
import AssignTailor from "./AssignTailor/AssignTailor.jsx";
import axiosInstance from "../LoginPages/axios.js";
import OrderStatusModal from "../PaymentInvoice/ViewEditOrder/OrderStatusModal/OrderStatusModal.jsx";
import { toast } from "../../utils/toast.js";
import DateConverterToIST from "../../config/DateConverterToIST.jsx";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
    fetchQueueInvoices,
    filterByInvoiceDate,
    searchInvoices,
    updateItemStatus,
    toLegacyItem,
} from "../../utils/workQueue.js";
import JobCard from "../../Components/common/JobCard.jsx";
import MeasurementModal from "../../Components/common/MeasurementModal.jsx";
import { getDeliveryUrgency, getStatusMeta } from "../../utils/urgencyHelper.js";
import {
    FaThLarge,
    FaListUl,
    FaFileExcel,
    FaSearch,
    FaCut,
    FaCheckCircle,
    FaRulerVertical,
    FaUserCheck,
} from "react-icons/fa";

const TailorMasterDashboard = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
    const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page')) || 1);
    const [ordersPerPage, setOrdersPerPage] = useState(parseInt(searchParams.get('size')) || 12);
    const [orders, setOrders] = useState([]);
    const [totalElements, setTotalElements] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const pageSizeOptions = [12, 24, 48];
    const [isLoading, setIsLoading] = useState(true);
    const [shopOwner, setShopOwner] = useState(' ');
    const [shopName, setShopName] = useState(' ');

    const [backendSearchResults, setBackendSearchResults] = useState([]);

    // UI View toggles
    const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
    const [previewMeasurementItem, setPreviewMeasurementItem] = useState(null);
    const [selectedOrderForAssign, setSelectedOrderForAssign] = useState(null);
    const [showAssignPopup, setShowAssignPopup] = useState(false);
    const [selectedCustomerForTrack, setSelectedCustomerForTrack] = useState(null);
    const [showTrackStatus, setShowTrackStatus] = useState(false);

    // Filter states
    const [filtersApplied, setFiltersApplied] = useState(false);
    const [appliedStartDate, setAppliedStartDate] = useState("");
    const [appliedEndDate, setAppliedEndDate] = useState("");
    const [dateRange, setDateRange] = useState(searchParams.get('dateRange') || 'today');
    const [startDate, setStartDate] = useState(searchParams.get('startDate') || "");
    const [endDate, setEndDate] = useState(searchParams.get('endDate') || "");

    const navigate = useNavigate();
    const latestRequestId = React.useRef(0);

    const updateURLParams = (updates) => {
        const newParams = new URLSearchParams(searchParams);
        Object.entries(updates).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                newParams.set(key, value.toString());
            } else {
                newParams.delete(key);
            }
        });
        setSearchParams(newParams);
    };

    function formatDateLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    useEffect(() => {
        const urlStartDate = searchParams.get('startDate');
        const urlEndDate = searchParams.get('endDate');

        if (urlStartDate && urlEndDate) {
            setAppliedStartDate(urlStartDate);
            setAppliedEndDate(urlEndDate);
            setFiltersApplied(true);
            setCurrentPage(parseInt(searchParams.get('page')) || 1);
            fetchData(
                parseInt(searchParams.get('page')) || 1,
                parseInt(searchParams.get('size')) || 12,
                urlStartDate,
                urlEndDate
            );
        } else {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStr = formatDateLocal(today);

            setStartDate(todayStr);
            setEndDate(todayStr);
            setAppliedStartDate(todayStr);
            setAppliedEndDate(todayStr);
            setFiltersApplied(true);
            setCurrentPage(1);

            updateURLParams({
                startDate: todayStr,
                endDate: todayStr,
                dateRange: 'today',
                page: 1
            });

            fetchData(1, ordersPerPage, todayStr, todayStr);
        }
        fetchTailorMasterProfile();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (backendSearchResults && backendSearchResults.length > 0) return;
        fetchData(currentPage, ordersPerPage, appliedStartDate, appliedEndDate);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, ordersPerPage, appliedStartDate, appliedEndDate]);

    const fetchTailorMasterProfile = async () => {
        try {
            const res = await axiosInstance.get("/auth/me");
            if (res.status === 200) {
                setShopOwner(res.data.name);
                setShopName(res.data.shopName || "Master Cutting & Assignment Desk");
            }
        } catch (e) {
            console.error("Profile error:", e);
        }
    };

    const handleConfirmationData = (updatedItem) => {
        if (updatedItem && updatedItem.itemUniqueId) {
            setOrders((prev) =>
                prev.map((order) => ({
                    ...order,
                    items: (order.items || []).map((item) =>
                        item.itemUniqueId === updatedItem.itemUniqueId
                            ? { ...item, ...toLegacyItem(updatedItem) }
                            : item
                    ),
                }))
            );
        }
        fetchData(currentPage, ordersPerPage, appliedStartDate, appliedEndDate);
    };

    const performBackendSearch = async (term) => {
        if (!term || !term.trim()) {
            setBackendSearchResults([]);
            updateURLParams({ search: null });
            return;
        }

        try {
            setIsLoading(true);
            const results = searchInvoices(await fetchQueueInvoices(), term.trim());
            if (results.length === 0) {
                toast.info(`No order in your work queue matches "${term}".`);
                setBackendSearchResults([]);
                return;
            }
            setBackendSearchResults(results);
            setCurrentPage(1);
            updateURLParams({ search: term, page: 1 });
        } catch (error) {
            toast.error(error?.response?.data?.message || error.message || 'Backend search error.');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchData = async (
        page = currentPage,
        size = ordersPerPage,
        startDateVal = appliedStartDate,
        endDateVal = appliedEndDate
    ) => {
        setIsLoading(true);
        const reqId = ++latestRequestId.current;

        try {
            const all = filterByInvoiceDate(await fetchQueueInvoices(), startDateVal, endDateVal);
            if (reqId !== latestRequestId.current) return;

            const pageSize = Number(size) || 12;
            setOrders(all.slice((page - 1) * pageSize, page * pageSize));
            setTotalElements(all.length);
            setTotalPages(Math.max(1, Math.ceil(all.length / pageSize)));
            setCurrentPage(page);
        } catch (error) {
            if (reqId !== latestRequestId.current) return;
            setOrders([]);
            setTotalElements(0);
            setTotalPages(1);
            toast.error("Could not fetch master queue.");
        } finally {
            if (reqId === latestRequestId.current) {
                setIsLoading(false);
            }
        }
    };

    const excludedItems = ["NoUse"];
    const requiredStatus = [
        "CUTTING",
        "ORDER_ACCEPTED",
        "TAILOR_ASSIGNED",
        "STITCHING",
        "IRONING",
        "ORDER_COMPLETED",
        "SHOP_ASSISTANT_ASSIGNED",
        "HEMMING",
    ];

    const filteredOrders = orders.map((order) => ({
        ...order,
        items: (order.items || []).filter(
            (item) =>
                !excludedItems.includes(item.itemName) &&
                requiredStatus.includes(item.itemOrderStatus || item.status)
        ),
    }));

    const paginate = (pageNumber) => {
        setCurrentPage(pageNumber);
        updateURLParams({ page: pageNumber });
    };

    const handleItemsPerPageChange = (e) => {
        const newSize = parseInt(e.target.value);
        setOrdersPerPage(newSize);
        setCurrentPage(1);
        updateURLParams({ size: newSize, page: 1 });
    };

    const displayData =
        backendSearchResults.length > 0 ? backendSearchResults : filteredOrders;

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
                Tailor: item.assignedTailorName || "Unassigned",
            }))
        );

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "MasterQueue");

        const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const data = new Blob([excelBuffer], { type: "application/octet-stream" });
        saveAs(data, `Master_Queue_${new Date().toISOString().split("T")[0]}.xlsx`);

        toast.success(`${selectedOrders.length} order(s) exported to Excel.`);
        setOrders((prev) => prev.map((order) => ({ ...order, checked: false })));
        setSelectAll(false);
    };

    const handleOrderStatusUpdate = async (order, item, newStatus) => {
        try {
            await updateItemStatus(order.invoiceId, item.itemUniqueId, newStatus);
            toast.success(`Marked #${order.invoiceId} (${item.itemName}) as ${newStatus}`);
            fetchData(currentPage, ordersPerPage, appliedStartDate, appliedEndDate);
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || "Status update failed.");
        }
    };

    const handleAssignTailorClick = (order, item) => {
        setSelectedOrderForAssign({ ...order, currentItem: item });
        setShowAssignPopup(true);
    };

    const handleTrackStatusClick = (order) => {
        setSelectedCustomerForTrack(order);
        setShowTrackStatus(true);
    };

    const handleApplyFilters = () => {
        let startParam = "";
        let endParam = "";
        const today = new Date();
        let start, end;

        if (dateRange !== "custom") {
            switch (dateRange) {
                case "today":
                    start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    end = start;
                    break;
                case "yesterday":
                    start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
                    end = start;
                    break;
                case "week": {
                    const firstDayOfWeek = new Date(today);
                    firstDayOfWeek.setDate(today.getDate() - today.getDay());
                    const lastDayOfWeek = new Date(firstDayOfWeek);
                    lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
                    start = firstDayOfWeek;
                    end = lastDayOfWeek;
                    break;
                }
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
                startParam = startDate;
                endParam = endDate;
            } else {
                toast.warning("Please select both start and end date for custom range.");
                return;
            }
        }

        setAppliedStartDate(startParam);
        setAppliedEndDate(endParam);
        setFiltersApplied(true);
        setBackendSearchResults([]);
        setCurrentPage(1);

        updateURLParams({
            dateRange,
            startDate: startParam,
            endDate: endParam,
            page: 1,
            search: null
        });

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

        updateURLParams({
            dateRange: 'today',
            startDate: todayStr,
            endDate: todayStr,
            page: 1,
            search: null
        });

        fetchData(1, ordersPerPage, todayStr, todayStr);
    };

    return (
        <div className="tailor-master-dashboard-container">
            {/* Studio Header */}
            <header className="tailor-master-dashboard-header">
                <div className="tailor-master-dashboard-header-left">
                    <h1 className="tailor-master-dashboard-title">
                        {shopName !== ' ' ? shopName : "Tailor Master Desk"}
                    </h1>
                    <p className="tailor-master-dashboard-welcome-message">
                        Production Master Queue &bull; Welcome back,{" "}
                        <strong>{shopOwner !== ' ' ? shopOwner : "Tailor Master"}</strong>
                    </p>
                </div>

                <div className="tailor-master-dashboard-header-right">
                    <div className="tailor-master-dashboard-search-box flex items-center">
                        <input
                            type="text"
                            placeholder="Search by Invoice ID or Customer Name"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                if (e.target.value === '') {
                                    setBackendSearchResults([]);
                                    updateURLParams({ search: null });
                                }
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") performBackendSearch(searchTerm);
                            }}
                            className="tailor-master-dashboard-search-input"
                        />
                        <button
                            onClick={() => performBackendSearch(searchTerm)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-brand-gold text-brand-maroon font-bold rounded-full text-sm hover:brightness-110 transition ml-2 shadow-sm"
                        >
                            <FaSearch className="text-xs" />
                            <span>Search</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="tailor-master-dashboard-content">
                <div className="tailor-master-dashboard-orders-container">
                    {/* Controls Bar */}
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
                                    <option value="week">This Week</option>
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

                        {/* Top Action Buttons */}
                        <div className="flex items-center gap-3">
                            {/* View Switcher */}
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
                                onClick={() => navigate("/tailorMaster/my-orders")}
                                className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-maroon hover:bg-brand-maroon-hover text-white rounded-lg text-xs font-semibold transition shadow-sm"
                            >
                                <FaCut className="text-xs" />
                                <span>Cutting Queue</span>
                            </button>

                            <button
                                onClick={exportToExcel}
                                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
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
                                            onAssignTailor={handleAssignTailorClick}
                                            onTrackStatus={handleTrackStatusClick}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-200">
                                    <FaCheckCircle className="text-4xl text-emerald-500 mx-auto mb-3" />
                                    <h3 className="text-lg font-bold text-slate-800">
                                        No Orders in Master Queue
                                    </h3>
                                    <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
                                        All production orders for this date filter have been assigned and processed.
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Traditional Table View */
                        <div className="tailor-master-dashboard-table-responsive">
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
                                        <th>Customer ID</th>
                                        <th>Garment Items</th>
                                        <th>Order Date</th>
                                        <th>Due Urgency</th>
                                        <th>Assign Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        Array.from({ length: 5 }).map((_, index) => (
                                            <tr key={index} className="tailor-master-dashboard-skeleton-row">
                                                <td colSpan="8" className="py-4 text-center text-slate-400">Loading...</td>
                                            </tr>
                                        ))
                                    ) : displayData.length > 0 ? (
                                        displayData.map((order, orderIndex) => {
                                            const urgency = getDeliveryUrgency(order.expectedDeliveryDate);
                                            const notAssignedCount = (order.items || []).filter(
                                                (item) => !item.assignmentStatus && !item.assignedTo
                                            ).length;

                                            return (
                                                <tr key={order.id || orderIndex} className="tailor-master-dashboard-table-row">
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
                                                    <td className="font-semibold text-slate-900">
                                                        {order.customer?.name}
                                                    </td>
                                                    <td className="text-xs text-slate-500">
                                                        {order.customer?.customerId}
                                                    </td>
                                                    <td>
                                                        <button
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-maroon bg-brand-maroon/10 hover:bg-brand-maroon/20 rounded-md transition"
                                                            onClick={() =>
                                                                navigate(`/tailorMaster/${order.invoiceId}`, {
                                                                    state: { orderData: order },
                                                                })
                                                            }
                                                        >
                                                            <span>Inspect Items ({(order.items || []).length})</span>
                                                        </button>
                                                    </td>
                                                    <td className="text-xs text-slate-600">
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
                                                        {order.items.length === 0 ? (
                                                            <span className="cutting-pending-tm">No Items</span>
                                                        ) : notAssignedCount === 0 ? (
                                                            <span className="assigned-done-tm">
                                                                All Assigned
                                                            </span>
                                                        ) : (
                                                            <span className="not-assigned-done-tm">
                                                                Unassigned: {notAssignedCount}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr className="tailor-master-dashboard-no-results">
                                            <td colSpan="8" className="text-center py-8 text-slate-500">
                                                No orders found matching the filter criteria.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {/* Pagination */}
            {backendSearchResults.length === 0 && (
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
            )}

            {/* Assign Tailor Popup */}
            {showAssignPopup && selectedOrderForAssign && (
                <AssignTailor
                    show={showAssignPopup}
                    onClose={() => setShowAssignPopup(false)}
                    order={selectedOrderForAssign}
                    onData={handleConfirmationData}
                />
            )}

            {/* Track Status Modal */}
            {showTrackStatus && selectedCustomerForTrack && (
                <OrderStatusModal
                    customer={selectedCustomerForTrack}
                    onClose={() => setShowTrackStatus(false)}
                />
            )}

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

export default TailorMasterDashboard;
