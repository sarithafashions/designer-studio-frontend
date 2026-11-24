// Expenses: period totals, petty cash, Active / Deleted tabs with filters, add / edit / delete with a reason.
import { useCallback, useEffect, useState } from "react";
import { FiPlus, FiSearch, FiX, FiEdit2, FiTrash2, FiCreditCard, FiHome, FiUsers } from "react-icons/fi";
import { MdCurrencyRupee } from "react-icons/md";
import {
    listExpenses, getExpenseSummary, listDeletedExpenses, createShopExpense, createEmployeeExpense, updateExpense,
    deleteExpense, addPettyCash,
} from "../../../api/expenses.js";
import { getFinancialSummary } from "../../../api/reports.js";
import { getPaymentMethods } from "../../../api/reference.js";
import { listShopEmployees, workRoleOf } from "../../../api/employees.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { toast } from "../../../utils/toast.js";
import { PageHeader, KpiCard, Tabs, Button, Segmented, EmptyState, ErrorBox, Skeleton, Badge } from "../../shared/components/ui.jsx";
import { Select, Pagination } from "../../shared/components/form.jsx";
import PeriodFilter from "../../shared/components/PeriodFilter.jsx";
import ExportButton from "../../shared/components/ExportButton.jsx";
import { initialPeriod, rangeParams, PERIODS } from "../../shared/lib/period.js";
import { exportXlsx, exportFileName, fetchAllPages } from "../../shared/lib/exportXlsx.js";
import { formatMoney, formatNumber, formatDate, formatDateTime, formatAmount } from "../../shared/lib/format.js";
import { ExpenseFormModal, DeleteExpenseModal, PettyCashModal } from "./ExpenseModals.jsx";

const PAGE_SIZE = 20;
const TABS = [
    { key: "active", label: "Expenses" },
    { key: "deleted", label: "Deleted" },
];
const KIND_OPTIONS = [
    { key: "", label: "All" },
    { key: "shop", label: "Shop" },
    { key: "employee", label: "Employees" },
];
const SORT_OPTIONS = [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
];
/** Excel columns per tab (same information as the table, one value per cell). */
const exportColumns = (tab) => {
    const base = [
        { header: "Date", value: (r) => r.expenseDate, type: "date" },
        { header: "Category", value: (r) => r.expenseType },
        { header: "For", value: (r) => r.employeeName || "Shop" },
    ];
    if (tab === "deleted") {
        return [
            ...base,
            { header: "Amount", value: (r) => r.expenseAmount, type: "money" },
            { header: "Deleted on", value: (r) => r.deletedAt, type: "datetime" },
            { header: "Deleted by", value: (r) => r.deletedByName },
            { header: "Reason", value: (r) => r.reason },
        ];
    }
    return [
        ...base,
        { header: "Notes", value: (r) => r.notes },
        { header: "Paid by", value: (r) => r.paymentMethod },
        { header: "Amount", value: (r) => r.expenseAmount, type: "money" },
    ];
};
const EMPTY = { search: "", type: "", expenseType: "", paymentMethod: "", employeeUserId: "", sort: "newest" };

export default function ExpensesPage() {
    const [period, setPeriod] = useState(() => initialPeriod("month"));
    const [tab, setTab] = useState("active");
    const [filters, setFilters] = useState(EMPTY);
    const [searchText, setSearchText] = useState("");
    const [pageNumber, setPageNumber] = useState(0);
    const [list, setList] = useState({ loading: true, page: null, error: "" });
    const [summary, setSummary] = useState({ loading: true, data: null });
    const [categories, setCategories] = useState([]);
    const [petty, setPetty] = useState(null);
    const [methods, setMethods] = useState([]);
    const [staff, setStaff] = useState([]);
    const [modal, setModal] = useState(null); // {type: add|edit|delete|petty, expense}

    useEffect(() => {
        getPaymentMethods().then(setMethods);
        listShopEmployees().then((l) => setStaff(l.filter((e) => workRoleOf(e)))).catch(() => setStaff([]));
    }, []);
    useEffect(() => {
        const t = setTimeout(() => {
            setFilters((f) => (f.search === searchText ? f : { ...f, search: searchText }));
            setPageNumber(0);
        }, 350);
        return () => clearTimeout(t);
    }, [searchText]);

    const params = useCallback(
        (extra = {}) => {
            const p = { ...rangeParams(period), ...extra };
            if (filters.search.trim()) p.search = filters.search.trim();
            if (filters.type) p.type = filters.type;
            if (tab === "active") {
                if (filters.expenseType) p.expenseType = filters.expenseType;
                if (filters.paymentMethod) p.paymentMethod = filters.paymentMethod;
                if (filters.type === "employee" && filters.employeeUserId) p.employeeUserId = filters.employeeUserId;
                p.sort = filters.sort;
            }
            return p;
        },
        [period, filters, tab],
    );

    const loadList = useCallback(() => {
        let live = true;
        setList((s) => ({ ...s, loading: true, error: "" }));
        const req = tab === "deleted" ? listDeletedExpenses(params({ pageNumber, pageSize: PAGE_SIZE })) : listExpenses(params({ pageNumber, pageSize: PAGE_SIZE }));
        req.then((page) => live && setList({ loading: false, page, error: "" }))
            .catch((err) => live && setList({ loading: false, page: null, error: getErrorMessage(err, "Could not load expenses") }));
        return () => {
            live = false;
        };
    }, [tab, params, pageNumber]);

    const loadSummary = useCallback(() => {
        setSummary((s) => ({ ...s, loading: true }));
        getExpenseSummary(params()).then((data) => setSummary({ loading: false, data })).catch(() => setSummary({ loading: false, data: null }));
    }, [params]);

    // Category filter options: every category used in the period (old spellings included).
    const loadCategories = useCallback(() => {
        getExpenseSummary(rangeParams(period))
            .then((d) => setCategories((d?.byType || []).map((g) => g.name).filter(Boolean)))
            .catch(() => setCategories([]));
    }, [period]);
    const loadPetty = useCallback(() => {
        getFinancialSummary({}).then((s) => setPetty(s?.pettyCash?.currentBalance ?? null)).catch(() => setPetty(null));
    }, []);

    useEffect(() => loadList(), [loadList]);
    useEffect(() => {
        if (tab === "active") loadSummary();
    }, [loadSummary, tab]);
    useEffect(() => loadCategories(), [loadCategories]);
    useEffect(() => loadPetty(), [loadPetty]);

    const refreshAll = () => {
        loadList();
        loadSummary();
        loadCategories();
        loadPetty();
    };

    const setFilter = (k, v) => {
        setFilters((f) => ({ ...f, [k]: v, ...(k === "type" && v !== "employee" ? { employeeUserId: "" } : {}) }));
        setPageNumber(0);
    };
    const clear = () => {
        setFilters(EMPTY);
        setSearchText("");
        setPageNumber(0);
    };
    const hasFilters = searchText || filters.type || filters.expenseType || filters.paymentMethod || filters.employeeUserId || filters.sort !== "newest";

    // ---- actions
    const saveExpense = async ({ kind, body }) => {
        try {
            if (modal.type === "edit") {
                await updateExpense(modal.expense.id, body);
                toast.success("Expense updated");
            } else {
                await (kind === "employee" ? createEmployeeExpense(body) : createShopExpense(body));
                toast.success("Expense added");
            }
            setModal(null);
            refreshAll();
        } catch (err) {
            toast.error("Could not save", getErrorMessage(err));
        }
    };
    const removeExpense = async (reason) => {
        try {
            await deleteExpense(modal.expense.id, reason);
            toast.success("Expense deleted");
            setModal(null);
            refreshAll();
        } catch (err) {
            toast.error("Could not delete", getErrorMessage(err));
        }
    };
    const topUp = async (amount) => {
        try {
            const res = await addPettyCash(amount);
            toast.success(`${formatMoney(amount)} added to petty cash`);
            setPetty(res?.pettyCashBalance ?? null);
            loadPetty();
        } catch (err) {
            toast.error("Could not add petty cash", getErrorMessage(err));
            throw err;
        }
    };

    const s = summary.data;
    const rows = list.page?.content || [];

    const exportList = async () => {
        const all = await fetchAllPages(({ pageNumber, pageSize }) =>
            (tab === "deleted" ? listDeletedExpenses : listExpenses)(params({ pageNumber, pageSize })),
        );
        const tabLabel = tab === "deleted" ? "Deleted expenses" : "Expenses";
        const periodLabel = PERIODS.find((p) => p.key === period.key)?.label;
        return exportXlsx({
            fileName: exportFileName(tab === "deleted" ? "Expenses_Deleted" : "Expenses", periodLabel),
            sheetName: tabLabel,
            title: `${localStorage.getItem("shopName") || "Saritha Fashions"} · ${tabLabel}`,
            filters: [
                ["Period", periodLabel],
                ["From", period.from],
                ["To", period.to],
                ["Search", filters.search],
                ["For", filters.type && KIND_OPTIONS.find((o) => o.key === filters.type)?.label],
                ["Employee", tab === "active" && filters.type === "employee" && staff.find((e) => e.userId === filters.employeeUserId)?.name],
                ["Category", tab === "active" && filters.expenseType],
                ["Paid by", tab === "active" && filters.paymentMethod],
                ["Sort", tab === "active" && SORT_OPTIONS.find((o) => o.value === filters.sort)?.label],
            ].map(([k, v]) => [k, v || ""]),
            columns: exportColumns(tab),
            rows: all,
        });
    };

    return (
        <>
            <PageHeader
                title="Expenses"
                subtitle="Shop and employee spending, petty cash"
                actions={
                    <div className="so-actions" style={{ alignItems: "center" }}>
                        <PeriodFilter value={period} onChange={(p) => { setPeriod(p); setPageNumber(0); }} />
                        {/* <Button variant="secondary" onClick={() => setModal({ type: "petty" })}>
                            <MdCurrencyRupee aria-hidden /> Petty cash
                        </Button> */}
                        <Button onClick={() => setModal({ type: "add" })}>
                            <FiPlus aria-hidden /> Add expense
                        </Button>
                    </div>
                }
            />

            <div className="so-grid so-grid-kpi" style={{ marginBottom: 16 }}>
                <KpiCard loading={summary.loading} icon={<FiCreditCard aria-hidden />} label="Spent"
                    value={formatAmount(s?.totalAmount)} footer={<span>{formatNumber(s?.count)} expenses{hasFilters ? " (filtered)" : ""}</span>} />
                <KpiCard loading={summary.loading} icon={<FiHome aria-hidden />} label="Shop"
                    value={formatAmount(s?.shopExpenses)} footer={<span>rent, bills, materials…</span>} />
                <KpiCard loading={summary.loading} icon={<FiUsers aria-hidden />} label="Employees"
                    value={formatAmount(s?.employeeExpenses)} footer={<span>salary, advances…</span>} />
                {/* Petty cash is a running balance (not spending in the period), so it gets the deep-green feature card */}
                <KpiCard variant="feature" loading={petty === null && summary.loading} icon={<MdCurrencyRupee aria-hidden />}
                    label="Petty cash balance"
                    value={petty == null ? "—" : formatAmount(petty)}
                    footer={
                        <>
                            <span className={`so-kpi-chip${petty != null && petty <= 0 ? " is-low" : ""}`}>
                                {petty != null && petty <= 0 ? "Empty" : "Right now"}
                            </span>
                            <span>Ask the owner to add more</span>
                        </>
                        // <button type="button" className="so-linkbtn" style={{ padding: 0, width: "auto", fontSize: 12 }} onClick={() => setModal({ type: "petty" })}>
                        // </button>
                    } />
            </div>

            <Tabs tabs={TABS} value={tab} onChange={(k) => { setTab(k); setPageNumber(0); }} />

            <div className="so-filterbar">
                <div className="so-toolbar">
                    <div className="so-search">
                        <FiSearch aria-hidden />
                        <input className="so-input" type="search" placeholder="Search category or notes" aria-label="Search expenses"
                            value={searchText} onChange={(e) => setSearchText(e.target.value)} />
                    </div>
                    {tab === "active" && (
                        <label className="so-inline-field">
                            <span>Sort by</span>
                            <Select options={SORT_OPTIONS} value={filters.sort} onChange={(e) => setFilter("sort", e.target.value)} />
                        </label>
                    )}
                </div>
                <div className="so-filter-row">
                    <div className="so-filter-group">
                        <span className="so-filter-label">For</span>
                        <Segmented label="Expense for" options={KIND_OPTIONS} value={filters.type} onChange={(v) => setFilter("type", v)} />
                    </div>
                    {tab === "active" && filters.type === "employee" && (
                        <div className="so-filter-group">
                            <span className="so-filter-label">Employee</span>
                            <Select aria-label="Employee" placeholder="Everyone" options={staff.map((e) => ({ value: e.userId, label: e.name }))}
                                value={filters.employeeUserId} onChange={(e) => setFilter("employeeUserId", e.target.value)} />
                        </div>
                    )}
                    {tab === "active" && (
                        <>
                            <div className="so-filter-group">
                                <span className="so-filter-label">Category</span>
                                <Select aria-label="Category" placeholder="All categories" options={categories}
                                    value={filters.expenseType} onChange={(e) => setFilter("expenseType", e.target.value)} />
                            </div>
                            <div className="so-filter-group">
                                <span className="so-filter-label">Paid by</span>
                                <Select aria-label="Paid by" placeholder="Any method" options={methods}
                                    value={filters.paymentMethod} onChange={(e) => setFilter("paymentMethod", e.target.value)} />
                            </div>
                        </>
                    )}
                    <div className="so-filter-end">
                        {!list.loading && list.page && <span className="so-hint">{list.page.totalElements} {list.page.totalElements === 1 ? "expense" : "expenses"}</span>}
                        {hasFilters && <Button variant="ghost" size="sm" onClick={clear}><FiX aria-hidden /> Clear filters</Button>}
                        <ExportButton onExport={exportList} disabled={list.loading || !list.page?.totalElements} />
                    </div>
                </div>
            </div>

            {list.error ? (
                <ErrorBox message={list.error} onRetry={loadList} />
            ) : (
                <div className="so-table-wrap">
                    <table className="so-table">
                        <thead>
                            {tab === "active" ? (
                                <tr>
                                    <th>Date</th>
                                    <th>Category</th>
                                    <th>For</th>
                                    <th>Notes</th>
                                    <th>Paid by</th>
                                    <th className="so-num">Amount</th>
                                    <th aria-label="Actions" />
                                </tr>
                            ) : (
                                <tr>
                                    <th>Date</th>
                                    <th>Category</th>
                                    <th>For</th>
                                    <th className="so-num">Amount</th>
                                    <th>Deleted</th>
                                    <th>Reason</th>
                                </tr>
                            )}
                        </thead>
                        <tbody>
                            {list.loading
                                ? Array.from({ length: 6 }).map((_, i) => (
                                      <tr key={i}>{Array.from({ length: tab === "active" ? 7 : 6 }).map((__, j) => <td key={j}><Skeleton width="70%" /></td>)}</tr>
                                  ))
                                : rows.map((r) =>
                                      tab === "active" ? (
                                          <tr key={r.id}>
                                              <td style={{ whiteSpace: "nowrap" }}>{formatDate(r.expenseDate)}</td>
                                              <td className="so-cell-main">{r.expenseType || "—"}</td>
                                              <td>{r.employeeName ? <Badge tone="info" icon={<FiUsers aria-hidden size={12} />}>{r.employeeName}</Badge> : <Badge>Shop</Badge>}</td>
                                              <td style={{ maxWidth: 280 }}>
                                                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.notes || ""}>
                                                      {r.notes || <span className="so-cell-sub">—</span>}
                                                  </div>
                                              </td>
                                              <td>{r.paymentMethod || "—"}</td>
                                              <td className="so-num so-cell-main">{formatMoney(r.expenseAmount)}</td>
                                              <td style={{ whiteSpace: "nowrap" }}>
                                                  <button type="button" className="so-icon-btn" aria-label="Edit expense" title="Edit" onClick={() => setModal({ type: "edit", expense: r })}>
                                                      <FiEdit2 />
                                                  </button>{" "}
                                                  <button type="button" className="so-icon-btn" aria-label="Delete expense" title="Delete" onClick={() => setModal({ type: "delete", expense: r })}>
                                                      <FiTrash2 />
                                                  </button>
                                              </td>
                                          </tr>
                                      ) : (
                                          <tr key={r.archiveId}>
                                              <td style={{ whiteSpace: "nowrap" }}>{formatDate(r.expenseDate)}</td>
                                              <td className="so-cell-main">{r.expenseType || "—"}</td>
                                              <td>{r.employeeName ? <Badge tone="info">{r.employeeName}</Badge> : <Badge>Shop</Badge>}</td>
                                              <td className="so-num">{formatMoney(r.expenseAmount)}</td>
                                              <td>
                                                  <div>{formatDateTime(r.deletedAt)}</div>
                                                  <div className="so-cell-sub">by {r.deletedByName || "—"}</div>
                                              </td>
                                              <td style={{ maxWidth: 280 }}>{r.reason || <span className="so-cell-sub">No reason given</span>}</td>
                                          </tr>
                                      ),
                                  )}
                        </tbody>
                    </table>
                    {!list.loading && rows.length === 0 && (
                        <EmptyState
                            title={tab === "deleted" ? "No deleted expenses in this period" : hasFilters ? "No expenses match these filters" : "No expenses in this period"}
                            message={tab === "deleted" ? "Expenses deleted before this update are not kept here." : undefined}
                            action={tab === "active" && !hasFilters && <Button onClick={() => setModal({ type: "add" })}>Add expense</Button>}
                        />
                    )}
                </div>
            )}
            <Pagination page={list.page} pageSize={PAGE_SIZE} onChange={setPageNumber} />

            <ExpenseFormModal open={modal?.type === "add" || modal?.type === "edit"} expense={modal?.type === "edit" ? modal.expense : null}
                pettyCashBalance={petty} onClose={() => setModal(null)} onSubmit={saveExpense} />
            <DeleteExpenseModal open={modal?.type === "delete"} expense={modal?.expense} onClose={() => setModal(null)} onSubmit={removeExpense} />
            {/* <PettyCashModal open={modal?.type === "petty"} balance={petty} onClose={() => setModal(null)} onTopUp={topUp} /> */}
        </>
    );
}
