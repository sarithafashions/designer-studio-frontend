// Tailor master item actions (start cutting, assign / re-assign a tailor) for one or many items.
// Many items are done one after the other (decision 14: loop in the browser); failures are listed at the end.
import { useState } from "react";
import Swal from "sweetalert2";
import { updateItemStatus, assignTailor } from "../../../api/production.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { toast } from "../../../utils/toast.js";
import { isConflict } from "../../shared/lib/invoice.js";
import { itemLabel, rememberTailor } from "./workplace.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const listHtml = (items) =>
    `<ul style="text-align:left;margin:8px 0;padding-left:18px">${items
        .map((i) => `<li><b>${esc(itemLabel(i))}</b> · <span style="font-family:monospace">${esc(i.invoiceId)}</span></li>`)
        .join("")}</ul>`;

/** @param reload called after every action (also after failures) */
export default function useItemActions(reload) {
    const [busy, setBusy] = useState(false);

    const runAll = async (items, call, success) => {
        setBusy(true);
        const failed = [];
        for (const item of items) {
            try {
                await call(item);
            } catch (err) {
                failed.push({ item, reason: isConflict(err) ? "It changed meanwhile — check it again" : getErrorMessage(err) });
            }
        }
        setBusy(false);
        reload();
        if (!failed.length) {
            toast.success(success);
            return true;
        }
        const done = items.length - failed.length;
        Swal.fire({
            icon: "warning",
            title: done ? `${done} done, ${failed.length} not` : "Could not save",
            html: `<ul style="text-align:left;padding-left:18px">${failed
                .map((f) => `<li><b>${esc(itemLabel(f.item))}</b>: ${esc(f.reason)}</li>`)
                .join("")}</ul>`,
            confirmButtonColor: "#17171c",
        });
        return false;
    };

    /** ORDER_ACCEPTED → CUTTING (asks first; the tailor master cannot undo it). */
    const startCutting = async (items) => {
        if (!items.length) return false;
        const r = await Swal.fire({
            title: items.length === 1 ? `Start cutting ${itemLabel(items[0])}?` : `Start cutting ${items.length} items?`,
            html: listHtml(items) + "They move to <b>Cutting</b>. Only the shop owner can undo this.",
            showCancelButton: true,
            confirmButtonText: "Start cutting",
            reverseButtons: true,
            confirmButtonColor: "#17171c",
        });
        if (!r.isConfirmed) return false;
        return runAll(items, (i) => updateItemStatus(i.invoiceId, i.itemUniqueId, "CUTTING"),
            items.length === 1 ? `${itemLabel(items[0])}: cutting started` : `Cutting started for ${items.length} items`);
    };

    /** Assign (CUTTING) or re-assign (TAILOR_ASSIGNED / STITCHING) one tailor to the items. */
    const assign = async (items, tailor) => {
        if (!items.length || !tailor) return false;
        rememberTailor(tailor.userId);
        return runAll(items, (i) => assignTailor(i.invoiceId, i.itemUniqueId, tailor.userId),
            items.length === 1 ? `${itemLabel(items[0])} → ${tailor.name}` : `${items.length} items → ${tailor.name}`);
    };

    return { busy, startCutting, assign };
}
