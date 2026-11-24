// Expenses: add / edit, delete with a reason, petty cash (balance, top-up, history).
import { useEffect, useState } from "react";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import { Modal, Button, Segmented, EmptyState } from "../../shared/components/ui.jsx";
import { Field, Input, Select, Textarea } from "../../shared/components/form.jsx";
import DateField from "../../shared/components/DateField.jsx";
import { getPaymentMethods } from "../../../api/reference.js";
import { listShopEmployees, workRoleOf } from "../../../api/employees.js";
import { SHOP_CATEGORIES, EMPLOYEE_CATEGORIES, DETAIL_FIELD, listPettyCashTopUps } from "../../../api/expenses.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { formatMoney, formatDateTime } from "../../shared/lib/format.js";
import { todayIST } from "../../shared/lib/period.js";

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const isAmount = (v) => v !== "" && Number(v) >= 0.01 && Number(v) <= 10000000 && /^\d+(\.\d{1,2})?$/.test(String(v).trim());
const KINDS = [
    { key: "shop", label: "Shop expense" },
    { key: "employee", label: "Employee expense" },
];

/** yyyy-MM-dd (IST) of a stored expense date. */
const dayOf = (date) =>
    date ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(date)) : todayIST();

/* ------------------------------------------------------------------ Add / edit */
export function ExpenseFormModal({ open, expense, pettyCashBalance, onClose, onSubmit }) {
    const isEdit = !!expense;
    const [kind, setKind] = useState("shop");
    const [form, setForm] = useState({});
    const [lines, setLines] = useState([]);
    const [errors, setErrors] = useState({});
    const [methods, setMethods] = useState([]);
    const [staff, setStaff] = useState([]);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) return;
        getPaymentMethods().then(setMethods);
        listShopEmployees()
            .then((list) => setStaff(list.filter((e) => workRoleOf(e))))
            .catch(() => setStaff([]));
        const isEmp = !!expense?.employeeName;
        setKind(isEdit ? (isEmp ? "employee" : "shop") : "shop");
        const cats = isEmp ? EMPLOYEE_CATEGORIES : SHOP_CATEGORIES;
        const type = expense?.expenseType || "";
        setForm({
            expenseType: !type || cats.includes(type) ? type : "__custom",
            customType: type && !cats.includes(type) ? type : "",
            expenseAmount: expense ? String(expense.expenseAmount) : "",
            paymentMethod: expense?.paymentMethod || "Cash",
            expenseDate: expense ? dayOf(expense.expenseDate) : todayIST(),
            employeeUserId: expense?.userId || "",
            notes: expense?.notes || "",
        });
        setLines([]);
        setErrors({});
    }, [open, expense, isEdit]);

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
    const categories = kind === "employee" ? EMPLOYEE_CATEGORIES : SHOP_CATEGORIES;
    const type = form.expenseType === "__custom" ? (form.customType || "").trim() : form.expenseType;
    const detailField = !isEdit && DETAIL_FIELD[type];
    const isTravel = detailField === "travelDetails";
    const linesTotal = round2(lines.reduce((s, l) => s + (Number(l.amount) || 0), 0));
    const amount = lines.length ? linesTotal : Number(form.expenseAmount) || 0;
    const cashShort =
        form.paymentMethod === "Cash" && pettyCashBalance != null &&
        amount - (isEdit && expense?.paymentMethod === "Cash" ? expense.expenseAmount : 0) > pettyCashBalance + 0.001;

    const setLine = (i, k, v) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

    const submit = async () => {
        const e = {};
        if (!type) e.expenseType = "Choose or type a category";
        if (lines.length) {
            lines.forEach((l, i) => {
                if (!isAmount(l.amount)) e[`line${i}`] = "Enter an amount";
            });
        } else if (!isAmount(form.expenseAmount)) e.expenseAmount = "Enter an amount above ₹0";
        if (!form.expenseDate) e.expenseDate = "Choose the date";
        else if (form.expenseDate > todayIST()) e.expenseDate = "Can't be in the future";
        if (kind === "employee" && !form.employeeUserId) e.employeeUserId = "Choose the employee";
        if (!form.paymentMethod) e.paymentMethod = "Choose how it was paid";
        setErrors(e);
        if (Object.keys(e).length) return;

        let body;
        if (isEdit) {
            body = {};
            if (type !== expense.expenseType) body.expenseType = type;
            if (round2(amount) !== round2(expense.expenseAmount)) body.expenseAmount = round2(amount);
            if (form.paymentMethod !== expense.paymentMethod) body.paymentMethod = form.paymentMethod;
            if (form.expenseDate !== dayOf(expense.expenseDate)) body.expenseDate = form.expenseDate;
            if (form.notes.trim() !== (expense.notes || "")) body.notes = form.notes.trim();
            if (kind === "employee" && form.employeeUserId !== expense.userId) body.employeeUserId = form.employeeUserId;
            if (!Object.keys(body).length) return onClose();
        } else {
            body = {
                expenseType: type,
                expenseAmount: round2(amount),
                paymentMethod: form.paymentMethod,
                expenseDate: form.expenseDate,
                ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
                ...(kind === "employee" ? { employeeUserId: form.employeeUserId } : {}),
            };
            if (detailField && lines.length) {
                body[detailField] = lines.map((l) => ({
                    amount: round2(l.amount),
                    ...(l.description?.trim() ? { description: l.description.trim() } : {}),
                    ...(isTravel ? { source: l.source?.trim() || "", destination: l.destination?.trim() || "", date: l.date || form.expenseDate } : {}),
                }));
            }
        }
        setBusy(true);
        try {
            await onSubmit({ kind, body });
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            open={open}
            title={isEdit ? "Edit expense" : "Add expense"}
            onClose={busy ? undefined : onClose}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
                    <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : isEdit ? "Save changes" : "Add expense"}</Button>
                </>
            }
        >
            {!isEdit && (
                <div style={{ marginBottom: 16 }}>
                    <Segmented options={KINDS} value={kind} label="Expense for"
                        onChange={(k) => { setKind(k); setForm((f) => ({ ...f, expenseType: "", customType: "" })); setLines([]); }} />
                </div>
            )}
            <div className="so-form-grid">
                {kind === "employee" && (
                    <Field label="Employee *" htmlFor="ex-emp" error={errors.employeeUserId} style={{ gridColumn: "1 / -1" }}>
                        <Select id="ex-emp" placeholder="Choose the employee" options={staff.map((s) => ({ value: s.userId, label: s.name }))}
                            value={form.employeeUserId || ""} invalid={!!errors.employeeUserId} onChange={set("employeeUserId")} />
                    </Field>
                )}
                <Field label="Category *" htmlFor="ex-type" error={errors.expenseType}>
                    <Select id="ex-type" placeholder="Choose" invalid={!!errors.expenseType}
                        options={[...categories, { value: "__custom", label: "Something else…" }]}
                        value={form.expenseType || ""} onChange={(e) => { set("expenseType")(e); setLines([]); }} />
                </Field>
                {form.expenseType === "__custom" && (
                    <Field label="Category name *" htmlFor="ex-custom">
                        <Input id="ex-custom" maxLength={100} value={form.customType || ""} onChange={set("customType")} />
                    </Field>
                )}
                <Field label="Date *" htmlFor="ex-date" error={errors.expenseDate}>
                    <DateField id="ex-date" max={todayIST()} value={form.expenseDate || ""} invalid={!!errors.expenseDate}
                        onChange={(v) => setForm((f) => ({ ...f, expenseDate: v }))} />
                </Field>
                <Field label="Amount (₹) *" htmlFor="ex-amount" error={errors.expenseAmount}
                    hint={lines.length ? "Sum of the lines below" : undefined}>
                    <Input id="ex-amount" type="number" inputMode="decimal" min="0.01" step="0.01"
                        value={lines.length ? String(linesTotal) : form.expenseAmount || ""} disabled={lines.length > 0}
                        invalid={!!errors.expenseAmount} onChange={set("expenseAmount")} />
                </Field>
                <Field label="Paid by *" htmlFor="ex-method" error={errors.paymentMethod}
                    hint={form.paymentMethod === "Cash" && pettyCashBalance != null ? `Taken from petty cash (balance ${formatMoney(pettyCashBalance)})` : undefined}>
                    <Select id="ex-method" options={methods} value={form.paymentMethod || ""} onChange={set("paymentMethod")} />
                </Field>
                {cashShort && (
                    <div className="so-field-error" style={{ gridColumn: "1 / -1", marginTop: -6 }}>
                        Petty cash is too low for this. Top it up first, or choose another payment method.
                    </div>
                )}
                <Field label="Notes" htmlFor="ex-notes" hint="Optional" style={{ gridColumn: "1 / -1" }}>
                    <Textarea id="ex-notes" maxLength={500} value={form.notes || ""} onChange={set("notes")} style={{ minHeight: 56 }} />
                </Field>
            </div>

            {detailField && (
                <div className="so-measure" style={{ marginTop: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: lines.length ? 10 : 0 }}>
                        <span className="so-label">{type} details <span className="so-hint">— optional, one line per bill</span></span>
                        <Button variant="secondary" size="sm" onClick={() => setLines((ls) => [...ls, { amount: "", description: "", source: "", destination: "", date: form.expenseDate }])}>
                            <FiPlus aria-hidden /> Add line
                        </Button>
                    </div>
                    {lines.map((l, i) => (
                        <div key={i} className="so-line" style={{ gridTemplateColumns: isTravel ? "1fr 1fr 110px 1.4fr auto" : "110px 1fr auto" }}>
                            {isTravel && <Input aria-label="From" placeholder="From" maxLength={100} value={l.source} onChange={(e) => setLine(i, "source", e.target.value)} />}
                            {isTravel && <Input aria-label="To" placeholder="To" maxLength={100} value={l.destination} onChange={(e) => setLine(i, "destination", e.target.value)} />}
                            <Input aria-label="Amount" placeholder="₹" type="number" inputMode="decimal" min="0.01" step="0.01" value={l.amount}
                                invalid={!!errors[`line${i}`]} onChange={(e) => setLine(i, "amount", e.target.value)} />
                            <Input aria-label="Description" placeholder="What for" maxLength={200} value={l.description} onChange={(e) => setLine(i, "description", e.target.value)} />
                            <button type="button" className="so-icon-btn" aria-label="Remove line" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                                <FiTrash2 />
                            </button>
                        </div>
                    ))}
                </div>
            )}
            {isEdit && (expense?.refreshmentDetails?.length || expense?.travelDetails?.length || expense?.miscellaneousDetails?.length) ? (
                <p className="so-hint" style={{ marginBottom: 0 }}>This expense has line items; they stay as they are.</p>
            ) : null}
        </Modal>
    );
}

/* ------------------------------------------------------------------ Delete */
export function DeleteExpenseModal({ open, expense, onClose, onSubmit }) {
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        if (open) setReason("");
    }, [open]);
    const submit = async () => {
        setBusy(true);
        try {
            await onSubmit(reason.trim());
        } finally {
            setBusy(false);
        }
    };
    return (
        <Modal open={open} title="Delete this expense?" onClose={busy ? undefined : onClose}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={busy}>Keep it</Button>
                    <Button variant="danger" onClick={submit} disabled={busy || !reason.trim()}>{busy ? "Deleting…" : "Delete expense"}</Button>
                </>
            }>
            {expense && (
                <p style={{ marginTop: 0 }}>
                    <b>{expense.expenseType}</b> · {formatMoney(expense.expenseAmount)} · {expense.paymentMethod}
                    {expense.paymentMethod === "Cash" ? " — the amount goes back into petty cash." : "."} It moves to the{" "}
                    <b>Deleted</b> tab with your note.
                </p>
            )}
            <Field label="Reason *" htmlFor="exd-reason" hint={`${reason.length}/300`}>
                <Textarea id="exd-reason" maxLength={300} placeholder="e.g. Entered twice" value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
        </Modal>
    );
}

/* ------------------------------------------------------------------ Petty cash */
export function PettyCashModal({ open, balance, onClose, onTopUp }) {
    const [amount, setAmount] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [history, setHistory] = useState({ loading: true, rows: [], error: "" });

    const loadHistory = () => {
        setHistory((h) => ({ ...h, loading: true }));
        listPettyCashTopUps({ pageSize: 10 })
            .then((page) => setHistory({ loading: false, rows: page?.content || [], error: "" }))
            .catch((err) => setHistory({ loading: false, rows: [], error: getErrorMessage(err) }));
    };
    useEffect(() => {
        if (!open) return;
        setAmount("");
        setError("");
        loadHistory();
    }, [open]);

    const submit = async () => {
        if (!isAmount(amount)) return setError("Enter an amount above ₹0");
        setError("");
        setBusy(true);
        try {
            await onTopUp(round2(amount));
            setAmount("");
            loadHistory();
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal open={open} title="Petty cash" onClose={busy ? undefined : onClose}
            footer={<Button variant="secondary" onClick={onClose}>Done</Button>}>
            <div className="so-stat" style={{ border: "1px solid var(--so-border-light)", borderRadius: 8, marginBottom: 16 }}>
                <div className="so-stat-value">{balance == null ? "—" : formatMoney(balance)}</div>
                <div className="so-stat-label">Current balance — cash expenses are paid from this</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                <Field label="Add cash (₹)" htmlFor="pc-amount" error={error} style={{ flex: "1 1 180px" }}>
                    <Input id="pc-amount" type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} invalid={!!error}
                        onChange={(e) => setAmount(e.target.value)} />
                </Field>
                <Button onClick={submit} disabled={busy} style={{ marginTop: 25 }}>{busy ? "Adding…" : "Add to petty cash"}</Button>
            </div>
            <h3 className="so-card-title" style={{ fontSize: 14, margin: "20px 0 8px" }}>Recent top-ups</h3>
            {history.loading ? (
                <div className="so-hint">Loading…</div>
            ) : history.error ? (
                <div className="so-hint">Could not load: {history.error}</div>
            ) : history.rows.length === 0 ? (
                <EmptyState title="No top-ups yet" compact />
            ) : (
                <div className="so-list">
                    {history.rows.map((r, i) => (
                        <div className="so-list-row" key={`${r.addedAt}-${i}`}>
                            <div className="so-list-main">
                                <div className="so-list-title">{formatMoney(r.amount)}</div>
                                <div className="so-list-meta">{formatDateTime(r.addedAt)} · {r.addedByName || "—"}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Modal>
    );
}

