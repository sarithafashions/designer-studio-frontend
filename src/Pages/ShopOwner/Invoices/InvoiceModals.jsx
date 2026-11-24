// Modals of the invoice detail page: record payment, discount, assign worker, edit details, delete.
import { useEffect, useState } from "react";
import { Modal, Button } from "../../shared/components/ui.jsx";
import { Field, Input, Select, Textarea } from "../../shared/components/form.jsx";
import DateField from "../../shared/components/DateField.jsx";
import { getPaymentMethods } from "../../../api/reference.js";
import { listAssignableTailors, listAssignableShopAssistants } from "../../../api/production.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { formatMoney, parseDueDate } from "../../shared/lib/format.js";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/* ------------------------------------------------------------------ Record payment */
export function PaymentModal({ open, balanceDue, onClose, onSubmit }) {
    const [methods, setMethods] = useState([]);
    const [form, setForm] = useState({ amount: "", paymentMethod: "", transactionId: "" });
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) return;
        setForm({ amount: String(round2(balanceDue)), paymentMethod: "", transactionId: "" });
        setErrors({});
        getPaymentMethods().then((list) => {
            setMethods(list);
            setForm((f) => ({ ...f, paymentMethod: f.paymentMethod || list[0] || "" }));
        });
    }, [open, balanceDue]);

    const submit = async () => {
        const amount = Number(form.amount);
        const e = {};
        if (!(amount > 0)) e.amount = "Enter an amount above ₹0";
        else if (amount > round2(balanceDue) + 0.001) e.amount = `At most the balance, ${formatMoney(balanceDue)}`;
        if (!form.paymentMethod) e.paymentMethod = "Choose how it was paid";
        setErrors(e);
        if (Object.keys(e).length) return;
        setBusy(true);
        try {
            await onSubmit({
                amount: round2(amount),
                paymentMethod: form.paymentMethod,
                ...(form.transactionId.trim() ? { transactionId: form.transactionId.trim() } : {}),
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            open={open}
            title="Record a payment"
            onClose={busy ? undefined : onClose}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button onClick={submit} disabled={busy}>
                        {busy ? "Saving…" : "Record payment"}
                    </Button>
                </>
            }
        >
            <div className="so-form-grid">
                <Field label="Amount (₹)" htmlFor="pay-amount" error={errors.amount} hint={`Balance due ${formatMoney(balanceDue)}`}>
                    <Input
                        id="pay-amount"
                        type="number"
                        inputMode="decimal"
                        min="0.01"
                        step="0.01"
                        value={form.amount}
                        invalid={!!errors.amount}
                        onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    />
                </Field>
                <Field label="Paid by" htmlFor="pay-method" error={errors.paymentMethod}>
                    <Select
                        id="pay-method"
                        options={methods}
                        value={form.paymentMethod}
                        invalid={!!errors.paymentMethod}
                        onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                    />
                </Field>
                <Field label="Transaction / UPI reference" htmlFor="pay-ref" hint="Optional" style={{ gridColumn: "1 / -1" }}>
                    <Input
                        id="pay-ref"
                        maxLength={100}
                        value={form.transactionId}
                        onChange={(e) => setForm((f) => ({ ...f, transactionId: e.target.value }))}
                    />
                </Field>
            </div>
            <p className="so-hint" style={{ marginTop: 14 }}>
                A payment receipt is created for every payment. The final receipt is generated at delivery, once the invoice is
                fully paid and every item is completed.
            </p>
        </Modal>
    );
}

/* ------------------------------------------------------------------ Discount */
export function DiscountModal({ open, currentDiscount, taxableAmount, onClose, onSubmit }) {
    const [amount, setAmount] = useState("");
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (open) {
            setAmount("");
            setReason("");
            setError("");
        }
    }, [open]);

    const submit = async () => {
        const n = Number(amount);
        if (!(n > 0)) return setError("Enter an amount above ₹0");
        setError("");
        setBusy(true);
        try {
            await onSubmit({ amount: round2(n), ...(reason.trim() ? { reason: reason.trim() } : {}) });
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            open={open}
            title="Give a discount"
            onClose={busy ? undefined : onClose}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button onClick={submit} disabled={busy}>
                        {busy ? "Saving…" : "Apply discount"}
                    </Button>
                </>
            }
        >
            <div className="so-form-grid">
                <Field
                    label="Discount (₹, before GST)"
                    htmlFor="disc-amount"
                    error={error}
                    hint={`Current discount ${formatMoney(currentDiscount)} · taxable ${formatMoney(taxableAmount)}`}
                    style={{ gridColumn: "1 / -1" }}
                >
                    <Input
                        id="disc-amount"
                        type="number"
                        inputMode="decimal"
                        min="0.01"
                        step="0.01"
                        value={amount}
                        invalid={!!error}
                        onChange={(e) => setAmount(e.target.value)}
                    />
                </Field>
                <Field label="Reason" htmlFor="disc-reason" hint="Optional, up to 200 characters" style={{ gridColumn: "1 / -1" }}>
                    <Input id="disc-reason" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
                </Field>
            </div>
            <p className="so-hint" style={{ marginTop: 14 }}>GST, the total and the balance are recalculated.</p>
        </Modal>
    );
}

/* ------------------------------------------------------------------ Assign tailor / shop assistant */
export function AssignModal({ open, kind, itemName, currentId, onClose, onSubmit }) {
    const isTailor = kind === "tailor";
    const [people, setPeople] = useState({ loading: true, list: [], error: "" });
    const [selected, setSelected] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) return;
        setSelected("");
        setPeople({ loading: true, list: [], error: "" });
        (isTailor ? listAssignableTailors() : listAssignableShopAssistants())
            .then((list) => setPeople({ loading: false, list, error: "" }))
            .catch((err) => setPeople({ loading: false, list: [], error: getErrorMessage(err, "Could not load the list") }));
    }, [open, isTailor]);

    const options = people.list
        .filter((p) => p.userId !== currentId)
        .map((p) => ({ value: p.userId, label: p.name || p.userId }));

    const submit = async () => {
        if (!selected) return;
        setBusy(true);
        try {
            await onSubmit(selected);
        } finally {
            setBusy(false);
        }
    };

    const role = isTailor ? "tailor" : "shop assistant";
    return (
        <Modal
            open={open}
            title={`${currentId ? "Re-assign" : "Assign"} ${role}`}
            onClose={busy ? undefined : onClose}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button onClick={submit} disabled={busy || !selected}>
                        {busy ? "Saving…" : "Assign"}
                    </Button>
                </>
            }
        >
            <Field
                label={`${isTailor ? "Tailor" : "Shop assistant"} for ${itemName}`}
                htmlFor="assign-person"
                error={people.error}
                hint={!people.loading && !people.error && options.length === 0 ? `No other ${role}s in this shop` : undefined}
            >
                <Select
                    id="assign-person"
                    placeholder={people.loading ? "Loading…" : `Choose a ${role}`}
                    options={options}
                    value={selected}
                    disabled={people.loading}
                    onChange={(e) => setSelected(e.target.value)}
                />
            </Field>
        </Modal>
    );
}

/* ------------------------------------------------------------------ Edit details */
export function EditDetailsModal({ open, invoice, onClose, onSubmit }) {
    const locked = !!invoice?.receiptNo; // after delivery only the customer can be corrected
    const [form, setForm] = useState({});
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open || !invoice) return;
        setForm({
            expectedDeliveryDate: parseDueDate(invoice.expectedDeliveryDate) || "",
            notes: invoice.notes || "",
            name: invoice.customer?.name || "",
            phone: invoice.customer?.phone || "",
            email: invoice.customer?.email || "",
        });
        setErrors({});
    }, [open, invoice]);

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const submit = async () => {
        const e = {};
        if (!form.name.trim()) e.name = "Enter the customer's name";
        if (!/^\d{10}$/.test(form.phone.trim())) e.phone = "Enter a 10-digit mobile number";
        if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "Enter a valid email";
        setErrors(e);
        if (Object.keys(e).length) return;

        // Send only what changed.
        const changes = {};
        const customer = {};
        const c = invoice.customer || {};
        if (form.name.trim() !== (c.name || "")) customer.name = form.name.trim();
        if (form.phone.trim() !== (c.phone || "")) customer.phone = form.phone.trim();
        if (form.email.trim() !== (c.email || "")) customer.email = form.email.trim();
        if (Object.keys(customer).length) changes.customer = customer;
        if (!locked) {
            if (form.expectedDeliveryDate && form.expectedDeliveryDate !== parseDueDate(invoice.expectedDeliveryDate)) {
                changes.expectedDeliveryDate = form.expectedDeliveryDate;
            }
            if (form.notes !== (invoice.notes || "")) changes.notes = form.notes;
        }
        if (!Object.keys(changes).length) return onClose();
        setBusy(true);
        try {
            await onSubmit(changes);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            open={open}
            title="Edit invoice details"
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
                <Field label="Customer name" htmlFor="ed-name" error={errors.name}>
                    <Input id="ed-name" maxLength={100} value={form.name || ""} invalid={!!errors.name} onChange={set("name")} />
                </Field>
                <Field label="Mobile number" htmlFor="ed-phone" error={errors.phone}>
                    <Input id="ed-phone" inputMode="numeric" maxLength={10} value={form.phone || ""} invalid={!!errors.phone} onChange={set("phone")} />
                </Field>
                <Field label="Email" htmlFor="ed-email" error={errors.email} hint="Optional" style={{ gridColumn: "1 / -1" }}>
                    <Input id="ed-email" type="email" maxLength={150} value={form.email || ""} invalid={!!errors.email} onChange={set("email")} />
                </Field>
                <Field
                    label="Expected delivery"
                    htmlFor="ed-due"
                    hint={locked ? "Delivered — can no longer change" : undefined}
                >
                    <DateField id="ed-due" value={form.expectedDeliveryDate || ""} disabled={locked}
                        onChange={(v) => setForm((f) => ({ ...f, expectedDeliveryDate: v }))} />
                </Field>
                <div />
                <Field
                    label="Notes"
                    htmlFor="ed-notes"
                    hint={locked ? "Delivered — can no longer change" : "Leave empty for the default “Thank you for your order”"}
                    style={{ gridColumn: "1 / -1" }}
                >
                    <Textarea id="ed-notes" maxLength={500} value={form.notes || ""} disabled={locked} onChange={set("notes")} />
                </Field>
            </div>
            <p className="so-hint" style={{ marginTop: 14 }}>
                Customer changes update the customer record, so all their invoices and receipts show the new details. Items are
                changed with "Edit items".
            </p>
        </Modal>
    );
}

/* ------------------------------------------------------------------ Delete */
export function DeleteModal({ open, invoiceId, onClose, onSubmit }) {
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
        <Modal
            open={open}
            title="Delete this invoice?"
            onClose={busy ? undefined : onClose}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={busy}>
                        Keep invoice
                    </Button>
                    <Button variant="danger" onClick={submit} disabled={busy || !reason.trim()}>
                        {busy ? "Deleting…" : "Delete invoice"}
                    </Button>
                </>
            }
        >
            <p style={{ marginTop: 0 }}>
                <span className="so-mono">{invoiceId}</span> moves to the <b>Deleted</b> tab with your note. It can&apos;t be
                restored.
            </p>
            <Field label="Reason" htmlFor="del-reason" hint={`${reason.length}/300`}>
                <Textarea
                    id="del-reason"
                    maxLength={300}
                    placeholder="e.g. Customer cancelled the order"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                />
            </Field>
        </Modal>
    );
}
