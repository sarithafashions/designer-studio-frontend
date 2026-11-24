// Employees: edit details, add existing (unassigned) staff.
import { useEffect, useState } from "react";
import { Modal, Button, EmptyState, ErrorBox, Badge } from "../../shared/components/ui.jsx";
import { Field, Input, Textarea } from "../../shared/components/form.jsx";
import { listUnassignedStaff } from "../../../api/employees.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { humanize } from "../../shared/lib/format.js";
import { isEmail, isPhone } from "../lib/invoiceForm.js";

/* ------------------------------------------------------------------ Edit */
export function EditEmployeeModal({ open, employee, onClose, onSubmit }) {
    const [form, setForm] = useState({});
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open || !employee) return;
        setForm({
            name: employee.name || "",
            email: employee.email || "",
            phone: employee.phone || "",
            salary: employee.salary ? String(employee.salary) : "",
            address: employee.address || "",
        });
        setErrors({});
    }, [open, employee]);

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const submit = async () => {
        const e = {};
        if (!form.name.trim()) e.name = "Enter the name";
        if (!isEmail(form.email)) e.email = "Enter a valid email";
        if (form.phone.trim() && !isPhone(form.phone)) e.phone = "Enter 10 digits or leave empty";
        const salary = form.salary === "" ? 0 : Number(form.salary);
        if (Number.isNaN(salary) || salary < 0 || salary > 10000000) e.salary = "Enter a valid monthly salary";
        setErrors(e);
        if (Object.keys(e).length) return;

        const changes = {};
        if (form.name.trim() !== (employee.name || "")) changes.name = form.name.trim();
        if (form.email.trim().toLowerCase() !== (employee.email || "").toLowerCase()) changes.email = form.email.trim();
        if (form.phone.trim() !== (employee.phone || "")) changes.phone = form.phone.trim();
        if (salary !== (employee.salary || 0)) changes.salary = salary;
        if (form.address.trim() !== (employee.address || "")) changes.address = form.address.trim();
        if (!Object.keys(changes).length) return onClose();
        setBusy(true);
        try {
            await onSubmit(changes);
        } finally {
            setBusy(false);
        }
    };

    const emailChanged = employee && form.email && form.email.trim().toLowerCase() !== (employee.email || "").toLowerCase();

    return (
        <Modal
            open={open}
            title={`Edit ${employee?.name || "employee"}`}
            onClose={busy ? undefined : onClose}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button onClick={submit} disabled={busy}>
                        {busy ? "Saving…" : "Save changes"}
                    </Button>
                </>
            }
        >
            <div className="so-form-grid">
                <Field label="Name *" htmlFor="emp-name" error={errors.name}>
                    <Input id="emp-name" maxLength={100} value={form.name || ""} invalid={!!errors.name} onChange={set("name")} />
                </Field>
                <Field label="Mobile number" htmlFor="emp-phone" error={errors.phone}>
                    <Input id="emp-phone" inputMode="numeric" maxLength={10} value={form.phone || ""} invalid={!!errors.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "") }))} />
                </Field>
                <Field label="Sign-in email *" htmlFor="emp-email" error={errors.email}
                    hint={emailChanged ? "Changing it signs them out — they sign in with the new email" : undefined}
                    style={{ gridColumn: "1 / -1" }}>
                    <Input id="emp-email" type="email" maxLength={150} value={form.email || ""} invalid={!!errors.email} onChange={set("email")} />
                </Field>
                <Field label="Monthly salary (₹)" htmlFor="emp-salary" error={errors.salary}>
                    <Input id="emp-salary" type="number" inputMode="decimal" min="0" step="1" value={form.salary || ""}
                        invalid={!!errors.salary} onChange={set("salary")} />
                </Field>
                <div />
                <Field label="Address" htmlFor="emp-address" style={{ gridColumn: "1 / -1" }}>
                    <Textarea id="emp-address" maxLength={300} value={form.address || ""} onChange={set("address")} style={{ minHeight: 64 }} />
                </Field>
            </div>
        </Modal>
    );
}

/* ------------------------------------------------------------------ Add existing staff */
export function AddStaffModal({ open, onClose, onAdd }) {
    const [state, setState] = useState({ loading: true, list: [], error: "" });
    const [busyId, setBusyId] = useState(null);

    const load = () => {
        setState({ loading: true, list: [], error: "" });
        listUnassignedStaff()
            .then((list) => setState({ loading: false, list, error: "" }))
            .catch((err) => setState({ loading: false, list: [], error: getErrorMessage(err, "Could not load staff") }));
    };
    useEffect(() => {
        if (open) load();
    }, [open]);

    const add = async (person) => {
        setBusyId(person.userId);
        try {
            await onAdd(person);
            setState((s) => ({ ...s, list: s.list.filter((p) => p.userId !== person.userId) }));
        } finally {
            setBusyId(null);
        }
    };

    return (
        <Modal open={open} title="Add staff to your shop" onClose={busyId ? undefined : onClose}
            footer={<Button variant="secondary" onClick={onClose}>Done</Button>}>
            <p className="so-hint" style={{ marginTop: 0 }}>
                Staff accounts that don&apos;t work in any shop yet. New accounts are created by the platform owner.
            </p>
            {state.error ? (
                <ErrorBox message={state.error} onRetry={load} />
            ) : state.loading ? (
                <div className="so-hint">Loading…</div>
            ) : state.list.length === 0 ? (
                <EmptyState title="No unassigned staff" message="Ask the platform owner to create the account first." compact />
            ) : (
                <div className="so-list">
                    {state.list.map((p) => (
                        <div className="so-list-row" key={p.userId}>
                            <div className="so-list-main">
                                <div className="so-list-title">{p.name}</div>
                                <div className="so-list-meta">
                                    {(p.roles || []).map((r) => humanize(r)).join(", ")} · {p.email}
                                    {p.phone ? ` · ${p.phone}` : ""}
                                </div>
                            </div>
                            <Button size="sm" disabled={!!busyId} onClick={() => add(p)}>
                                {busyId === p.userId ? "Adding…" : "Add"}
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </Modal>
    );
}

/* ------------------------------------------------------------------ Role badge */
const ROLE_LABEL = { TAILOR_MASTER: "Tailor master", TAILOR: "Tailor", SHOP_ASSISTANT: "Shop assistant", SHOP_OWNER: "Shop owner" };
// Each role has its own colour (identity, not status): owner near-black, master deep green, tailor plum, assistant coral.
const ROLE_CLASS = { SHOP_OWNER: "owner", TAILOR_MASTER: "master", TAILOR: "tailor", SHOP_ASSISTANT: "assistant" };
export function RoleBadge({ roles = [] }) {
    const main = ["SHOP_OWNER", "TAILOR_MASTER", "TAILOR", "SHOP_ASSISTANT"].find((r) => roles.includes(r));
    if (!main) return <Badge tone="neutral">{humanize(roles[0]) || "—"}</Badge>;
    return (
        <span className={`so-badge so-role so-role-${ROLE_CLASS[main]}`}>
            <span className="so-role-dot" aria-hidden />
            {ROLE_LABEL[main]}
        </span>
    );
}
