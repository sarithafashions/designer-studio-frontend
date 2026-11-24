// One employee: contact, period figures, items with them now, activity per day, salary & advances; edit / remove / delete.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { FiEdit2, FiUserMinus, FiTrash2, FiPhone, FiMail } from "react-icons/fi";
import { Modal, Button, EmptyState, Skeleton } from "../../shared/components/ui.jsx";
import { ItemStatusBadge } from "../../shared/components/status.jsx";
import { RoleBadge } from "./EmployeeModals.jsx";
import { getActivityDaily } from "../../../api/reports.js";
import { listExpenses } from "../../../api/expenses.js";
import { removeFromShop, deleteEmployeeAccount, workRoleOf } from "../../../api/employees.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { toast } from "../../../utils/toast.js";
import { addDays, rangeParams, todayIST } from "../../shared/lib/period.js";
import { formatMoney, formatMoneyShort, formatNumber, formatDate, formatDayShort } from "../../shared/lib/format.js";

const ask = (title, html, confirmButtonText, danger) =>
    Swal.fire({
        title, html, showCancelButton: true, confirmButtonText, cancelButtonText: "Cancel", reverseButtons: true,
        confirmButtonColor: danger ? "#b30000" : "#17171c",
    }).then((r) => r.isConfirmed);

/** Figures shown for each role (fields the backend returns for that role). */
const statsFor = (role, a) => {
    if (!a || a.error) return [];
    if (role === "TAILOR_MASTER") {
        return [
            ["Items cut", formatNumber(a.assigned)],
            ["Quantity", formatNumber(a.totalQuantity)],
            ["Work value", formatMoneyShort(a.totalRevenue)],
            ["Re-assignments", formatNumber(a.totalReassignments)],
        ];
    }
    return [
        ["Assigned", formatNumber(a.totalAssigned ?? a.assigned)],
        ["Completed", formatNumber(a.totalCompleted)],
        ["Work value", formatMoneyShort(a.totalRevenue)],
        ["Re-assignments", formatNumber(a.totalReassignments)],
    ];
};

export default function EmployeeDetail({ employee, period, analytics, openItems, onClose, onEdit, onChanged }) {
    const navigate = useNavigate();
    const [daily, setDaily] = useState({ loading: true, rows: [] });
    const [pay, setPay] = useState({ loading: true, rows: [], total: 0 });
    const [busy, setBusy] = useState(false);

    // "Overall" has no range: the chart shows the last 90 days.
    const chartRange = period.from ? rangeParams(period) : { from: addDays(todayIST(), -89), to: todayIST() };
    const chartLabel = period.from ? "In the selected period" : "Last 90 days";

    useEffect(() => {
        if (!employee) return;
        let live = true;
        setDaily({ loading: true, rows: [] });
        setPay({ loading: true, rows: [], total: 0 });
        getActivityDaily({ employeeId: employee.userId, ...chartRange })
            .then((rows) => live && setDaily({ loading: false, rows: rows || [] }))
            .catch(() => live && setDaily({ loading: false, rows: [] }));
        listExpenses({ type: "employee", employeeUserId: employee.userId, ...rangeParams(period), pageSize: 50 })
            .then((page) => {
                if (!live) return;
                const rows = page?.content || [];
                setPay({ loading: false, rows, total: rows.reduce((s, r) => s + (Number(r.expenseAmount) || 0), 0), more: !page?.lastPage });
            })
            .catch((err) => live && setPay({ loading: false, rows: [], total: 0, error: getErrorMessage(err) }));
        return () => {
            live = false;
        };
    }, [employee?.userId, period.key, period.from, period.to]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!employee) return null;
    const role = workRoleOf(employee);
    const isOwner = (employee.roles || []).includes("SHOP_OWNER");
    const stats = statsFor(role, analytics);

    const remove = async () => {
        if (!(await ask(`Remove ${employee.name} from your shop?`,
            "They stop seeing your shop's work. Their account stays, and you can add them back later with <b>Add staff</b>.",
            "Remove from shop"))) return;
        setBusy(true);
        try {
            await removeFromShop(employee.userId);
            toast.success(`${employee.name} removed from your shop`);
            onChanged();
        } catch (err) {
            toast.error("Could not remove", getErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };
    const destroy = async () => {
        if (!(await ask(`Delete ${employee.name}'s account?`,
            "This <b>cannot be undone</b>. They can no longer sign in, and items they are working on go back one step " +
            "so someone else can be assigned. To keep the account, use <b>Remove from shop</b> instead.",
            "Delete account", true))) return;
        setBusy(true);
        try {
            await deleteEmployeeAccount(employee.userId);
            toast.success("Account deleted");
            onChanged();
        } catch (err) {
            toast.error("Could not delete", getErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const maxCount = Math.max(0, ...daily.rows.map((r) => r.count || 0));

    return (
        <Modal open={!!employee} size="lg" title={employee.name} onClose={busy ? undefined : onClose}
            footer={
                !isOwner && (
                    <div className="so-wz-foot">
                        <div className="so-actions">
                            <Button variant="ghost" size="sm" disabled={busy} onClick={remove}>
                                <FiUserMinus aria-hidden /> Remove from shop
                            </Button>
                            <Button variant="ghost" size="sm" disabled={busy} onClick={destroy} style={{ color: "var(--so-danger)" }}>
                                <FiTrash2 aria-hidden /> Delete account
                            </Button>
                        </div>
                        <Button variant="secondary" size="sm" disabled={busy} onClick={onEdit}>
                            <FiEdit2 aria-hidden /> Edit details
                        </Button>
                    </div>
                )
            }>
            <div className="so-stack" style={{ gap: 20 }}>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", fontSize: 13 }}>
                    <RoleBadge roles={employee.roles} />
                    {employee.phone && (
                        <a href={`tel:${employee.phone}`} style={{ color: "var(--so-ink)", display: "inline-flex", gap: 6, alignItems: "center" }}>
                            <FiPhone aria-hidden /> {employee.phone}
                        </a>
                    )}
                    {employee.email && (
                        <a href={`mailto:${employee.email}`} style={{ color: "var(--so-ink)", display: "inline-flex", gap: 6, alignItems: "center" }}>
                            <FiMail aria-hidden /> {employee.email}
                        </a>
                    )}
                    <span className="so-cell-sub">Salary {employee.salary ? formatMoney(employee.salary) : "not set"}</span>
                    {employee.accountCreationDate && <span className="so-cell-sub">Joined {formatDate(employee.accountCreationDate)}</span>}
                </div>

                {role && (
                    <section>
                        <h3 className="so-card-title" style={{ fontSize: 14, marginBottom: 8 }}>In the period</h3>
                        {!analytics ? (
                            <Skeleton height={64} />
                        ) : analytics.error ? (
                            <div className="so-hint">Could not load: {analytics.error}</div>
                        ) : (
                            <div className="so-stats">
                                {stats.map(([label, value]) => (
                                    <div className="so-stat" key={label}>
                                        <div className="so-stat-value">{value}</div>
                                        <div className="so-stat-label">{label}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                <div className="so-grid so-grid-2">
                    <section>
                        <h3 className="so-card-title" style={{ fontSize: 14, marginBottom: 2 }}>Activity per day</h3>
                        <div className="so-hint" style={{ marginBottom: 8 }}>{chartLabel}</div>
                        {daily.loading ? (
                            <Skeleton height={160} />
                        ) : maxCount === 0 ? (
                            <EmptyState title="No activity" compact />
                        ) : (
                            <div style={{ height: 160 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={daily.rows} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                                        <CartesianGrid vertical={false} stroke="#e5e7eb" />
                                        <XAxis dataKey="date" tickFormatter={formatDayShort} tickLine={false} axisLine={{ stroke: "#d9d9dd" }}
                                            tick={{ fontSize: 11, fill: "#75758a" }} minTickGap={12} />
                                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#75758a" }} />
                                        <Tooltip cursor={{ fill: "rgba(23,23,28,0.04)" }}
                                            content={({ active, payload }) => active && payload?.length ? (
                                                <div className="so-tooltip" style={{ minWidth: 0 }}>
                                                    <div className="so-tooltip-title">{formatDate(payload[0].payload.date)}</div>
                                                    <div className="so-tooltip-row"><span>Actions</span><b>{payload[0].value}</b></div>
                                                </div>
                                            ) : null} />
                                        <Bar dataKey="count" fill="#17171c" radius={[4, 4, 0, 0]} maxBarSize={18} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </section>

                    <section>
                        <h3 className="so-card-title" style={{ fontSize: 14, marginBottom: 8 }}>With them now ({openItems.length})</h3>
                        {role !== "TAILOR" && role !== "SHOP_ASSISTANT" ? (
                            <div className="so-hint">Only tailors and shop assistants hold items.</div>
                        ) : openItems.length === 0 ? (
                            <EmptyState title="Nothing assigned right now" compact />
                        ) : (
                            <div className="so-list" style={{ maxHeight: 180, overflowY: "auto" }}>
                                {openItems.map((it) => (
                                    <div className="so-list-row so-row-link" key={`${it.invoiceId}-${it.itemUniqueId}`} role="link" tabIndex={0}
                                        onClick={() => navigate(`/shopOwner/invoices/${encodeURIComponent(it.invoiceId)}`)}
                                        onKeyDown={(e) => e.key === "Enter" && navigate(`/shopOwner/invoices/${encodeURIComponent(it.invoiceId)}`)}>
                                        <div className="so-list-main">
                                            <div className="so-list-title">{it.itemName}</div>
                                            <div className="so-list-meta"><span className="so-mono">{it.invoiceId}</span> · {it.customerName}</div>
                                        </div>
                                        <ItemStatusBadge status={it.status} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>

                <section>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                        <h3 className="so-card-title" style={{ fontSize: 14, marginBottom: 8 }}>Salary &amp; advances paid in the period</h3>
                        {!pay.loading && !pay.error && <b>{formatMoney(pay.total)}{pay.more ? "+" : ""}</b>}
                    </div>
                    {pay.loading ? (
                        <Skeleton height={60} />
                    ) : pay.error ? (
                        <div className="so-hint">Could not load: {pay.error}</div>
                    ) : pay.rows.length === 0 ? (
                        <EmptyState title="Nothing paid in this period" message="Salary and advances are recorded as employee expenses." compact />
                    ) : (
                        <div className="so-list">
                            {pay.rows.map((r) => (
                                <div className="so-list-row" key={r.id}>
                                    <div className="so-list-main">
                                        <div className="so-list-title">{r.expenseType || "Expense"}</div>
                                        <div className="so-list-meta">{formatDate(r.expenseDate)} · {r.paymentMethod || "—"}{r.notes ? ` · ${r.notes}` : ""}</div>
                                    </div>
                                    <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{formatMoney(r.expenseAmount)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </Modal>
    );
}
