import React, { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import axiosInstance from "../LoginPages/axios.js";
import DateConverterToIST from "../../config/DateConverterToIST.jsx";
import { toast } from "../../utils/toast.js";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
    fetchQueueInvoices,
    filterByInvoiceDate,
    searchInvoices,
    toLegacyItem,
    updateItemStatus,
} from "../../utils/workQueue.js";
import JobCard from "../../Components/common/JobCard.jsx";
import MeasurementModal from "../../Components/common/MeasurementModal.jsx";
import { getDeliveryUrgency, getStatusMeta } from "../../utils/urgencyHelper.js";
import {
    FaThLarge,
    FaListUl,
    FaFileExcel,
    FaSearch,
    FaCheckCircle,
    FaRulerVertical,
} from "react-icons/fa";

const ShopAssistance = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [orders, setOrders] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [ordersPerPage, setOrdersPerPage] = useState(12);
    const [totalOrders, setTotalOrders] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const pageSizeOptions = [12, 24, 48];
    const [isLoading, setIsLoading] = useState(false);
    const [statusUpdates, setStatusUpdates] = useState({});
    const [backendSearchResults, setBackendSearchResults] = useState([]);
    const [isSearchActive, setIsSearchActive] = useState(false);

    // View toggles
    const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
    const [stageFilter, setStageFilter] = useState('ALL'); // 'ALL' | 'SHOP_ASSISTANT_ASSIGNED' | 'HEMMING' | 'IRONING'
    const [previewMeasurementItem, setPreviewMeasurementItem] = useState(null);

    const navigate = useNavigate();
    const [shopOwner, setShopOwner] = useState(' ');
    const [shopName, setShopName] = useState(' ');

    const [dateRange, setDateRange] = useState("week");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [filtersApplied, setFiltersApplied] = useState(false);
    const [appliedStartDate, setAppliedStartDate] = useState("");
    const [appliedEndDate, setAppliedEndDate] = useState("");

    useEffect(() => {
        fetchTailorMasterProfile();
        if (!isSearchActive) {
            fetchOrders(
                currentPage,
                ordersPerPage,
                filtersApplied ? appliedStartDate : "",
                filtersApplied ? appliedEndDate : ""
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, ordersPerPage, isSearchActive, filtersApplied, appliedStartDate, appliedEndDate]);

    const fetchTailorMasterProfile = async () => {
        try {
            const res = await axiosInstance.get("/auth/me");
            if (res.status === 200) {
                setShopOwner(res.data.name);
                setShopName(res.data.shopName || "Finishing & Delivery Desk");
            }
        } catch (e) {
            console.error("Profile error:", e);
        }
    };

    const performBackendSearch = async (term) => {
        if (!term || !term.trim()) {
            handleClearSearch();
            return;
        }

        try {
            setIsLoading(true);
            setIsSearchActive(true);
            const searchResults = searchInvoices(await fetchQueueInvoices(), term.trim());
            if (searchResults.length === 0) {
                toast.info(`No orders matching "${term}" in your queue.`);
                setBackendSearchResults([]);
                return;
            }

            const statusMap = {};
            searchResults.forEach((order) => {
                (order.items || []).forEach((item) => {
                    if (item?.itemUniqueId) {
                        statusMap[item.itemUniqueId] = item.itemOrderStatus;
                    }
                });
            });

            setBackendSearchResults(searchResults);
            setStatusUpdates(statusMap);
            setCurrentPage(1);
        } catch (error) {
            toast.error(error?.response?.data?.message || error.message || "Search failed.");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchOrders = async (
        page = currentPage,
        size = ordersPerPage,
        startParam = "",
        endParam = ""
    ) => {
        setIsLoading(true);
        try {
            const all = filterByInvoiceDate(await fetchQueueInvoices(), startParam, endParam);
            const fetchedOrders = all.slice((page - 1) * size, page * size);

            setOrders(fetchedOrders);
            setTotalOrders(all.length);
            setTotalPages(Math.max(1, Math.ceil(all.length / size)));

            const statusMap = {};
            fetchedOrders.forEach((order) => {
                (order.items || []).forEach((item) => {
                    if (item?.itemUniqueId) {
                        statusMap[item.itemUniqueId] = item.itemOrderStatus;
                    }
                });
            });
            setStatusUpdates(statusMap);
        } catch (error) {
            console.error("Error fetching orders:", error);
            setOrders([]);
            setTotalOrders(0);
            setTotalPages(1);
            toast.error("Could not fetch assistant queue.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearSearch = () => {
        setSearchTerm('');
        setBackendSearchResults([]);
        setIsSearchActive(false);
        setCurrentPage(1);
        if (filtersApplied) {
            fetchOrders(1, ordersPerPage, appliedStartDate, appliedEndDate);
        } else {
            fetchOrders(1, ordersPerPage);
        }
    };

    const handleItemsPerPageChange = (e) => {
        const newSize = Number(e.target.value);
        setOrdersPerPage(newSize);
        setCurrentPage(1);
    };

    const handleOrderStatusUpdate = async (order, item, directStatus = null) => {
        setIsLoading(true);
        const updatedStatus = directStatus || statusUpdates[item.itemUniqueId];
        if (!updatedStatus) {
            toast.warning("Please select a status to update.");
            setIsLoading(false);
            return;
        }

        try {
            const updatedItem = await updateItemStatus(order.invoiceId, item.itemUniqueId, updatedStatus);
            toast.success(`Updated #${order.invoiceId} (${item.itemName}) to ${updatedStatus}`);

            setOrders((prevOrders) =>
                prevOrders.map((prevOrder) => {
                    if (prevOrder.invoiceId === order.invoiceId) {
                        return {
                            ...prevOrder,
                            items: prevOrder.items.map((prevItem) =>
                                prevItem.itemUniqueId === item.itemUniqueId
                                    ? { ...prevItem, ...toLegacyItem(updatedItem) }
                                    : prevItem
                            ),
                        };
                    }
                    return prevOrder;
                })
            );

            if (isSearchActive) {
                setBackendSearchResults((prevResults) =>
                    prevResults.map((prevOrder) => {
                        if (prevOrder.invoiceId === order.invoiceId) {
                            return {
                                ...prevOrder,
                                items: prevOrder.items.map((prevItem) =>
                                    prevItem.itemUniqueId === item.itemUniqueId
                                        ? { ...prevItem, ...toLegacyItem(updatedItem) }
                                        : prevItem
                                ),
                            };
                        }
                        return prevOrder;
                    })
                );
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message || "Failed to update status.");
        } finally {
            setStatusUpdates((prev) => {
                const updated = { ...prev };
                delete updated[item.itemUniqueId];
                return updated;
            });
            setIsLoading(false);
        }
    };

    const displayData = isSearchActive ? backendSearchResults : orders;
    const displayTotal = isSearchActive ? backendSearchResults.length : totalOrders;

    // Flatten items for stage count and cards
    const allFlattenedItems = displayData.flatMap((order) =>
        (order.items || []).map((item) => ({ ...item, orderRef: order }))
    );

    const hemmingCount = allFlattenedItems.filter(
        (i) => i.itemOrderStatus === "HEMMING" || i.itemOrderStatus === "SHOP_ASSISTANT_ASSIGNED"
    ).length;

    const ironingCount = allFlattenedItems.filter(
        (i) => i.itemOrderStatus === "IRONING"
    ).length;

    const visibleFlattenedItems = allFlattenedItems.filter((i) => {
        if (stageFilter === "ALL") return true;
        if (stageFilter === "HEMMING") {
            return i.itemOrderStatus === "HEMMING" || i.itemOrderStatus === "SHOP_ASSISTANT_ASSIGNED";
        }
        return i.itemOrderStatus === stageFilter;
    });

    const [selectAll, setSelectAll] = useState(false);
    const handleSelectAll = (e) => {
        const isChecked = e.target.checked;
        setSelectAll(isChecked);
        setOrders((prevOrders) =>
            prevOrders.map((order) => ({
                ...order,
                checked: isChecked,
            }))
        );
        if (isSearchActive) {
            setBackendSearchResults((prev) =>
                prev.map((order) => ({
                    ...order,
                    checked: isChecked,
                }))
            );
        }
    };

    const handleCheckboxChange = (orderId) => {
        setOrders((prevOrders) => {
            const updated = prevOrders.map((order) =>
                order.id === orderId || order.invoiceId === orderId
                    ? { ...order, checked: !order.checked }
                    : order
            );
            setSelectAll(updated.every((order) => order.checked));
            return updated;
        });

        if (isSearchActive) {
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
                ItemName: item.itemName || "",
                OrderDate: DateConverterToIST(order.invoiceDate),
                DueDate: order.expectedDeliveryDate || "",
                Status: item.itemOrderStatus || "",
            }))
        );

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "AssistantQueue");

        const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const data = new Blob([excelBuffer], { type: "application/octet-stream" });
        saveAs(data, `Assistant_Tasks_${new Date().toISOString().split("T")[0]}.xlsx`);

        toast.success(`${selectedOrders.length} order(s) exported successfully.`);
        setOrders((prev) => prev.map((o) => ({ ...o, checked: false })));
        setSelectAll(false);
    };

    const handleApplyFilters = () => {
        let startParam = "";
        let endParam = "";
        const today = new Date();

        if (dateRange !== "custom") {
            let start, end;
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
                startParam = start.toISOString().split("T")[0];
                endParam = end.toISOString().split("T")[0];
            }
        } else {
            if (startDate && endDate) {
                startParam = startDate;
                endParam = endDate;
            } else {
                toast.warning("Please choose both start and end date for custom range.");
                return;
            }
        }

        setAppliedStartDate(startParam);
        setAppliedEndDate(endParam);
        setFiltersApplied(true);
        setIsSearchActive(false);
        setBackendSearchResults([]);
        setCurrentPage(1);
    };

    const handleRemoveFilters = () => {
        setDateRange("week");
        setStartDate("");
        setEndDate("");
        setAppliedStartDate("");
        setAppliedEndDate("");
        setFiltersApplied(false);
        setIsSearchActive(false);
        setBackendSearchResults([]);
        setCurrentPage(1);
        fetchOrders(1, ordersPerPage);
    };

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    return (
        <div className="tailor-master-dashboard-container">
            {/* Header */}
            <header className="tailor-master-dashboard-header">
                <div className="tailor-master-dashboard-header-left">
                    <h1 className="tailor-master-dashboard-title">
                        {shopName !== ' ' ? shopName : "Shop Assistant"} Dashboard
                    </h1>
                    <p className="tailor-master-dashboard-welcome-message">
                        Finishing & Delivery Desk &bull; Welcome back,{" "}
                        <strong>{shopOwner !== ' ' ? shopOwner : "Assistant"}</strong>
                    </p>
                </div>

                <div className="tailor-master-dashboard-header-right">
                    <div className="tailor-master-dashboard-search-box flex items-center">
                        <input
                            type="text"
                            placeholder="Search by Invoice ID or Customer Name"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
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
                    {/* Header Controls */}
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

                    {/* Stage Filter Chips */}
                    <div className="flex items-center gap-2 px-6 py-2.5 bg-slate-50/70 border-b border-slate-200 flex-wrap">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">
                            Finishing Stage:
                        </span>
                        <button
                            onClick={() => setStageFilter("ALL")}
                            className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                                stageFilter === "ALL"
                                    ? "bg-brand-maroon text-white shadow-sm"
                                    : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                            }`}
                        >
                            All Tasks ({allFlattenedItems.length})
                        </button>
                        <button
                            onClick={() => setStageFilter("HEMMING")}
                            className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                                stageFilter === "HEMMING"
                                    ? "bg-brand-maroon text-white shadow-sm"
                                    : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                            }`}
                        >
                            Assigned / Hemming ({hemmingCount})
                        </button>
                        <button
                            onClick={() => setStageFilter("IRONING")}
                            className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                                stageFilter === "IRONING"
                                    ? "bg-brand-maroon text-white shadow-sm"
                                    : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                            }`}
                        >
                            Ironing & Finishing ({ironingCount})
                        </button>

                        <label className="ml-auto flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selectAll}
                                onChange={handleSelectAll}
                                className="w-4 h-4 rounded border-slate-300 text-brand-maroon focus:ring-brand-maroon"
                            />
                            <span>Select All Visible</span>
                        </label>
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
                                            role="shopAssistant"
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
                                        No Finishing Tasks in Queue
                                    </h3>
                                    <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
                                        All garments assigned to finishing are completed or no tasks match this filter.
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Table View */
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
                                            <th>Specs</th>
                                            <th>Current Stage</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayData.length > 0 ? (
                                            displayData.flatMap((order, index) =>
                                                (order.items || []).map((item, itemIndex) => {
                                                    const urgency = getDeliveryUrgency(order.expectedDeliveryDate);
                                                    const statusMeta = getStatusMeta(item.itemOrderStatus || item.status);
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
                                                                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${statusMeta.badgeClass}`}>
                                                                    {statusMeta.label}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                {item.itemOrderStatus === "SHOP_ASSISTANT_ASSIGNED" ? (
                                                                    <button
                                                                        className="px-3 py-1 bg-brand-maroon hover:bg-brand-maroon-hover text-white text-xs font-semibold rounded-md shadow-sm transition"
                                                                        onClick={() => handleOrderStatusUpdate(order, item, "IRONING")}
                                                                    >
                                                                        Start Ironing
                                                                    </button>
                                                                ) : item.itemOrderStatus === "IRONING" || item.itemOrderStatus === "HEMMING" ? (
                                                                    <button
                                                                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md shadow-sm transition"
                                                                        onClick={() => handleOrderStatusUpdate(order, item, "READY_FOR_DELIVERY")}
                                                                    >
                                                                        Mark Ready
                                                                    </button>
                                                                ) : (
                                                                    <select
                                                                        className="tailor-master-dashboard-status-select"
                                                                        value={statusUpdates[item.itemUniqueId] || item.itemOrderStatus || ""}
                                                                        onChange={(e) => handleOrderStatusUpdate(order, item, e.target.value)}
                                                                    >
                                                                        <option value="">--Select--</option>
                                                                        <option value="HEMMING">HEMMING</option>
                                                                        <option value="IRONING">IRONING</option>
                                                                        <option value="READY_FOR_DELIVERY">READY FOR PICKUP</option>
                                                                    </select>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )
                                        ) : (
                                            <tr>
                                                <td colSpan="9" className="text-center py-8 text-slate-500">
                                                    No orders found in finishing queue.
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
            {!isSearchActive && (
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
                            {Math.min(currentPage * ordersPerPage, totalOrders)} of {totalOrders} entries
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

export default ShopAssistance;
