// Platform owner admin popups: one form popup driven by a field list (add / edit branch, shop owner details,
// petty cash top-up, new / edit staff), plus "add existing staff" and "move to another branch".
import { useEffect, useState } from "react";
import { Modal, Button, EmptyState, ErrorBox } from "../../shared/components/ui.jsx";
import { Field, Input, Select, Textarea } from "../../shared/components/form.jsx";
import { listUnassignedUsers } from "../../../api/owner.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { humanize } from "../../shared/lib/format.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\d{10}$/;
const PASSWORD = /^(?=.*[A-Za-z])(?=.*\d).{8,100}$/;

/** Field checks shared by the forms; returns a message or "". */
const check = (f, value) => {
    const v = typeof value === "string" ? value.trim() : value;
    if (f.required && (v === "" || v === undefined || v === null)) return `${f.label} is required`;
    if (v === "" || v === undefined || v === null) return "";
    if (f.type === "email" && !EMAIL.test(v)) return "Enter a valid email";
    if (f.type === "phone" && !PHONE.test(v)) return "Enter a 10-digit phone number";
    if (f.type === "password" && !PASSWORD.test(v)) return "8+ characters with a letter and a digit";
    if (f.type === "money" && (Number.isNaN(Number(v)) || Number(v) < (f.min ?? 0))) return f.min > 0 ? `Enter an amount above ${f.min - 0.01}` : "Enter 0 or more";
    return "";
};

/**
 * Form popup.
 * fields: [{name, label, type: text|email|phone|password|money|select|textarea, required, options, hint, min}]
 * onSubmit(values) -> Promise (only changed fields when `changedOnly`); errors from the backend are shown on top.
 */
export function FormModal({ open, title, fields, initial = {}, submitLabel = "Save", changedOnly = false, onClose, onSubmit, intro }) {
    const [values, setValues] = useState({});
    const [errors, setErrors] = useState({});
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        if (open) {
            setValues(Object.fromEntries(fields.map((f) => [f.name, initial[f.name] ?? ""])));
            setErrors({});
            setError("");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const set = (name, value) => setValues((v) => ({ ...v, [name]: value }));
    const submit = async (e) => {
        e.preventDefault();
        const found = Object.fromEntries(fields.map((f) => [f.name, check(f, values[f.name])]).filter(([, m]) => m));
        setErrors(found);
        if (Object.keys(found).length) return;
        const out = {};
        fields.forEach((f) => {
            let v = values[f.name];
            if (typeof v === "string") v = v.trim();
            if (f.type === "money") v = v === "" ? undefined : Number(v);
            if (v === "" || v === undefined) return;
            if (changedOnly && String(v) === String(initial[f.name] ?? "")) return;
            out[f.name] = v;
        });
        if (changedOnly && !Object.keys(out).length) {
            setError("Nothing changed.");
            return;
        }
        setBusy(true);
        setError("");
        try {
            await onSubmit(out);
        } catch (err) {
            setError(getErrorMessage(err, "Could not save."));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal open={open} title={title} onClose={busy ? undefined : onClose}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
                    <Button type="submit" form="ow-form" disabled={busy}>{busy ? "Saving…" : submitLabel}</Button>
                </>
            }>
            <form id="ow-form" onSubmit={submit} noValidate className="ow-form">
                {intro && <p className="so-hint" style={{ marginTop: 0 }}>{intro}</p>}
                {error && <div className="so-error-box" role="alert" style={{ marginBottom: 12, whiteSpace: "pre-line" }}>{error}</div>}
                {fields.map((f) => (
                    <Field key={f.name} label={`${f.label}${f.required ? " *" : ""}`} htmlFor={`ow-${f.name}`} error={errors[f.name]} hint={f.hint}
                        style={f.wide || f.type === "textarea" ? { gridColumn: "1 / -1" } : undefined}>
                        {f.type === "select" ? (
                            <Select id={`ow-${f.name}`} options={f.options} value={values[f.name] ?? ""} placeholder={f.placeholder ?? "Choose…"}
                                invalid={!!errors[f.name]} onChange={(e) => set(f.name, e.target.value)} />
                        ) : f.type === "textarea" ? (
                            <Textarea id={`ow-${f.name}`} rows={2} value={values[f.name] ?? ""} invalid={!!errors[f.name]} onChange={(e) => set(f.name, e.target.value)} />
                        ) : (
                            <Input id={`ow-${f.name}`} value={values[f.name] ?? ""} invalid={!!errors[f.name]}
                                type={f.type === "password" ? "password" : f.type === "email" ? "email" : "text"}
                                inputMode={f.type === "money" ? "decimal" : f.type === "phone" ? "numeric" : undefined}
                                autoComplete={f.type === "password" ? "new-password" : "off"}
                                onChange={(e) => set(f.name, e.target.value)} />
                        )}
                    </Field>
                ))}
            </form>
        </Modal>
    );
}

/** Staff accounts that work in no branch -> add one to this branch. */
export function AddExistingModal({ open, branchName, onClose, onAdd }) {
    const [state, setState] = useState({ loading: true, list: [], error: "" });
    const [busyId, setBusyId] = useState("");
    const load = () => {
        setState({ loading: true, list: [], error: "" });
        listUnassignedUsers()
            .then((list) => setState({ loading: false, list, error: "" }))
            .catch((err) => setState({ loading: false, list: [], error: getErrorMessage(err, "Could not load staff") }));
    };
    useEffect(() => {
        if (open) load();
    }, [open]);
    const add = async (p) => {
        setBusyId(p.userId);
        try {
            await onAdd(p);
            setState((s) => ({ ...s, list: s.list.filter((x) => x.userId !== p.userId) }));
        } finally {
            setBusyId("");
        }
    };
    return (
        <Modal open={open} title={`Add existing staff to ${branchName}`} onClose={busyId ? undefined : onClose}
            footer={<Button variant="secondary" onClick={onClose}>Done</Button>}>
            <p className="so-hint" style={{ marginTop: 0 }}>Staff accounts that don&apos;t work in any branch. To move someone from another branch, use “Move” on their row there.</p>
            {state.error ? <ErrorBox message={state.error} onRetry={load} />
                : state.loading ? <div className="so-hint">Loading…</div>
                : !state.list.length ? <EmptyState compact title="No unassigned staff" message="Create a new account with “New staff”." />
                : (
                    <div className="so-list">
                        {state.list.map((p) => (
                            <div className="so-list-row" key={p.userId}>
                                <div className="so-list-main">
                                    <div className="so-list-title">{p.name}</div>
                                    <div className="so-list-meta">{(p.roles || []).map(humanize).join(", ")} · {p.email}{p.phone ? ` · ${p.phone}` : ""}</div>
                                </div>
                                <Button size="sm" disabled={!!busyId} onClick={() => add(p)}>{busyId === p.userId ? "Adding…" : "Add"}</Button>
                            </div>
                        ))}
                    </div>
                )}
        </Modal>
    );
}
