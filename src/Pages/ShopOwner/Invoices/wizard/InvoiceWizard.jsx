// Create-invoice wizard (centered modal, 3 steps) — also edits the items of an existing invoice (mode="edit").
// Create: Customer → Items → Payment & review → POST /invoices (multipart). A draft (without photos) is kept in
// localStorage until the invoice is created or discarded.
// Edit:   Items → Review → PATCH /invoices/{id} with the complete item list (items in production are locked).
import { useEffect, useMemo, useState } from "react";
import { FiArrowLeft, FiArrowRight, FiCheckCircle, FiFileText } from "react-icons/fi";
import { Modal, Button } from "../../../shared/components/ui.jsx";
import { CustomerStep, ItemsStep, PaymentStep } from "./WizardSteps.jsx";
import { createInvoice, editInvoiceWithImages, openInvoicePdf } from "../../../../api/invoices.js";
import { getPaymentMethods } from "../../../../api/reference.js";
import { getErrorMessage } from "../../../LoginPages/axios.js";
import { toast } from "../../../../utils/toast.js";
import { formatMoney, parseDueDate } from "../../../shared/lib/format.js";
import { todayIST } from "../../../shared/lib/period.js";
import { isConflict } from "../../../shared/lib/invoice.js";
import {
    newItem, itemNameOf, isMaterialItem, cleanMeasurements, previewAmounts, isQuantity, isPrice, isPhone, isEmail,
    DEFAULT_SHOP_STATE, MAX_IMAGE_BYTES,
} from "../../lib/invoiceForm.js";

const DRAFT_KEY = "so.invoiceDraft.v1";
const EMPTY_CUSTOMER = { name: "", phone: "", email: "", alternatePhone: "", address: "" };
// invoiceDate is pre-filled with today; invoiceDateTouched = the user picked a date themselves.
const emptyPayment = () => ({
    invoiceDate: todayIST(), invoiceDateTouched: false,
    expectedDeliveryDate: "", discount: "", advancePaid: "", paymentMethod: "", transactionId: "", notes: "",
});

/** Draft payment: an untouched (pre-filled) invoice date is reset to today, so an old draft is not back-dated. */
const restorePayment = (saved) => {
    const p = { ...emptyPayment(), ...(saved || {}) };
    delete p.isBackDate;
    delete p.backDate;
    if (!p.invoiceDateTouched || !p.invoiceDate || p.invoiceDate > todayIST()) {
        p.invoiceDate = todayIST();
        p.invoiceDateTouched = false;
    }
    return p;
};

const readDraft = () => {
    try {
        const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
        return d && Array.isArray(d.items) && d.items.length ? d : null;
    } catch {
        return null;
    }
};
const writeDraft = (draft) => {
    try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
        /* storage full / blocked: the draft is a convenience only */
    }
};
const clearDraft = () => {
    try {
        localStorage.removeItem(DRAFT_KEY);
    } catch {
        /* ignore */
    }
};

// Same rule as the backend (InvoiceWriteServiceImpl.inProduction / ItemKind.startStatus): assigned to someone, or moved
// past its start status (a material starts ORDER_COMPLETED; old, unflagged Lining Material items started in CUTTING).
const START_IN_CUTTING = ["Embroidery", "Lining Material", "Saree Fall", "Saree Pico", "Designing"];
const startStatus = (it) =>
    it.material ? "ORDER_COMPLETED" : START_IN_CUTTING.includes((it.itemName || "").trim()) ? "CUTTING" : "ORDER_ACCEPTED";
const inProduction = (it) =>
    !!(it.assignedTo || "").trim() ||
    !!(it.assignedToWhichShopAssistant || "").trim() ||
    startStatus(it) !== it.itemOrderStatus;

/** Existing invoice items -> wizard items (catalog names kept; unknown names shown as-is). */
const fromInvoiceItems = (items = []) =>
    items.map((it) => ({
        ...newItem(it.itemName),
        key: it.itemUniqueId,
        itemUniqueId: it.itemUniqueId,
        itemName: it.itemName,
        itemQuantity: String(it.itemQuantity ?? ""),
        itemPrice: String(it.itemPrice ?? ""),
        measurements: { ...(it.measurements || {}) },
        imageUrl: it.imageUrl || null,
        material: !!it.material,
        locked: inProduction(it),
        original: { itemName: it.itemName, itemQuantity: it.itemQuantity, itemPrice: it.itemPrice },
    }));

export default function InvoiceWizard({ open, mode = "create", invoice, onClose, onDone }) {
    const isEdit = mode === "edit";
    const steps = isEdit ? ["Items", "Review"] : ["Customer", "Items", "Payment & review"];

    const [step, setStep] = useState(0);
    const [customer, setCustomer] = useState(EMPTY_CUSTOMER);
    const [customerState, setCustomerState] = useState(DEFAULT_SHOP_STATE);
    const [items, setItems] = useState([newItem()]);
    const [active, setActive] = useState(0);
    const [payment, setPayment] = useState(emptyPayment);
    const [errors, setErrors] = useState({});
    const [methods, setMethods] = useState([]);
    const [busy, setBusy] = useState(false);
    const [created, setCreated] = useState(null);
    const [restored, setRestored] = useState(false);

    // (Re)initialise on open.
    useEffect(() => {
        if (!open) return;
        setStep(0);
        setErrors({});
        setCreated(null);
        setActive(0);
        if (isEdit) {
            setItems(fromInvoiceItems(invoice?.items));
            setPayment(emptyPayment());
            setRestored(false);
        } else {
            const d = readDraft();
            setCustomer(d?.customer || EMPTY_CUSTOMER);
            setCustomerState(d?.customerState || DEFAULT_SHOP_STATE);
            setItems(d ? d.items.map((it) => ({ ...newItem(), ...it, file: null, preview: null })) : [newItem()]);
            setPayment(restorePayment(d?.payment));
            setRestored(!!d);
        }
        getPaymentMethods().then(setMethods);
    }, [open, isEdit, invoice]);

    // Keep the draft (create mode, before success). Photos are not stored.
    useEffect(() => {
        if (!open || isEdit || created) return;
        const t = setTimeout(
            () => writeDraft({ customer, customerState, payment, items: items.map(({ file, preview, ...rest }) => rest) }), // eslint-disable-line no-unused-vars
            400,
        );
        return () => clearTimeout(t);
    }, [open, isEdit, created, customer, customerState, payment, items]);

    const amounts = useMemo(
        () =>
            previewAmounts(items, {
                discount: isEdit ? invoice?.discount : payment.discount,
                advancePaid: isEdit ? 0 : payment.advancePaid,
                customerState: isEdit ? invoice?.customerState || DEFAULT_SHOP_STATE : customerState,
            }),
        [items, payment.discount, payment.advancePaid, customerState, isEdit, invoice],
    );

    // ---- item list editing
    const updateItem = (index, patch) => {
        setItems((list) => list.map((it, i) => (i === index ? { ...it, ...patch } : it)));
        setErrors((e) => {
            const key = items[index]?.key;
            if (!key || !e[key]) return e;
            const rest = { ...e };
            delete rest[key];
            return rest;
        });
    };
    const addItem = () => {
        setItems((list) => [...list, newItem()]);
        setActive(items.length);
    };
    const removeItem = (index) => {
        setItems((list) => list.filter((_, i) => i !== index));
        setActive((a) => Math.max(0, a >= index ? a - 1 : a));
    };

    // ---- validation per step (mirrors the backend rules)
    const validateCustomer = () => {
        const e = {};
        if (!customer.name.trim()) e.name = "Enter the customer's name";
        if (!isPhone(customer.phone)) e.phone = "Enter a 10-digit WhatsApp number";
        if (customer.email.trim() && !isEmail(customer.email)) e.email = "Enter a valid email";
        if (customer.alternatePhone.trim() && !isPhone(customer.alternatePhone)) e.alternatePhone = "Enter 10 digits or leave empty";
        if (!customerState) e.customerState = "Choose the state";
        return e;
    };
    const validateItems = () => {
        const e = {};
        items.forEach((it) => {
            if (it.locked) return;
            const ie = {};
            if (!it.itemName) ie.itemName = "Choose an item";
            if (it.itemName === "Other" && !it.customName.trim()) ie.customName = "Type the item name";
            if (!isQuantity(it.itemQuantity)) ie.itemQuantity = "0.01 to 1000, up to 2 decimals";
            if (!isPrice(it.itemPrice)) ie.itemPrice = "Enter a price (₹0 or more, up to 2 decimals)";
            if (it.file && it.file.size > MAX_IMAGE_BYTES) ie.file = "Photo must be 10 MB or smaller";
            if (it.file && !String(it.file.type).startsWith("image/")) ie.file = "Choose an image file";
            if (Object.keys(ie).length) e[it.key] = ie;
        });
        return e;
    };
    const validatePayment = () => {
        const e = {};
        if (!payment.expectedDeliveryDate) e.expectedDeliveryDate = "Choose the delivery date";
        const discount = Number(payment.discount || 0);
        const advance = Number(payment.advancePaid || 0);
        if (payment.discount !== "" && !isPrice(payment.discount)) e.discount = "Enter a valid amount";
        else if (discount > amounts.total) e.discount = `At most the items total, ${formatMoney(amounts.total)}`;
        if (payment.advancePaid !== "" && !isPrice(payment.advancePaid)) e.advancePaid = "Enter a valid amount";
        else if (advance > amounts.withGst) e.advancePaid = `At most the total, ${formatMoney(amounts.withGst)}`;
        if (advance > 0 && !payment.paymentMethod) e.paymentMethod = "Choose how the advance was paid";
        if (!payment.invoiceDate) e.invoiceDate = "Choose the invoice date";
        else if (payment.invoiceDate > todayIST()) e.invoiceDate = "Can't be in the future";
        return e;
    };

    const stepName = steps[step];
    const next = () => {
        let e = {};
        if (stepName === "Customer") e = validateCustomer();
        if (stepName === "Items") {
            e = validateItems();
            const firstBad = items.findIndex((it) => e[it.key]);
            if (firstBad >= 0) setActive(firstBad);
        }
        setErrors(e);
        if (!Object.keys(e).length) setStep((s) => Math.min(s + 1, steps.length - 1));
    };
    const back = () => {
        setErrors({});
        setStep((s) => Math.max(0, s - 1));
    };

    // ---- submit
    const itemJson = (it) => {
        const material = isMaterialItem(it);
        return {
            itemName: itemNameOf(it),
            itemQuantity: Number(Number(it.itemQuantity).toFixed(2)),
            itemPrice: Number(Number(it.itemPrice).toFixed(2)),
            measurements: material ? {} : cleanMeasurements(it.measurements),
            material,
        };
    };
    // a material item has no design photo
    const images = () => items.map((it, index) => (it.file && !isMaterialItem(it) ? { index, file: it.file } : null)).filter(Boolean);

    const submitCreate = async () => {
        const e = validatePayment();
        setErrors(e);
        if (Object.keys(e).length) return;
        const advance = Number(payment.advancePaid || 0);
        const body = {
            customer: {
                name: customer.name.trim(),
                phone: customer.phone.trim(),
                ...(customer.email.trim() ? { email: customer.email.trim() } : {}),
                ...(customer.alternatePhone.trim() ? { alternatePhone: customer.alternatePhone.trim() } : {}),
                ...(customer.address.trim() ? { address: customer.address.trim() } : {}),
            },
            customerState,
            items: items.map(itemJson),
            totalAmount: amounts.total,
            discount: Number(payment.discount || 0),
            advancePaid: advance,
            ...(advance > 0 ? { paymentMethod: payment.paymentMethod } : {}),
            ...(advance > 0 && payment.transactionId.trim() ? { transactionId: payment.transactionId.trim() } : {}),
            expectedDeliveryDate: payment.expectedDeliveryDate,
            notes: payment.notes.trim(),
            // Today = not back-dated (the invoice keeps the current time); an earlier day = back-dated (00:00 IST).
            ...(payment.invoiceDate < todayIST() ? { isBackDate: true, backDate: payment.invoiceDate } : { isBackDate: false }),
        };
        setBusy(true);
        try {
            const inv = await createInvoice(body, images());
            clearDraft();
            setCreated(inv);
            onDone?.(inv);
        } catch (err) {
            toast.error("Could not create the invoice", getErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const submitEdit = async () => {
        const body = {
            items: items.map((it) =>
                it.locked
                    ? // In production: sent back exactly as stored (measurements omitted = kept).
                      { itemUniqueId: it.itemUniqueId, ...it.original }
                    : {
                          ...(it.itemUniqueId ? { itemUniqueId: it.itemUniqueId } : {}),
                          ...itemJson(it),
                          ...((it.removeImage && !it.file) || (isMaterialItem(it) && it.imageUrl) ? { removeImage: true } : {}),
                      },
            ),
        };
        setBusy(true);
        try {
            const inv = await editInvoiceWithImages(invoice.invoiceId, body, images());
            toast.success("Items updated");
            onDone?.(inv);
            onClose();
        } catch (err) {
            if (isConflict(err)) {
                toast.warning("This invoice just changed", "Close this window and open Edit items again.");
            } else {
                toast.error("Could not save the items", getErrorMessage(err));
            }
        } finally {
            setBusy(false);
        }
    };

    const startOver = () => {
        clearDraft();
        setCustomer(EMPTY_CUSTOMER);
        setCustomerState(DEFAULT_SHOP_STATE);
        setItems([newItem()]);
        setPayment(emptyPayment());
        setActive(0);
        setStep(0);
        setErrors({});
        setRestored(false);
    };

    const last = step === steps.length - 1;
    const title = created ? "Invoice created" : isEdit ? `Edit items · ${invoice?.invoiceId || ""}` : "New invoice";

    return (
        <Modal
            open={open}
            size="lg"
            title={title}
            onClose={busy ? undefined : onClose}
            footer={
                created ? null : (
                    <div className="so-wz-foot">
                        <span className="so-hint">
                            {formatMoney(amounts.withGst)} total · {items.length} item{items.length === 1 ? "" : "s"}
                        </span>
                        <div className="so-actions">
                            {step > 0 && (
                                <Button variant="secondary" onClick={back} disabled={busy}>
                                    <FiArrowLeft aria-hidden /> Back
                                </Button>
                            )}
                            {!last ? (
                                <Button onClick={next}>
                                    Next <FiArrowRight aria-hidden />
                                </Button>
                            ) : (
                                <Button onClick={isEdit ? submitEdit : submitCreate} disabled={busy}>
                                    {busy ? "Saving…" : isEdit ? "Save items" : "Create invoice"}
                                </Button>
                            )}
                        </div>
                    </div>
                )
            }
        >
            {created ? (
                <CreatedPanel invoice={created} onClose={onClose} onAnother={startOver} onCreatedReset={() => setCreated(null)} />
            ) : (
                <>
                    <ol className="so-steps" aria-label="Steps">
                        {steps.map((s, i) => (
                            <li key={s} className={i === step ? "current" : i < step ? "done" : ""} aria-current={i === step ? "step" : undefined}>
                                <span className="so-step-num">{i < step ? "✓" : i + 1}</span>
                                <span className="so-step-label">{s}</span>
                            </li>
                        ))}
                    </ol>

                    {restored && step === 0 && !isEdit && (
                        <div className="so-note" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 16 }}>
                            <span>Your unfinished invoice was restored (design photos need to be added again).</span>
                            <Button variant="ghost" size="sm" onClick={startOver}>
                                Start over
                            </Button>
                        </div>
                    )}

                    {stepName === "Customer" && (
                        <CustomerStep customer={customer} setCustomer={setCustomer} customerState={customerState}
                            setCustomerState={setCustomerState} errors={errors} />
                    )}
                    {stepName === "Items" && (
                        <ItemsStep items={items} active={Math.min(active, items.length - 1)} setActive={setActive}
                            updateItem={updateItem} addItem={addItem} removeItem={removeItem} errors={errors} />
                    )}
                    {(stepName === "Payment & review" || stepName === "Review") && (
                        <PaymentStep payment={payment} setPayment={setPayment} methods={methods} amounts={amounts} items={items}
                            customer={customer} customerState={customerState} errors={errors} mode={mode} />
                    )}
                </>
            )}
        </Modal>
    );
}

function CreatedPanel({ invoice, onClose, onAnother, onCreatedReset }) {
    const openPdf = () => openInvoicePdf(invoice.invoiceId).catch((err) => toast.error("Could not open the PDF", getErrorMessage(err)));
    const due = parseDueDate(invoice.expectedDeliveryDate);
    return (
        <div className="so-empty" style={{ padding: "24px 8px" }}>
            <FiCheckCircle size={40} style={{ color: "var(--so-success)", marginBottom: 12 }} aria-hidden />
            <div className="so-empty-title" style={{ fontSize: 18 }}>
                <span className="so-mono" style={{ fontSize: 16 }}>{invoice.invoiceId}</span>
            </div>
            <div>
                {invoice.customer?.name} · {formatMoney(invoice.totalAmountWithGST)} · balance {formatMoney(invoice.balanceDue)}
                {due ? ` · due ${due}` : ""}
            </div>
            <div className="so-hint" style={{ marginTop: 6 }}>
                WhatsApp: {invoice.notifications?.whatsApp || "—"} · Email: {invoice.notifications?.email || "—"}
            </div>
            <div className="so-actions" style={{ justifyContent: "center", marginTop: 20 }}>
                <Button variant="secondary" onClick={openPdf}>
                    <FiFileText aria-hidden /> Invoice PDF
                </Button>
                <Button variant="secondary" onClick={() => { onCreatedReset(); onAnother(); }}>
                    Create another
                </Button>
                <Button onClick={() => onClose(invoice)}>Open invoice</Button>
            </div>
        </div>
    );
}

