// Printable cutting sheet: one block per item (invoice, customer, garment, dates, measurements, notes, design,
// sign-off line). Rendered outside the app (portal on <body>) so only the sheet prints; waits for the
// design photos (max 3 s), opens the print dialog, and calls onDone when printing ends.
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { formatDate, parseDueDate } from "../../shared/lib/format.js";
import { measurementView, urgencyOf } from "../../shared/production/desk.js";

const imagesLoaded = (root) =>
    Promise.race([
        Promise.all([...root.querySelectorAll("img")].map((img) =>
            img.complete ? null : new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
            }))),
        new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);

/** jobs: [{invoice, item}] */
export default function CuttingSheet({ jobs, onDone }) {
    const rootRef = useRef(null);
    const doneRef = useRef(onDone);
    useEffect(() => {
        doneRef.current = onDone;
    }, [onDone]);
    // Print once per mount (the callback may change on every render of the parent).
    useEffect(() => {
        let cancelled = false;
        const after = () => doneRef.current?.();
        window.addEventListener("afterprint", after);
        imagesLoaded(rootRef.current).then(() => {
            if (!cancelled) window.print();
        });
        return () => {
            cancelled = true;
            window.removeEventListener("afterprint", after);
        };
    }, []);

    const shopName = localStorage.getItem("shopName") || "";
    const printedOn = formatDate(new Date());
    return createPortal(
        <div className="tm-print-root" ref={rootRef}>
            {jobs.map(({ invoice, item }) => {
                const m = measurementView(item);
                const due = parseDueDate(invoice.expectedDeliveryDate);
                return (
                    <section className="tm-sheet" key={`${invoice.invoiceId}-${item.itemUniqueId}`}>
                        <header className="tm-sheet-head">
                            <b>{shopName || "Cutting sheet"}</b>
                            <span>Cutting sheet · printed {printedOn}</span>
                        </header>
                        <div className="tm-sheet-title">
                            <span className="tm-sheet-garment">{item.itemName}{item.itemQuantity > 1 ? ` × ${item.itemQuantity}` : ""}</span>
                            <span className="tm-sheet-inv">#{invoice.invoiceId}</span>
                        </div>
                        <div className="tm-sheet-facts">
                            <div><span>Customer</span><b>{invoice.customerName || "—"}</b></div>
                            <div><span>Ordered</span><b>{formatDate(invoice.invoiceDate)}</b></div>
                            <div><span>Delivery</span><b>{due ? formatDate(due) : "—"}</b> {due && <em>({urgencyOf(invoice.expectedDeliveryDate).label})</em>}</div>
                        </div>
                        <div className="tm-sheet-body">
                            <div className="tm-sheet-measure">
                                {m.rows.length ? m.rows.map((r) => (
                                    <div key={r.name}>
                                        <span>{r.name}</span>
                                        <b>{r.value === "" ? "—" : `${r.value}${r.unit ? ` ${r.unit}` : ""}`}</b>
                                    </div>
                                )) : <p>No measurements recorded.</p>}
                            </div>
                            {item.imageUrl && <img className="tm-sheet-photo" src={item.imageUrl} alt="" />}
                        </div>
                        {m.notes && <div className="tm-sheet-notes"><span>Notes</span>{m.notes}</div>}
                        <footer className="tm-sheet-sign">
                            <span>Cut by ____________________</span>
                            <span>Date ____________</span>
                            <span>Checked ____________________</span>
                        </footer>
                    </section>
                );
            })}
        </div>,
        document.body,
    );
}
