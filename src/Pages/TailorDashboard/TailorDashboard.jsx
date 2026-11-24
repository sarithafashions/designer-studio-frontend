import React, { useEffect, useState } from "react";
import "./TailorDashboard.css";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../LoginPages/axios.js";
import DateConverterToIST from "../../config/DateConverterToIST.jsx";
import AssignShopAssistant from "./AssignShopAssistant/AssignShopAssistant.jsx";
import TrackStatus from "../PaymentInvoice/ViewEditOrder/OrderStatusModal/OrderStatusModal.jsx";
import MeasurementModal from "../../Components/common/MeasurementModal.jsx";
import JobCard from "../../Components/common/JobCard.jsx";
import { toast } from "../../utils/toast.js";
import { getDeliveryUrgency, getStatusMeta } from "../../utils/urgencyHelper.js";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  fetchQueueInvoices,
  filterByInvoiceDate,
  searchInvoices,
  toLegacyItem,
  updateItemStatus,
} from "../../utils/workQueue.js";
import {
  FaThLarge,
  FaListUl,
  FaFileExcel,
  FaSearch,
  FaRulerVertical,
  FaCheckCircle,
} from "react-icons/fa";

const TailorDashboard = () => {
  // ---------- helpers ----------
  const formatToYYYYMMDD = (d) => {
    if (!d) return "";
    const year = d.getFullYear();
    const month = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getThisWeekRange = () => {
    const today = new Date();
    const firstDayOfWeek = new Date(today);
    firstDayOfWeek.setDate(today.getDate() - today.getDay());
    firstDayOfWeek.setHours(0, 0, 0, 0);

    const lastDayOfWeek = new Date(firstDayOfWeek);
    lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
    lastDayOfWeek.setHours(23, 59, 59, 999);

    return {
      start: formatToYYYYMMDD(firstDayOfWeek),
      end: formatToYYYYMMDD(lastDayOfWeek),
    };
  };

  const initialRange = getThisWeekRange();

  // ---------- state ----------
  const [searchTerm, setSearchTerm] = useState("");
  const [orders, setOrders] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [ordersPerPage, setOrdersPerPage] = useState(12);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const pageSizeOptions = [12, 24, 48];
  const [isLoading, setIsLoading] = useState(false);
  const [statusUpdates, setStatusUpdates] = useState({});
  const [backendSearchResults, setBackendSearchResults] = useState([]);

  // UI View toggles
  const [viewMode, setViewMode] = useState("cards"); // 'cards' | 'table'
  const [stageFilter, setStageFilter] = useState("ALL"); // 'ALL' | 'TAILOR_ASSIGNED' | 'STITCHING'
  const [previewMeasurementItem, setPreviewMeasurementItem] = useState(null);

  const navigate = useNavigate();
  const [shopOwner, setShopOwner] = useState(" ");
  const [shopName, setShopName] = useState(" ");

  // filters
  const [dateRange, setDateRange] = useState("Thisweek");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [appliedStartDate, setAppliedStartDate] = useState(initialRange.start);
  const [appliedEndDate, setAppliedEndDate] = useState(initialRange.end);

  // ---------- effects ----------
  useEffect(() => {
    fetchOrders();
    fetchTailorMasterProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, ordersPerPage, appliedStartDate, appliedEndDate]);

  // ---------- API calls ----------
  const fetchOrders = async (
    pageNumber = currentPage - 1,
    pageSize = ordersPerPage,
    start = appliedStartDate,
    end = appliedEndDate
  ) => {
    setIsLoading(true);
    try {
      const all = filterByInvoiceDate(await fetchQueueInvoices(), start, end);
      const fetchedOrders = all.slice(pageNumber * pageSize, (pageNumber + 1) * pageSize);

      setOrders(fetchedOrders);
      setTotalElements(all.length);
      setTotalPages(Math.max(1, Math.ceil(all.length / pageSize)));

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
      setTotalElements(0);
      setTotalPages(1);
      toast.error("Could not fetch queue items.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmationData = () => fetchOrders();

  const fetchTailorMasterProfile = async () => {
    try {
      const res = await axiosInstance.get("/auth/me");
      if (res.status === 200) {
        setShopOwner(res.data.name);
        setShopName(res.data.shopName || "Tailor Studio");
      }
    } catch (e) {
      console.error("Profile error:", e);
    }
  };

  const performBackendSearch = async (term) => {
    if (!term || !term.trim()) {
      setBackendSearchResults([]);
      return;
    }

    try {
      setIsLoading(true);
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

  // ---------- UI helpers ----------
  const filteredOrders = orders.filter(
    (order) =>
      order.invoiceId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer?.customerId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayData = backendSearchResults.length > 0 ? backendSearchResults : filteredOrders;
  const displayTotal = backendSearchResults.length > 0 ? backendSearchResults.length : totalElements;

  // Flatten items for stage calculations & stage filter
  const allFlattenedItems = displayData.flatMap((order) =>
    (order.items || []).map((item) => ({ ...item, orderRef: order }))
  );

  const assignedCount = allFlattenedItems.filter(
    (i) => i.itemOrderStatus === "TAILOR_ASSIGNED" || i.status === "TAILOR_ASSIGNED"
  ).length;

  const stitchingCount = allFlattenedItems.filter(
    (i) => i.itemOrderStatus === "STITCHING" || i.status === "STITCHING"
  ).length;

  const visibleFlattenedItems = allFlattenedItems.filter((i) => {
    if (stageFilter === "ALL") return true;
    const st = i.itemOrderStatus || i.status;
    return st === stageFilter;
  });

  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const handleItemsPerPageChange = (e) => {
    setOrdersPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  // Status updates
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

  const [showAssignPopup, setShowAssignPopup] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const handleAssignClick = (order, currentItem) => {
    setSelectedOrder(order);
    setShowAssignPopup(true);
  };

  const [showTrackStatus, setShowTrackStatus] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const handleTrackStatusView = (orders) => {
    setSelectedCustomer(orders);
    setShowTrackStatus(true);
  };

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
  };

  const handleCheckboxChange = (orderId) => {
    setOrders((prevOrders) => {
      const updatedOrders = prevOrders.map((order) =>
        (order.id === orderId || order.invoiceId === orderId)
          ? { ...order, checked: !order.checked }
          : order
      );
      setSelectAll(updatedOrders.every((order) => order.checked));
      return updatedOrders;
    });
  };

  const exportToExcel = () => {
    const selectedOrders = orders.filter((order) => order.checked);
    if (selectedOrders.length === 0) {
      toast.warning("Please select at least one order to export.");
      return;
    }

    const excelData = selectedOrders.flatMap((order) =>
      (order.items || []).map((item) => ({
        InvoiceID: order.invoiceId,
        CustomerName: order.customer?.name || "",
        ItemName: item.itemName || "",
        InvoiceDate: DateConverterToIST(order.invoiceDate),
        DueDate: order.expectedDeliveryDate || "",
        ItemStatus: item.itemOrderStatus || "",
        Assistant: item.assignedShopAssistantName || "Unassigned",
      }))
    );

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "TailorOrders");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(data, `Tailor_Orders_${new Date().toISOString().split("T")[0]}.xlsx`);

    toast.success(`${selectedOrders.length} order(s) exported to Excel.`);

    setOrders((prevOrders) =>
      prevOrders.map((order) => ({ ...order, checked: false }))
    );
    setSelectAll(false);
  };

  const selectedCount = orders.filter((order) => order.checked).length;

  // ---------- Filters ----------
  const handleApplyFilters = () => {
    let startStr = "";
    let endStr = "";
    const today = new Date();

    if (dateRange !== "custom") {
      let startDateObj, endDateObj;
      switch (dateRange) {
        case "today":
          startDateObj = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          endDateObj = startDateObj;
          break;
        case "yesterday":
          const y = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
          startDateObj = y;
          endDateObj = y;
          break;
        case "week": {
          const endOfLastWeek = new Date(today);
          endOfLastWeek.setDate(today.getDate() - today.getDay() - 1);
          endOfLastWeek.setHours(23, 59, 59, 999);

          const startOfLastWeek = new Date(endOfLastWeek);
          startOfLastWeek.setDate(endOfLastWeek.getDate() - 6);
          startOfLastWeek.setHours(0, 0, 0, 0);

          startDateObj = startOfLastWeek;
          endDateObj = endOfLastWeek;
          break;
        }
        case "Thisweek": {
          const r = getThisWeekRange();
          startStr = r.start;
          endStr = r.end;
          break;
        }
        case "month":
          startDateObj = new Date(today.getFullYear(), today.getMonth(), 1);
          endDateObj = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          break;
        case "year":
          startDateObj = new Date(today.getFullYear(), 0, 1);
          endDateObj = new Date(today.getFullYear(), 11, 31);
          break;
        default:
          break;
      }

      if (!startStr && !endStr && startDateObj && endDateObj) {
        startStr = formatToYYYYMMDD(startDateObj);
        endStr = formatToYYYYMMDD(endDateObj);
      }
    } else {
      if (!startDate || !endDate) {
        toast.warning("Please choose both start and end date for custom range.");
        return;
      }
      startStr = startDate;
      endStr = endDate;
    }

    setAppliedStartDate(startStr);
    setAppliedEndDate(endStr);
    setBackendSearchResults([]);
    setCurrentPage(1);
  };

  const handleRemoveFilters = () => {
    setDateRange("Thisweek");
    const r = getThisWeekRange();
    setStartDate("");
    setEndDate("");
    setAppliedStartDate(r.start);
    setAppliedEndDate(r.end);
    setBackendSearchResults([]);
    setCurrentPage(1);
  };

  return (
    <div className="tailor-master-dashboard-container">
      {/* Studio Header */}
      <header className="tailor-master-dashboard-header">
        <div className="tailor-master-dashboard-header-left">
          <h1 className="tailor-master-dashboard-title">
            {shopName !== " " ? shopName : "Tailor Studio"}
          </h1>
          <p className="tailor-master-dashboard-welcome-message">
            Tailor Production Desk &bull; Welcome back,{" "}
            <strong>{shopOwner !== " " ? shopOwner : "Tailor"}</strong>
          </p>
        </div>
        <div className="tailor-master-dashboard-header-right">
          <div className="tailor-master-dashboard-search-box flex items-center">
            <input
              type="text"
              placeholder="Search Invoice # or Client Name"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (e.target.value === "") setBackendSearchResults([]);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") performBackendSearch(searchTerm);
              }}
              className="tailor-master-dashboard-search-input"
            />
            <button
              onClick={() => performBackendSearch(searchTerm)}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-gold text-brand-maroon font-bold rounded-full text-sm hover:brightness-110 transition ml-2 shadow-sm"
              title="Search Queue"
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
          {/* Controls Bar: Filters & View Switcher */}
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
                  <option value="Thisweek">This Week</option>
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
              {/* Segmented View Mode Switcher */}
              <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  onClick={() => setViewMode("cards")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                    viewMode === "cards"
                      ? "bg-white text-brand-maroon shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Mobile & Tablet Job Cards"
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
                  title="Traditional Table View"
                >
                  <FaListUl className="text-xs" />
                  <span>Table View</span>
                </button>
              </div>

              {/* Excel Export */}
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
              Filter Stage:
            </span>
            <button
              onClick={() => setStageFilter("ALL")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                stageFilter === "ALL"
                  ? "bg-brand-maroon text-white shadow-sm"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              All Items ({allFlattenedItems.length})
            </button>
            <button
              onClick={() => setStageFilter("TAILOR_ASSIGNED")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                stageFilter === "TAILOR_ASSIGNED"
                  ? "bg-brand-maroon text-white shadow-sm"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              Ready to Stitch ({assignedCount})
            </button>
            <button
              onClick={() => setStageFilter("STITCHING")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                stageFilter === "STITCHING"
                  ? "bg-brand-maroon text-white shadow-sm"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              In Stitching ({stitchingCount})
            </button>

            {/* Select All Checkbox */}
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

          {/* Cards View (Tablet & Mobile First) */}
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
                      role="tailor"
                      isChecked={item.orderRef.checked}
                      onToggleCheck={handleCheckboxChange}
                      onStatusUpdate={handleOrderStatusUpdate}
                      onAssignShopAssistant={handleAssignClick}
                      onTrackStatus={handleTrackStatusView}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-200">
                  <FaCheckCircle className="text-4xl text-emerald-500 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-slate-800">
                    No Stitching Tasks in this View
                  </h3>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
                    All assigned garments for the chosen filter are complete or no orders match the selected dates.
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
                      <th>Garment</th>
                      <th>Ordered Date</th>
                      <th>Due Urgency</th>
                      <th>Measurements</th>
                      <th>Stage Status</th>
                      <th>Action</th>
                      <th>Assistant</th>
                      <th>Track</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayData.length > 0 ? (
                      displayData.flatMap((order, index) =>
                        (order.items || []).map((item, itemIndex) => {
                          const urgency = getDeliveryUrgency(order.expectedDeliveryDate);
                          const statusMeta = getStatusMeta(item.itemOrderStatus || item.status);
                          return (
                            <tr key={`${order.invoiceId}-${itemIndex}`}>
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
                              <td>
                                <span className="font-semibold text-slate-800">
                                  {item.itemName}
                                </span>
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
                                <span
                                  className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${statusMeta.badgeClass}`}
                                >
                                  {statusMeta.label}
                                </span>
                              </td>
                              <td>
                                {item.itemOrderStatus === "TAILOR_ASSIGNED" ? (
                                  <button
                                    className="px-3 py-1 bg-brand-maroon hover:bg-brand-maroon-hover text-white text-xs font-semibold rounded-md shadow-sm transition"
                                    onClick={() =>
                                      handleOrderStatusUpdate(order, item, "STITCHING")
                                    }
                                  >
                                    Start Stitching
                                  </button>
                                ) : (
                                  <select
                                    className="tailor-master-dashboard-status-select"
                                    value={
                                      statusUpdates[item.itemUniqueId] ||
                                      item.itemOrderStatus ||
                                      ""
                                    }
                                    onChange={(e) =>
                                      handleOrderStatusUpdate(order, item, e.target.value)
                                    }
                                  >
                                    <option value="STITCHING">STITCHING</option>
                                  </select>
                                )}
                              </td>
                              <td>
                                <button
                                  className={`tailor-master-dashboard-assign-btn ${
                                    item.shopAssistantStatus === "ASSIGNED"
                                      ? "assigned "
                                      : ""
                                  }`}
                                  onClick={() =>
                                    handleAssignClick({
                                      ...order,
                                      currentItem: item,
                                    })
                                  }
                                >
                                  {item.shopAssistantStatus === "ASSIGNED"
                                    ? item.assignedShopAssistantName || "ASSIGNED"
                                    : "Assign Assistant"}
                                </button>
                              </td>
                              <td>
                                <button
                                  className="tailor-master-dashboard-details-btn"
                                  onClick={() =>
                                    handleTrackStatusView({
                                      ...order,
                                      currentItem: item,
                                    })
                                  }
                                >
                                  Track
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )
                    ) : (
                      <tr>
                        <td colSpan="11" className="text-center py-8 text-slate-500">
                          No orders found matching the filter criteria.
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
              {totalPages > 5 && currentPage < totalPages - 2 && (
                <span className="tailor-master-dashboard-ellipsis">...</span>
              )}
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

      {/* Modals */}
      {showTrackStatus && selectedCustomer && (
        <TrackStatus
          customer={selectedCustomer}
          onClose={() => setShowTrackStatus(false)}
        />
      )}

      <AssignShopAssistant
        show={showAssignPopup}
        onClose={() => setShowAssignPopup(false)}
        order={selectedOrder || {}}
        onData={handleConfirmationData}
      />

      {/* Measurement Preview Modal from Table View */}
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

export default TailorDashboard;
