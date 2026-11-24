// Order items (the old OrderDetails, new UI): every item of one invoice in the tailor master's queue —
// measurements, design photo, status, mark cut, assign / re-assign tailor, track status, print cutting sheet.
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft, FiMaximize2, FiImage, FiScissors, FiUserPlus, FiActivity, FiRefreshCw, FiPrinter } from "react-icons/fi";
import { fetchQueueInvoices, updateItemStatus, assignTailor } from "../../../utils/workQueue.js";
import { ACTIONS } from "../../../api/production.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { toast } from "../../../utils/toast.js";
import { Card, Button, EmptyState, ErrorBox, Skeleton } from "../../shared/components/ui.jsx";
import { ItemStatusBadge } from "../../shared/components/status.jsx";
import { formatDate } from "../../shared/lib/format.js";
import { deskItems } from "../../shared/production/desk.js";
import { UrgencyBadge } from "../../shared/production/DeskParts.jsx";
import { MeasurementsModal, TrackStatusModal, AssignTailorModal, DesignModal } from "../../shared/production/Modals.jsx";
import CuttingSheet from "../components/CuttingSheet.jsx";

export default function OrderItemsPage() {
    const { invoiceId } = useParams();
    const navigate = useNavigate();
    const [state, setState] = useState({ loading: true, invoice: null, error: "" });
    const [busy, setBusy] = useState(false);
    const [measure, setMeasure] = useState(null);
    const [design, setDesign] = useState(null);
    const [track, setTrack] = useState(null);
    const [assigning, setAssigning] = useState(null);
    const [printing, setPrinting] = useState(false);

    const load = useCallback((silent = false) => {
        if (!silent) setState((s) => ({ ...s, loading: true, error: "" }));
        return fetchQueueInvoices()
            .then((invoices) => {
                const found = invoices.find((inv) => inv.invoiceId === invoiceId);
                setState({ loading: false, invoice: found ? { ...found, items: deskItems(found) } : null, error: "" });
            })
            .catch((err) => setState({ loading: false, invoice: null, error: getErrorMessage(err, "Could not load the order.") }));
    }, [invoiceId]);
    useEffect(() => {
        load();
    }, [load]);

    const inv = state.invoice;
    const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/tailorMaster/cutting"));

    const markCut = async (item) => {
        setBusy(true);
        try {
            await updateItemStatus(inv.invoiceId, item.itemUniqueId, "CUTTING");
            toast.success(`${item.itemName} marked as cutting`);
        } catch (err) {
            toast.error("Status update failed", getErrorMessage(err));
        } finally {
            setBusy(false);
            load(true);
        }
    };
    const submitAssign = async (tailor) => {
        const { item } = assigning;
        try {
            await assignTailor(inv.invoiceId, item.itemUniqueId, tailor.userId);
            toast.success(`${item.itemName} assigned to ${tailor.name}`);
            setAssigning(null);
        } catch (err) {
            toast.error("Could not assign the tailor", getErrorMessage(err));
        } finally {
            load(true);
        }
    };

    return (
        <>
            <button type="button" className="so-back" onClick={back}>
                <FiArrowLeft aria-hidden /> Back
            </button>

            {state.loading ? (
                <div className="so-stack">
                    <Skeleton height={70} />
                    <Skeleton height={240} />
                </div>
            ) : state.error ? (
                <ErrorBox message={state.error} onRetry={() => load()} />
            ) : !inv ? (
                <Card>
                    <EmptyState title={`Order ${invoiceId} has no items in your work queue`}
                        message="Its items may already be with the shop assistant, or the order is delivered."
                        action={<Button variant="secondary" onClick={() => navigate("/tailorMaster/cutting")}>Go to the cutting queue</Button>} />
                </Card>
            ) : (
                <>
                    <header className="so-page-head" style={{ alignItems: "flex-start" }}>
                        <div style={{ minWidth: 0 }}>
                            <div className="so-eyebrow">Order items</div>
                            <h1 className="so-page-title so-mono" style={{ fontFamily: "var(--so-font-display)" }}>{inv.invoiceId}</h1>
                            <div className="so-badges" style={{ marginTop: 8 }}>
                                <span className="tm-job-name" style={{ fontSize: 16 }}>{inv.customerName || "Customer"}</span>
                                <span className="so-cell-sub">· ordered {formatDate(inv.invoiceDate)}</span>
                                <UrgencyBadge date={inv.expectedDeliveryDate} />
                            </div>
                        </div>
                        <div className="so-actions">
                            <Button variant="ghost" size="sm" onClick={() => load()}>
                                <FiRefreshCw aria-hidden /> Refresh
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => setPrinting(true)}>
                                <FiPrinter aria-hidden /> Print cutting sheet
                            </Button>
                        </div>
                    </header>

                    <div className="so-table-wrap">
                        <table className="so-table">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th className="so-num">Qty</th>
                                    <th>Status</th>
                                    <th>Measurements</th>
                                    <th>Design</th>
                                    <th aria-label="Actions" />
                                </tr>
                            </thead>
                            <tbody>
                                {inv.items.map((item) => {
                                    const canAssign = (item.availableActions || []).includes(ACTIONS.ASSIGN_TAILOR);
                                    return (
                                        <tr key={item.itemUniqueId}>
                                            <td>
                                                <div className="so-cell-main">{item.itemName}</div>
                                                {item.assignedTailorName && <div className="so-cell-sub">Tailor: {item.assignedTailorName}</div>}
                                            </td>
                                            <td className="so-num">{item.itemQuantity}</td>
                                            <td><ItemStatusBadge status={item.itemOrderStatus} /></td>
                                            <td>
                                                <Button variant="ghost" size="sm" onClick={() => setMeasure(item)}>
                                                    <FiMaximize2 aria-hidden /> View
                                                </Button>
                                            </td>
                                            <td>
                                                <Button variant="ghost" size="sm" onClick={() => setDesign(item)}>
                                                    <FiImage aria-hidden /> View design
                                                </Button>
                                            </td>
                                            <td>
                                                <div className="tm-row-actions">
                                                    {item.itemOrderStatus === "ORDER_ACCEPTED" ? (
                                                        <Button size="sm" disabled={busy} onClick={() => markCut(item)}>
                                                            <FiScissors aria-hidden /> Mark cut
                                                        </Button>
                                                    ) : (
                                                        <Button size="sm" variant={item.assignedTo ? "secondary" : "primary"} disabled={busy || !canAssign}
                                                            title={canAssign ? undefined : "A tailor can be assigned after cutting (and before a shop assistant is assigned)"}
                                                            onClick={() => setAssigning({ invoice: inv, item })}>
                                                            <FiUserPlus aria-hidden /> {item.assignedTo ? "Re-assign" : "Assign tailor"}
                                                        </Button>
                                                    )}
                                                    <Button variant="ghost" size="sm" onClick={() => setTrack(item)}>
                                                        <FiActivity aria-hidden /> Track status
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            <MeasurementsModal item={measure} onClose={() => setMeasure(null)} />
            <DesignModal item={design} onClose={() => setDesign(null)} />
            <TrackStatusModal item={track} invoiceId={inv?.invoiceId} customerName={inv?.customerName} invoiceDate={inv?.invoiceDate} onClose={() => setTrack(null)} />
            <AssignTailorModal target={assigning} onClose={() => setAssigning(null)} onSubmit={submitAssign} />
            {printing && inv && <CuttingSheet jobs={inv.items.map((item) => ({ invoice: inv, item }))} onDone={() => setPrinting(false)} />}
        </>
    );
}
