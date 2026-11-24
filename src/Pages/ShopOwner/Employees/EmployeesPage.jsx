// Employees: team KPIs, table (role, contact, salary, items with them now, period figures), detail, edit, add / remove.
import { useCallback, useEffect, useMemo, useState } from "react";
import { FiUserPlus, FiUsers, FiLoader } from "react-icons/fi";
import { MdCurrencyRupee } from "react-icons/md";
import { listShopEmployees, assignToMyShop, updateEmployee, workRoleOf } from "../../../api/employees.js";
import { getEmployeeAnalytics, getActivityByEmployee } from "../../../api/reports.js";
import { listOpenItems } from "../../../api/production.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { toast } from "../../../utils/toast.js";
import { PageHeader, KpiCard, Button, ErrorBox, Skeleton, EmptyState } from "../../shared/components/ui.jsx";
import PeriodFilter from "../../shared/components/PeriodFilter.jsx";
import ExportButton from "../../shared/components/ExportButton.jsx";
import { initialPeriod, rangeParams, PERIODS } from "../../shared/lib/period.js";
import { exportXlsx, exportFileName } from "../../shared/lib/exportXlsx.js";
import { formatMoney, formatMoneyShort, formatNumber, formatDateTime, formatDate, formatAmount, humanize } from "../../shared/lib/format.js";
import { EditEmployeeModal, AddStaffModal, RoleBadge } from "./EmployeeModals.jsx";
import EmployeeDetail from "./EmployeeDetail.jsx";

/** Items currently with each person: their own step (tailor: assigned / stitching; assistant: assigned / hemming / ironing). */
const workloadByUser = (openItems) => {
    const map = {};
    const add = (userId, item) => {
        if (!userId) return;
        (map[userId] = map[userId] || []).push(item);
    };
    openItems.forEach((it) => {
        if (["TAILOR_ASSIGNED", "STITCHING"].includes(it.status)) add(it.tailor?.userId, it);
        if (["SHOP_ASSISTANT_ASSIGNED", "HEMMING", "IRONING"].includes(it.status)) add(it.shopAssistant?.userId, it);
    });
    return map;
};

const periodNumbers = (a, role) => {
    if (!a) return { done: null, value: null };
    if (role === "TAILOR_MASTER") return { done: a.assigned ?? 0, value: a.totalRevenue ?? 0 };
    return { done: a.totalCompleted ?? 0, assigned: a.totalAssigned ?? 0, value: a.totalRevenue ?? 0 };
};

export default function EmployeesPage() {
    const [period, setPeriod] = useState(() => initialPeriod("month"));
    const periodKey = `${period.key}|${period.from}|${period.to}`;

    const [team, setTeam] = useState({ loading: true, list: [], error: "" });
    const [openItems, setOpenItems] = useState({ loading: true, list: [], error: "" });
    const [analytics, setAnalytics] = useState({}); // userId -> analytics | {error}
    const [activity, setActivity] = useState({}); // userId -> {total, lastActivityAt}
    const [selected, setSelected] = useState(null);
    const [editing, setEditing] = useState(null);
    const [adding, setAdding] = useState(false);

    const loadTeam = useCallback(() => {
        setTeam((t) => ({ ...t, loading: true, error: "" }));
        return listShopEmployees()
            .then((list) => setTeam({ loading: false, list, error: "" }))
            .catch((err) => setTeam({ loading: false, list: [], error: getErrorMessage(err, "Could not load employees") }));
    }, []);
    const loadOpenItems = useCallback(() => {
        setOpenItems((s) => ({ ...s, loading: true }));
        listOpenItems()
            .then((list) => setOpenItems({ loading: false, list, error: "" }))
            .catch((err) => setOpenItems({ loading: false, list: [], error: getErrorMessage(err) }));
    }, []);

    useEffect(() => {
        loadTeam();
        loadOpenItems();
    }, [loadTeam, loadOpenItems]);

    // Period figures: one analytics call per working employee + activity totals for everyone.
    useEffect(() => {
        if (team.loading) return;
        let live = true;
        const params = rangeParams(period);
        setAnalytics({});
        team.list.forEach((e) => {
            const role = workRoleOf(e);
            if (!role) return;
            getEmployeeAnalytics({ employeeId: e.userId, role, ...params })
                .then((a) => live && setAnalytics((m) => ({ ...m, [e.userId]: a })))
                .catch((err) => live && setAnalytics((m) => ({ ...m, [e.userId]: { error: getErrorMessage(err) } })));
        });
        getActivityByEmployee(params)
            .then((rows) => {
                if (!live) return;
                const m = {};
                (rows || []).forEach((r) => (m[r.employeeId] = r));
                setActivity(m);
            })
            .catch(() => live && setActivity({}));
        return () => {
            live = false;
        };
    }, [team.loading, team.list, periodKey]); // eslint-disable-line react-hooks/exhaustive-deps

    const workload = useMemo(() => workloadByUser(openItems.list), [openItems.list]);
    const staff = team.list.filter((e) => workRoleOf(e));
    const salaryBill = team.list.reduce((s, e) => s + (Number(e.salary) || 0), 0);

    // Figures still loading (open items, or a working employee's period analytics) — export waits for them.
    const figuresLoading = openItems.loading || staff.some((e) => !analytics[e.userId]);

    const exportTeam = () => {
        const periodLabel = PERIODS.find((p) => p.key === period.key)?.label;
        const figures = (e) => {
            const role = workRoleOf(e);
            const a = analytics[e.userId];
            return { role, a: a && !a.error ? a : null, nums: periodNumbers(a && !a.error ? a : null, role) };
        };
        return exportXlsx({
            fileName: exportFileName("Employees", periodLabel),
            sheetName: "Employees",
            title: `${localStorage.getItem("shopName") || "Saritha Fashions"} · Employees`,
            filters: [
                ["Period", periodLabel],
                ["From", period.from],
                ["To", period.to],
            ].map(([k, v]) => [k, v || ""]),
            columns: [
                { header: "Employee", value: (e) => e.name },
                { header: "Phone", value: (e) => e.phone },
                { header: "Email", value: (e) => e.email },
                {
                    header: "Role",
                    value: (e) => humanize(["SHOP_OWNER", "TAILOR_MASTER", "TAILOR", "SHOP_ASSISTANT"].find((r) => (e.roles || []).includes(r)) || (e.roles || [])[0]),
                },
                { header: "Salary", value: (e) => e.salary || null, type: "money" },
                {
                    header: "With them now",
                    value: (e) => (["TAILOR", "SHOP_ASSISTANT"].includes(workRoleOf(e)) ? workload[e.userId]?.length || 0 : null),
                    type: "number",
                },
                { header: "Done in period", value: (e) => (figures(e).a ? figures(e).nums.done : null), type: "number" },
                { header: "Done means", value: (e) => (figures(e).a ? (figures(e).role === "TAILOR_MASTER" ? "Items cut" : "Items completed") : null) },
                { header: "Work value", value: (e) => (figures(e).a ? figures(e).nums.value : null), type: "money" },
                { header: "Last activity", value: (e) => activity[e.userId]?.lastActivityAt, type: "datetime" },
                { header: "Last sign-in", value: (e) => e.lastLoginDate, type: "date" },
            ],
            rows: team.list,
        });
    };

    const onAdd = async (person) => {
        try {
            await assignToMyShop(person.userId);
            toast.success(`${person.name} added to your shop`);
            loadTeam();
        } catch (err) {
            toast.error("Could not add", getErrorMessage(err));
            throw err;
        }
    };
    const onEdit = async (changes) => {
        try {
            const updated = await updateEmployee(editing.userId, changes);
            toast.success("Employee updated");
            setEditing(null);
            if (selected?.userId === updated?.userId) setSelected(updated);
            loadTeam();
        } catch (err) {
            toast.error("Could not save", getErrorMessage(err));
        }
    };

    return (
        <>
            <PageHeader
                title="Employees"
                subtitle="Your team, their work in progress and how the period went"
                actions={
                    <div className="so-actions" style={{ alignItems: "center" }}>
                        <PeriodFilter value={period} onChange={setPeriod} />
                        <ExportButton onExport={exportTeam} disabled={team.loading || figuresLoading || team.list.length === 0} />
                        <Button variant="secondary" onClick={() => setAdding(true)}>
                            <FiUserPlus aria-hidden /> Add staff
                        </Button>
                    </div>
                }
            />

            <div className="so-grid so-grid-3" style={{ marginBottom: 20 }}>
                <KpiCard loading={team.loading} icon={<FiUsers aria-hidden />} label="Team"
                    value={formatNumber(staff.length)} footer={<span>tailor masters, tailors and shop assistants</span>} />
                <KpiCard loading={openItems.loading} icon={<FiLoader aria-hidden />} label="Items in production"
                    value={formatNumber(openItems.list.filter((i) => i.status !== "ORDER_COMPLETED").length)}
                    footer={<span>{openItems.error ? "Could not load" : "right now, all steps"}</span>} />
                <KpiCard loading={team.loading} icon={<MdCurrencyRupee aria-hidden />} label="Monthly salaries"
                    value={formatAmount(salaryBill)} footer={<span>total of the salaries on file</span>} />
            </div>

            {team.error ? (
                <ErrorBox message={team.error} onRetry={loadTeam} />
            ) : (
                <div className="so-table-wrap">
                    <table className="so-table">
                        <thead>
                            <tr>
                                <th>Employee</th>
                                <th>Role</th>
                                <th className="so-num">Salary</th>
                                <th className="so-num">With them now</th>
                                <th className="so-num">Done in period</th>
                                <th className="so-num">Work value</th>
                                <th>Last activity</th>
                                <th aria-label="Actions" />
                            </tr>
                        </thead>
                        <tbody>
                            {team.loading
                                ? Array.from({ length: 4 }).map((_, i) => (
                                      <tr key={i}>
                                          {Array.from({ length: 8 }).map((__, j) => (
                                              <td key={j}><Skeleton width="70%" /></td>
                                          ))}
                                      </tr>
                                  ))
                                : team.list.map((e) => {
                                      const role = workRoleOf(e);
                                      const a = analytics[e.userId];
                                      const nums = periodNumbers(a && !a.error ? a : null, role);
                                      const now = workload[e.userId]?.length || 0;
                                      const act = activity[e.userId];
                                      const open = () => setSelected(e);
                                      return (
                                          <tr key={e.userId} className="so-row-link" tabIndex={0} onClick={open}
                                              onKeyDown={(ev) => ev.key === "Enter" && open()}>
                                              <td>
                                                  <div className="so-cell-main">{e.name}</div>
                                                  <div className="so-cell-sub">{e.phone || e.email}</div>
                                              </td>
                                              <td><RoleBadge roles={e.roles} /></td>
                                              <td className="so-num">{e.salary ? formatMoney(e.salary) : "—"}</td>
                                              <td className="so-num">
                                                  {role === "TAILOR" || role === "SHOP_ASSISTANT" ? (openItems.loading ? "…" : now) : "—"}
                                              </td>
                                              <td className="so-num">
                                                  {!role ? "—" : !a ? "…" : a.error ? "!" : formatNumber(nums.done)}
                                                  {role === "TAILOR_MASTER" && a && !a.error && <div className="so-cell-sub">cut</div>}
                                              </td>
                                              <td className="so-num">{!role ? "—" : !a ? "…" : a.error ? "!" : formatMoneyShort(nums.value)}</td>
                                              <td>
                                                  {act?.lastActivityAt ? formatDateTime(act.lastActivityAt) : <span className="so-cell-sub">None in period</span>}
                                                  {e.lastLoginDate && <div className="so-cell-sub">Last sign-in {formatDate(e.lastLoginDate)}</div>}
                                              </td>
                                              <td>
                                                  <Button variant="secondary" size="sm" onClick={(ev) => { ev.stopPropagation(); open(); }}>
                                                      View
                                                  </Button>
                                              </td>
                                          </tr>
                                      );
                                  })}
                        </tbody>
                    </table>
                    {!team.loading && team.list.length === 0 && (
                        <EmptyState title="No employees yet" action={<Button onClick={() => setAdding(true)}>Add staff</Button>} />
                    )}
                </div>
            )}

            <EmployeeDetail
                employee={selected}
                period={period}
                analytics={selected ? analytics[selected.userId] : null}
                openItems={selected ? workload[selected.userId] || [] : []}
                onClose={() => setSelected(null)}
                onEdit={() => setEditing(selected)}
                onChanged={() => {
                    setSelected(null);
                    loadTeam();
                    loadOpenItems();
                }}
            />
            <EditEmployeeModal open={!!editing} employee={editing} onClose={() => setEditing(null)} onSubmit={onEdit} />
            <AddStaffModal open={adding} onClose={() => setAdding(false)} onAdd={onAdd} />
        </>
    );
}
