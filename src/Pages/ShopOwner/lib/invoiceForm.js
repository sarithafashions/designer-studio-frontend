// Item catalog, measurement templates and amount preview for the invoice wizard.
import { DEFAULT_CATALOG_ITEMS, ITEMS_WITHOUT_MEASUREMENTS } from "../../../constants/catalogItems.js";
import { getTemplateForGarment } from "../../../constants/measurementTemplates.js";

export const CATALOG = DEFAULT_CATALOG_ITEMS.map((c) => c.name);
export const DEFAULT_SHOP_STATE = "Tamil Nadu";
export const MAX_ITEMS = 50;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const needsMeasurements = (itemName) => !!itemName && !ITEMS_WITHOUT_MEASUREMENTS.includes(itemName.trim());

// Material items (same rule as the backend ItemKind): Lining Material always; an "Other" (or custom-named) item when
// the shop owner ticks "This is a material charge". A material has no measurements, no photo and no production steps.
export const LINING_MATERIAL = "Lining Material";
/** The tick box is offered for "Other" and custom-named items (not catalog items). */
export const canChooseMaterial = (item) => item.itemName === "Other" || (!!item.itemName && !CATALOG.includes(item.itemName));
export const isMaterialItem = (item) =>
    (item.itemName || "").trim() === LINING_MATERIAL || (canChooseMaterial(item) && !!item.material);

/** Flat list of measurement field names for an item ({name, fields} groups expanded). */
export const measurementFields = (itemName) => {
    if (!needsMeasurements(itemName)) return [];
    return getTemplateForGarment(itemName).flatMap((f) => (typeof f === "string" ? [f] : f.fields));
};

let seq = 0;
export const newItem = (itemName = "") => ({
    key: `new-${Date.now()}-${seq++}`,
    itemUniqueId: null,
    itemName,
    customName: "",
    itemQuantity: "1",
    itemPrice: "",
    measurements: {},
    file: null,
    preview: null,
    imageUrl: null,
    removeImage: false,
    material: false,
    locked: false,
});

/** The name sent to the backend ("Other" uses the typed name). */
export const itemNameOf = (item) => (item.itemName === "Other" ? item.customName.trim() : item.itemName.trim());

/** Filled measurement count / template size (extra keys count as filled). */
export const measurementProgress = (item) => {
    const fields = isMaterialItem(item) ? [] : measurementFields(itemNameOf(item) || item.itemName);
    const filled = fields.filter((f) => String(item.measurements?.[f] ?? "").trim()).length;
    return { filled, total: fields.length };
};

/** Non-empty measurements only. */
export const cleanMeasurements = (m = {}) =>
    Object.fromEntries(Object.entries(m).map(([k, v]) => [k, String(v ?? "").trim()]).filter(([, v]) => v));

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const normaliseState = (s) => (s || "").toLowerCase().replace(/[^a-z]/g, "");

/** Same maths as the backend (InvoiceAmountCalculator): GST 5 % (CGST+SGST in-state, else IGST). */
export const previewAmounts = (items, { discount = 0, advancePaid = 0, customerState = DEFAULT_SHOP_STATE }) => {
    const total = round2(items.reduce((s, i) => s + (Number(i.itemPrice) || 0) * (Number(i.itemQuantity) || 0), 0));
    const disc = round2(Number(discount) || 0);
    const taxable = round2(total - disc);
    const intra = normaliseState(customerState) === normaliseState(DEFAULT_SHOP_STATE);
    const cgst = intra ? round2((taxable * 2.5) / 100) : 0;
    const sgst = cgst;
    const igst = intra ? 0 : round2((taxable * 5) / 100);
    const withGst = round2(taxable + cgst + sgst + igst);
    const advance = round2(Number(advancePaid) || 0);
    return { total, discount: disc, taxable, cgst, sgst, igst, intra, withGst, advance, balance: round2(withGst - advance) };
};

/** Validation helpers mirroring the backend rules. */
export const isQuantity = (v) => {
    const n = Number(v);
    return v !== "" && n >= 0.01 && n <= 1000 && /^\d+(\.\d{1,2})?$/.test(String(v).trim());
};
export const isPrice = (v) => v !== "" && Number(v) >= 0 && Number(v) <= 10000000 && /^\d+(\.\d{1,2})?$/.test(String(v).trim());
export const isPhone = (v) => /^\d{10}$/.test(String(v || "").trim());
export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
