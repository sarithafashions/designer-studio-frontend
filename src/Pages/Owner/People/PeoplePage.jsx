// Platform owner: everyone across the branches with this period's work (GET /reports/activities/by-employee).
// Filters: branch, role, period, search (URL). The key counts depend on the role; the best of each role is marked.
// A row opens the branch's People tab (where staff are added / edited / moved).
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiSearch, FiStar } from "react-icons/fi";
import { listShopSummaries, listBranchEmployees, listUnassignedUsers } from "../../../api/owner.js";
import { getActivityByEmployee } from "../../../api/reports.js";
import { PageHeader, Card, Badge, EmptyState, ErrorBox, Skeleton } from "../../shared/components/ui.jsx";
import { Select } from "../../shared/components/form.jsx";
import PeriodFilter from "../../shared/components/PeriodFilter.jsx";
import { rangeParams } from "../../shared/lib/period.js";
import { formatNumber, formatDateTime } from "../../shared/lib/format.js";
import { FilterPills } from "../../shared/production/DeskParts.jsx";
import ExportButton from "../../shared/components/ExportButton.jsx";
import { exportXlsx, exportFileName } from "../../shared/lib/exportXlsx.js";
import { periodFrom, periodText, withPeriod, useSection } from "../lib/owner.js";

const ROLE_ORDER = ["SHOP_OWNER", "TAILOR_MASTER", "TAILOR", "SHOP_ASSISTANT"];
const ROLE_LABEL = { SHOP_OWNER: "Shop owner", TAILOR_MASTER: "Tailor master", TAILOR: "Tailor", SHOP_ASSISTANT: "Shop assistant" };
const roleOf = (p) => ROLE_ORDER.find((r) => (p.roles || []).includes(r)) || (p.roles || [])[0] || "";

/** The counts that show a role's work (first = main, used for "top"). */
const KEY_WORK = {
    SHOP_OWNER: [["INVOICE_CREATED", "invoices"], ["ORDER_DELIVERED", "delivered"]],
    TAILOR_MASTER: [["TAILOR_MASTER_CUTTING", "cut"], ["ASSIGNED_TO_TAILOR", "assigned"]],
    TAILOR: [["TAILOR_STITCHING", "started"], ["ASSIGNED_TO_ASSISTANT", "handed over"]],
    SHOP_ASSISTANT: [["ORDER_COMPLETED", "completed"], ["ASSISTANT_HEMMING", "hemming & ironing"]],
};
const mainCount = (p) => (KEY_WORK[p.role] ? p.counts[KEY_WORK[p.role][0][0]] || 0 : 0);

/** Excel columns: one role -> its key counts as number columns; mixed roles -> the key work as text. */
const exportColumns = (role, top) => [
    { header: "Name", value: (p) => p.name },
    { header: "Email", value: (p) => p.email },
    { header: "Phone", value: (p) => p.phone },
    { header: "Role", value: (p) => ROLE_LABEL[p.role] || "" },
    { header: "Branch", value: (p) => p.shopName || "Not in a branch" },
    ...(KEY_WORK[role]
        ? KEY_WORK[role].map(([type, label]) => ({ header: label.charAt(0).toUpperCase() + label.slice(1), value: (p) => p.counts[type] || 0, type: "number" }))
        : [{ header: "Work in the period", value: (p) => (KEY_WORK[p.role] || []).map(([type, label]) => `${p.counts[type] || 0} ${label}`).join(", ") }]),
    { header: "Most work in role", value: (p) => (top[p.role] && mainCount(p) === top[p.role] ? "Yes" : "") },
    { header: "All actions", value: (p) => p.total, type: "number" },
    { header: "Last active", value: (p) => p.lastActivityAt, type: "datetime" },
    { header: "Last login", value: (p) => p.lastLoginDate, type: "datetime" },
];

export default function PeoplePage() {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const period = periodFrom(params);
    const periodKey = `${period.key}|${period.from}|${period.to}`;
    const shopId = params.get("shop") || "";
    // All branches: no "All" role (too many people in one list) -> one role at a time, shop owners first.
    // One branch: "All" is available (and the default).
    const requestedRole = params.get("role") || "all";
    const role = !shopId && requestedRole === "all" ? "SHOP_OWNER" : requestedRole;
    const [search, setSearch] = useState("");
    const setParam = (key, value) => setParams((cur) => {
        const next = new URLSearchParams(cur);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
    }, { replace: true });

    // everyone (branches + unassigned) — once
    const [people, reloadPeople] = useSection(async () => {
        const shops = await listShopSummaries();
        const lists = await Promise.all(shops.map((s) => listBranchEmployees(s.shopId).then((list) => list.map((e) => ({ ...e, shopId: s.shopId, shopName: s.shopName })))));
        const unassigned = (await listUnassignedUsers()).map((e) => ({ ...e, shopId: null, shopName: null }));
        return { shops, everyone: [...lists.flat(), ...unassigned] };
    }, []);
    // their work in the period
    const [work, reloadWork] = useSection(() => getActivityByEmployee({ ...(shopId ? { shopId } : {}), ...rangeParams(period) }), [periodKey, shopId]);

    const rows = useMemo(() => {
        const byId = new Map((work.data || []).map((w) => [w.employeeId, w]));
        const text = search.trim().toLowerCase();
        const list = (people.data?.everyone || []).map((p) => {
            const w = byId.get(p.userId);
            return { ...p, role: roleOf(p), counts: w?.countsByType || {}, total: w?.total || 0, lastActivityAt: w?.lastActivityAt || null };
        }).filter((p) => (shopId ? p.shopId === shopId : true)
            && (role === "all" ? true : role === "unassigned" ? !p.shopId : p.role === role)
            && (!text || [p.name, p.email, p.phone, p.shopName].some((v) => (v || "").toLowerCase().includes(text))));
        return list.sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || mainCount(b) - mainCount(a) || (a.name || "").localeCompare(b.name || ""));
    }, [people.data, work.data, shopId, role, search]);

    // best of each role among the rows shown (needs a count above 0 and no tie)
    const top = useMemo(() => {
        const best = {};
        ROLE_ORDER.forEach((r) => {
            const counts = rows.filter((p) => p.role === r).map(mainCount);
            const max = Math.max(0, ...counts);
            if (max > 0 && counts.filter((c) => c === max).length === 1) best[r] = max;
        });
        return best;
    }, [rows]);

    const all = people.data?.everyone || [];
    const roleCount = (r) => all.filter((p) => (shopId ? p.shopId === shopId : true) && (r === "unassigned" ? !p.shopId : r === "all" ? true : roleOf(p) === r)).length;
    const pills = [...(shopId ? ["all"] : []), ...ROLE_ORDER, "unassigned"].map((k) => ({ key: k, label: k === "all" ? "All" : k === "unassigned" ? "Unassigned" : ROLE_LABEL[k], count: people.loading ? undefined : roleCount(k) }));
    const shops = (people.data?.shops || []).map((s) => ({ value: s.shopId, label: s.shopName || "Branch" })).sort((a, b) => a.label.localeCompare(b.label));

    // the rows are fully loaded and filtered in memory: export them as shown
    const exportRows = () => {
        const branch = shops.find((s) => s.value === shopId)?.label;
        return exportXlsx({
            fileName: exportFileName("People", branch),
            sheetName: "People",
            title: `${branch || "All branches"} · People`,
            filters: [
                ["Branch", branch || "All branches"],
                ["Role", pills.find((p) => p.key === role)?.label],
                ["Period", periodText(period)],
                ["Search", search.trim()],
            ],
            columns: exportColumns(role, top),
            rows,
        });
    };

    return (
        <>
            <PageHeader eyebrow={shopId ? "Branch" : "All branches"} title="People"
                subtitle={`Work counted ${periodText(period).toLowerCase()} · ★ = the most work in that role`}
                actions={
                    <div className="so-actions" style={{ alignItems: "center" }}>
                        <label className="so-inline-field">
                            <span>Branch</span>
                            <Select aria-label="Branch" value={shopId} onChange={(e) => setParam("shop", e.target.value)} placeholder="All branches" options={shops} />
                        </label>
                        <PeriodFilter value={period} onChange={(p) => setParams((cur) => withPeriod(cur, p), { replace: true })} />
                    </div>
                } />

            <div className="so-filterbar">
                <FilterPills label="Role" options={pills} value={role} onChange={(k) => setParam("role", k === "all" ? "" : k)} />
                <div className="so-toolbar" style={{ marginTop: 10 }}>
                    <div className="so-search" style={{ maxWidth: 360, flex: 1 }}>
                        <FiSearch aria-hidden />
                        <input className="so-input" type="search" placeholder="Search name, email, phone or branch" aria-label="Search people"
                            value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <div className="so-filter-end">
                        <ExportButton onExport={exportRows} disabled={people.loading || work.loading || !!people.error || !!work.error || !rows.length} />
                    </div>
                </div>
            </div>

            <Card>
                {people.error ? <ErrorBox message={people.error} onRetry={reloadPeople} />
                    : work.error ? <ErrorBox message={work.error} onRetry={reloadWork} />
                    : people.loading ? <Skeleton height={300} />
                    : !rows.length ? <EmptyState compact title="Nobody matches these filters" />
                    : (
                        <div className="so-table-wrap">
                            <table className="so-table">
                                <thead>
                                    <tr><th>Name</th><th>Role</th><th>Branch</th><th>Work in the period</th><th className="so-num">All actions</th><th>Last active</th><th>Last login</th></tr>
                                </thead>
                                <tbody>
                                    {rows.map((p) => {
                                        const isTop = top[p.role] && mainCount(p) === top[p.role];
                                        const open = () => p.shopId && navigate(`/owner/branches/${encodeURIComponent(p.shopId)}?tab=people`);
                                        return (
                                            <tr key={p.userId} className={p.shopId ? "so-row-link" : undefined} tabIndex={p.shopId ? 0 : undefined}
                                                onClick={open} onKeyDown={(e) => e.key === "Enter" && open()}>
                                                <td>
                                                    <div className="so-cell-main">
                                                        {p.name || "—"} {isTop && <FiStar className="ow-star" aria-label="Most work in this role" />}
                                                    </div>
                                                    <div className="so-cell-sub">{p.email}{p.phone ? ` · ${p.phone}` : ""}</div>
                                                </td>
                                                <td><Badge tone={p.role === "SHOP_OWNER" ? "info" : "neutral"}>{ROLE_LABEL[p.role] || "—"}</Badge></td>
                                                <td>{p.shopName || <span className="so-cell-sub">Not in a branch</span>}</td>
                                                <td>
                                                    {KEY_WORK[p.role] ? (
                                                        <span className="ow-work">
                                                            {KEY_WORK[p.role].map(([type, label]) => (
                                                                <span key={type}><b>{formatNumber(p.counts[type] || 0)}</b> {label}</span>
                                                            ))}
                                                        </span>
                                                    ) : "—"}
                                                </td>
                                                <td className="so-num">{work.loading ? "…" : formatNumber(p.total)}</td>
                                                <td style={{ whiteSpace: "nowrap" }}>{p.lastActivityAt ? formatDateTime(p.lastActivityAt) : <span className="so-cell-sub">—</span>}</td>
                                                <td style={{ whiteSpace: "nowrap" }}>{p.lastLoginDate ? formatDateTime(p.lastLoginDate) : <span className="so-cell-sub">Never</span>}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
            </Card>
        </>
    );
}
