// The three steps of the invoice wizard: Customer · Items (one measurement tab per item) · Payment & review.
import { useEffect, useRef, useState } from "react";
import { FiPlus, FiTrash2, FiImage, FiX, FiCheck, FiLock, FiUserCheck, FiUserPlus } from "react-icons/fi";
import { lookupCustomer } from "../../../../api/invoices.js";
import { compressImage } from "../../../shared/lib/compressImage.js";
import { Field, Input, Select, Textarea } from "../../../shared/components/form.jsx";
import { Button } from "../../../shared/components/ui.jsx";
import DateField from "../../../shared/components/DateField.jsx";
import { INDIAN_STATES } from "../../../../constants/indianStates.js";
import { formatMoney, formatDate } from "../../../shared/lib/format.js";
import { todayIST } from "../../../shared/lib/period.js";
import {
    CATALOG, MAX_ITEMS, measurementFields, measurementProgress, itemNameOf, needsMeasurements, canChooseMaterial, isMaterialItem,
} from "../../lib/invoiceForm.js";

/* ================================================================== 1. Customer */
const BLANK_DETAILS = { name: "", email: "", alternatePhone: "", address: "" };

export function CustomerStep({ customer, setCustomer, customerState, setCustomerState, errors }) {
    const set = (k) => (e) => setCustomer((c) => ({ ...c, [k]: e.target.value }));
    const first = useRef(null);
    useEffect(() => first.current?.focus(), []);

    // After the 10th digit: look the number up. Found -> fill in the details (still editable; the edits update the
    // customer's record when the invoice is created). Not found -> the user types them.
    // lookup: { phone, status: "loading" | "found" | "new" | "error", invoiceCount }
    const [lookup, setLookup] = useState(null);
    const filledFor = useRef(null); // the number whose details were filled in from the lookup
    const phone = customer.phone;
    useEffect(() => {
        if (phone.length !== 10) {
            setLookup(null);
            if (filledFor.current) {
                filledFor.current = null;
                setCustomer((c) => ({ ...c, ...BLANK_DETAILS }));
            }
            return undefined;
        }
        let cancelled = false;
        setLookup({ phone, status: "loading" });
        lookupCustomer(phone)
            .then((res) => {
                if (cancelled) return;
                if (res?.found) {
                    filledFor.current = phone;
                    setCustomer((c) => ({
                        ...c,
                        name: res.name || "",
                        email: res.email || "",
                        alternatePhone: res.alternatePhone || "",
                        address: res.address || "",
                    }));
                    if (res.customerState) setCustomerState(res.customerState);
                    setLookup({ phone, status: "found", invoiceCount: res.invoiceCount || 0 });
                } else {
                    if (filledFor.current) {
                        filledFor.current = null;
                        setCustomer((c) => ({ ...c, ...BLANK_DETAILS }));
                    }
                    setLookup({ phone, status: "new" });
                }
            })
            .catch(() => !cancelled && setLookup({ phone, status: "error" }));
        return () => {
            cancelled = true;
        };
    }, [phone]); // eslint-disable-line react-hooks/exhaustive-deps

    const existing = lookup?.status === "found";
    const phoneHint =
        lookup?.status === "loading" ? (
            <span className="wz-lookup"><span className="so-spinner" aria-hidden /> Checking for an existing customer…</span>
        ) : existing ? (
            <span className="wz-lookup wz-lookup-found">
                <FiUserCheck aria-hidden /> Existing customer
                {lookup.invoiceCount ? ` · ${lookup.invoiceCount} invoice${lookup.invoiceCount === 1 ? "" : "s"}` : ""} — details filled in, edit if needed
            </span>
        ) : lookup?.status === "new" ? (
            <span className="wz-lookup"><FiUserPlus aria-hidden /> New customer — enter their details below</span>
        ) : lookup?.status === "error" ? (
            "Could not check this number — enter the details below"
        ) : (
            "10 digits — the invoice is sent here on WhatsApp"
        );
    return (
        <div className="so-form-grid">
            <Field label="WhatsApp number *" htmlFor="wz-phone" error={errors.phone} hint={phoneHint}>
                <Input ref={first} id="wz-phone" inputMode="numeric" maxLength={10} value={customer.phone} invalid={!!errors.phone}
                    autoComplete="off" onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value.replace(/\D/g, "") }))} />
            </Field>
            <Field label="Customer name *" htmlFor="wz-name" error={errors.name}>
                <Input id="wz-name" maxLength={100} value={customer.name} invalid={!!errors.name} onChange={set("name")}
                    autoComplete="off" />
            </Field>
            <Field label="Email" htmlFor="wz-email" error={errors.email} hint="Optional — a copy of the invoice is emailed">
                <Input id="wz-email" type="email" maxLength={150} value={customer.email} invalid={!!errors.email} onChange={set("email")} />
            </Field>
            <Field label="Alternate number" htmlFor="wz-alt" error={errors.alternatePhone} hint="Optional">
                <Input id="wz-alt" inputMode="numeric" maxLength={10} value={customer.alternatePhone} invalid={!!errors.alternatePhone}
                    onChange={(e) => setCustomer((c) => ({ ...c, alternatePhone: e.target.value.replace(/\D/g, "") }))} />
            </Field>
            <Field label="Address" htmlFor="wz-address" hint="Optional" style={{ gridColumn: "1 / -1" }}>
                <Textarea id="wz-address" maxLength={300} value={customer.address} onChange={set("address")} style={{ minHeight: 64 }} />
            </Field>
            <Field label="State *" htmlFor="wz-state" error={errors.customerState} hint="Decides the GST: same state CGST + SGST, other state IGST">
                <Select id="wz-state" options={INDIAN_STATES} value={customerState} onChange={(e) => setCustomerState(e.target.value)} />
            </Field>
        </div>
    );
}

/* ================================================================== 2. Items */
export function ItemsStep({ items, active, setActive, updateItem, addItem, removeItem, errors }) {
    const item = items[active];
    return (
        <div className="so-wz-items">
            <div className="so-item-tabs" role="tablist" aria-label="Items">
                {items.map((it, i) => {
                    const { filled, total } = measurementProgress(it);
                    const hasError = !!errors[it.key];
                    const name = itemNameOf(it) || it.itemName || "New item";
                    return (
                        <button
                            key={it.key}
                            type="button"
                            role="tab"
                            aria-selected={i === active}
                            className={`so-item-tab ${i === active ? "active" : ""} ${hasError ? "error" : ""}`}
                            onClick={() => setActive(i)}
                        >
                            <span className="so-item-tab-name">
                                {it.locked && <FiLock aria-hidden size={12} />} {i + 1}. {name}
                            </span>
                            <span className="so-item-tab-meta">
                                {hasError ? "Needs attention" : isMaterialItem(it) ? "Material" : total ? (
                                    <>
                                        {filled === total ? <FiCheck aria-hidden size={12} /> : null} {filled}/{total} measured
                                    </>
                                ) : (
                                    "No measurements"
                                )}
                            </span>
                        </button>
                    );
                })}
                <button type="button" className="so-item-tab so-item-tab-add" onClick={addItem} disabled={items.length >= MAX_ITEMS}>
                    <FiPlus aria-hidden /> Add item
                </button>
            </div>

            {item && (
                <ItemEditor
                    key={item.key}
                    item={item}
                    index={active}
                    canRemove={items.length > 1 && !item.locked}
                    errors={errors[item.key] || {}}
                    onChange={(patch) => updateItem(active, patch)}
                    onRemove={() => removeItem(active)}
                />
            )}
        </div>
    );
}

function ItemEditor({ item, index, canRemove, errors, onChange, onRemove }) {
    const fileRef = useRef(null);
    const name = itemNameOf(item) || item.itemName;
    const material = isMaterialItem(item);
    const fields = material ? [] : measurementFields(name);
    const locked = item.locked;
    const lineTotal = (Number(item.itemPrice) || 0) * (Number(item.itemQuantity) || 0);
    const image = item.preview || (!item.removeImage && item.imageUrl);

    const [preparing, setPreparing] = useState(false);
    const pickFile = async (e) => {
        const picked = e.target.files?.[0];
        e.target.value = "";
        if (!picked) return;
        setPreparing(true);
        const file = await compressImage(picked); // ~5 MB phone photo -> ~300 KB JPEG
        setPreparing(false);
        onChange({ file, preview: URL.createObjectURL(file), removeImage: false });
    };

    return (
        <div className="so-wz-item">
            {locked && (
                <div className="so-note" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <FiLock aria-hidden /> This item is already in production, so it can&apos;t be changed or removed.
                </div>
            )}
            <div className="so-form-grid so-form-grid-4">
                <Field label="Item *" htmlFor={`wz-item-${index}`} error={errors.itemName}>
                    <Select
                        id={`wz-item-${index}`}
                        placeholder="Choose an item"
                        options={CATALOG.includes(item.itemName) || !item.itemName ? CATALOG : [item.itemName, ...CATALOG]}
                        value={item.itemName}
                        invalid={!!errors.itemName}
                        disabled={locked}
                        onChange={(e) => onChange({ itemName: e.target.value })}
                    />
                </Field>
                {item.itemName === "Other" ? (
                    <Field label="Item name *" htmlFor={`wz-custom-${index}`} error={errors.customName}>
                        <Input id={`wz-custom-${index}`} maxLength={100} value={item.customName} disabled={locked}
                            invalid={!!errors.customName} onChange={(e) => onChange({ customName: e.target.value })} />
                    </Field>
                ) : (
                    <div className="so-hide-sm" />
                )}
                <Field label="Quantity *" htmlFor={`wz-qty-${index}`} error={errors.itemQuantity}>
                    <Input id={`wz-qty-${index}`} type="number" inputMode="decimal" min="0.01" max="1000" step="0.01"
                        value={item.itemQuantity} disabled={locked} invalid={!!errors.itemQuantity}
                        onChange={(e) => onChange({ itemQuantity: e.target.value })} />
                </Field>
                <Field label="Price per unit (₹) *" htmlFor={`wz-price-${index}`} error={errors.itemPrice}
                    hint={lineTotal ? `Line total ${formatMoney(lineTotal)}` : undefined}>
                    <Input id={`wz-price-${index}`} type="number" inputMode="decimal" min="0" step="0.01"
                        value={item.itemPrice} disabled={locked} invalid={!!errors.itemPrice}
                        onChange={(e) => onChange({ itemPrice: e.target.value })} />
                </Field>
            </div>

            {canChooseMaterial(item) && (
                <label className="so-check-row">
                    <input type="checkbox" checked={!!item.material} disabled={locked}
                        onChange={(e) => onChange({ material: e.target.checked })} />
                    <span>
                        <b>This is a material charge</b>
                        <span className="so-hint"> — cloth or other material only: no stitching or service, not given to
                            anyone, no measurements. Leave unticked for stitching or service work.</span>
                    </span>
                </label>
            )}
            {material && (
                <div className="so-note">
                    Material item: it is only charged on the invoice. It has no production steps and is ready at once.
                </div>
            )}

            {!material && (
            <div className="so-wz-image">
                {image ? (
                    <img src={image} alt="" className="so-item-img" />
                ) : (
                    <div className="so-item-img" style={{ display: "grid", placeItems: "center", color: "var(--so-muted)" }} aria-hidden>
                        <FiImage />
                    </div>
                )}
                <div className="so-actions">
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickFile} />
                    <Button variant="secondary" size="sm" disabled={locked || preparing} onClick={() => fileRef.current?.click()}>
                        {preparing ? <span className="so-spinner" aria-hidden /> : <FiImage aria-hidden />}{" "}
                        {preparing ? "Preparing photo…" : image ? "Change design photo" : "Add design photo"}
                    </Button>
                    {image && !locked && (
                        <Button variant="ghost" size="sm" onClick={() => onChange({ file: null, preview: null, removeImage: !!item.imageUrl })}>
                            <FiX aria-hidden /> Remove photo
                        </Button>
                    )}
                    {errors.file && <span className="so-field-error" style={{ marginTop: 0 }}>{errors.file}</span>}
                </div>
                {canRemove && (
                    <Button variant="ghost" size="sm" onClick={onRemove} style={{ marginLeft: "auto", color: "var(--so-danger)" }}>
                        <FiTrash2 aria-hidden /> Remove item
                    </Button>
                )}
            </div>
            )}
            {material && canRemove && (
                <div className="so-actions">
                    <Button variant="ghost" size="sm" onClick={onRemove} style={{ marginLeft: "auto", color: "var(--so-danger)" }}>
                        <FiTrash2 aria-hidden /> Remove item
                    </Button>
                </div>
            )}

            {!material && needsMeasurements(name) && fields.length > 0 && (
                <fieldset className="so-measure" disabled={locked}>
                    <legend>
                        Measurements <span className="so-hint">— {name}, leave blank what you don&apos;t need</span>
                    </legend>
                    <div className="so-measure-grid">
                        {fields.map((f) =>
                            f === "Remarks" ? (
                                <Field key={f} label="Remarks" htmlFor={`m-${index}-${f}`} style={{ gridColumn: "1 / -1" }}>
                                    <Textarea id={`m-${index}-${f}`} maxLength={300} value={item.measurements[f] || ""} style={{ minHeight: 56 }}
                                        onChange={(e) => onChange({ measurements: { ...item.measurements, [f]: e.target.value } })} />
                                </Field>
                            ) : (
                                <Field key={f} label={f} htmlFor={`m-${index}-${f}`}>
                                    <Input id={`m-${index}-${f}`} inputMode="decimal" maxLength={20} value={item.measurements[f] || ""}
                                        onChange={(e) => onChange({ measurements: { ...item.measurements, [f]: e.target.value } })} />
                                </Field>
                            ),
                        )}
                    </div>
                </fieldset>
            )}
        </div>
    );
}

/* ================================================================== 3. Payment & review */
export function PaymentStep({ payment, setPayment, methods, amounts, items, customer, customerState, errors, mode }) {
    const set = (k) => (e) => setPayment((p) => ({ ...p, [k]: e.target.value }));
    const isEdit = mode === "edit";
    return (
        <div className="so-grid so-wz-review">
            <div className="so-form-grid" style={{ alignContent: "start" }}>
                {!isEdit && (
                    <>
                        <Field label="Invoice date *" htmlFor="wz-invdate" error={errors.invoiceDate}
                            hint={payment.invoiceDate && payment.invoiceDate < todayIST()
                                ? `Back-dated invoice — dated ${formatDate(payment.invoiceDate)}`
                                : "Today. Pick an earlier date to back-date the invoice"}>
                            <DateField id="wz-invdate" max={todayIST()} value={payment.invoiceDate} invalid={!!errors.invoiceDate}
                                onChange={(v) => setPayment((p) => ({ ...p, invoiceDate: v, invoiceDateTouched: true }))} />
                        </Field>
                        <Field label="Expected delivery *" htmlFor="wz-due" error={errors.expectedDeliveryDate}>
                            <DateField id="wz-due" min={todayIST()} value={payment.expectedDeliveryDate}
                                invalid={!!errors.expectedDeliveryDate}
                                onChange={(v) => setPayment((p) => ({ ...p, expectedDeliveryDate: v }))} />
                        </Field>
                        <Field label="Discount (₹, before GST)" htmlFor="wz-discount" error={errors.discount} hint="Optional">
                            <Input id="wz-discount" type="number" inputMode="decimal" min="0" step="0.01" value={payment.discount}
                                invalid={!!errors.discount} onChange={set("discount")} />
                        </Field>
                        <Field label="Advance paid (₹)" htmlFor="wz-advance" error={errors.advancePaid} hint="Optional">
                            <Input id="wz-advance" type="number" inputMode="decimal" min="0" step="0.01" value={payment.advancePaid}
                                invalid={!!errors.advancePaid} onChange={set("advancePaid")} />
                        </Field>
                        <Field label={`Paid by${Number(payment.advancePaid) > 0 ? " *" : ""}`} htmlFor="wz-method" error={errors.paymentMethod}>
                            <Select id="wz-method" placeholder="Choose" options={methods} value={payment.paymentMethod}
                                invalid={!!errors.paymentMethod} disabled={!(Number(payment.advancePaid) > 0)} onChange={set("paymentMethod")} />
                        </Field>
                        <Field label="Transaction / UPI reference" htmlFor="wz-ref" hint="Optional" style={{ gridColumn: "1 / -1" }}>
                            <Input id="wz-ref" maxLength={100} value={payment.transactionId} disabled={!(Number(payment.advancePaid) > 0)}
                                onChange={set("transactionId")} />
                        </Field>
                        <Field label="Notes" htmlFor="wz-notes" hint="Printed on the invoice. Empty = “Thank you for your order”" style={{ gridColumn: "1 / -1" }}>
                            <Textarea id="wz-notes" maxLength={500} value={payment.notes} onChange={set("notes")} style={{ minHeight: 64 }} />
                        </Field>
                    </>
                )}
                {isEdit && (
                    <p className="so-hint" style={{ gridColumn: "1 / -1", margin: 0 }}>
                        Check the new totals. Payments already recorded stay as they are; the balance and payment status are
                        recalculated.
                    </p>
                )}
            </div>

            <aside className="so-summary">
                {!isEdit && (
                    <div style={{ marginBottom: 12 }}>
                        <div className="so-cell-main">{customer.name || "—"}</div>
                        <div className="so-cell-sub">{customer.phone} · {customerState}</div>
                        <div className="so-cell-sub">
                            Invoice date {formatDate(payment.invoiceDate || todayIST())}
                            {payment.invoiceDate && payment.invoiceDate < todayIST() ? " (back-dated)" : ""}
                        </div>
                    </div>
                )}
                <div className="so-list" style={{ marginBottom: 12 }}>
                    {items.map((it) => (
                        <div className="so-list-row" key={it.key} style={{ padding: "6px 0" }}>
                            <span className="so-list-meta" style={{ color: "var(--so-ink)" }}>
                                {itemNameOf(it) || "—"} × {Number(it.itemQuantity) || 0}
                            </span>
                            <span style={{ fontVariantNumeric: "tabular-nums" }}>
                                {formatMoney((Number(it.itemPrice) || 0) * (Number(it.itemQuantity) || 0))}
                            </span>
                        </div>
                    ))}
                </div>
                <dl className="so-dl">
                    <dt>Items total</dt>
                    <dd>{formatMoney(amounts.total)}</dd>
                    {amounts.discount > 0 && (
                        <>
                            <dt>Discount</dt>
                            <dd>− {formatMoney(amounts.discount)}</dd>
                        </>
                    )}
                    {amounts.intra ? (
                        <>
                            <dt>CGST 2.5%</dt>
                            <dd>{formatMoney(amounts.cgst)}</dd>
                            <dt>SGST 2.5%</dt>
                            <dd>{formatMoney(amounts.sgst)}</dd>
                        </>
                    ) : (
                        <>
                            <dt>IGST 5%</dt>
                            <dd>{formatMoney(amounts.igst)}</dd>
                        </>
                    )}
                    <dt className="so-dl-total">Total</dt>
                    <dd className="so-dl-total">{formatMoney(amounts.withGst)}</dd>
                    {!isEdit && (
                        <>
                            <dt>Advance</dt>
                            <dd>{formatMoney(amounts.advance)}</dd>
                            <dt style={{ fontWeight: 600, color: "var(--so-primary)" }}>Balance due</dt>
                            <dd style={{ fontWeight: 600 }}>{formatMoney(amounts.balance)}</dd>
                        </>
                    )}
                </dl>
                <p className="so-hint" style={{ marginBottom: 0 }}>Preview — the server calculates the final amounts.</p>
            </aside>
        </div>
    );
}
