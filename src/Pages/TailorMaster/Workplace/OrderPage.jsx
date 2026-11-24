// One order for the tailor master: every item still in the tailor master's stages, with photo, full
// measurements, stage history and the cut / assign actions; "Print cutting slip" prints the measurements.
// Built from the work queue (decision 8): items already with the shop assistant are not shown.
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft, FiPrinter, FiImage, FiScissors, FiUserPlus } from "react-icons/fi";
import { getQueueOrders } from "../../../api/production.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { Card, Button, EmptyState, ErrorBox, Skeleton } from "../../shared/components/ui.jsx";
import { ItemStatusBadge } from "../../shared/components/status.jsx";
import { formatDate } from "../../shared/lib/format.js";
import { itemLabel, canCut, canAssign } from "../lib/workplace.js";
import useItemActions from "../lib/useItemActions.js";
import { DueBadge } from "./OrderCard.jsx";
import { MeasurementTable, StageHistory } from "./ItemDetailsModal.jsx";
import AssignTailorModal from "./AssignTailorModal.jsx";

export default function OrderPage() {
    const { invoiceId } = useParams();
    const navigate = useNavigate();
    const [state, setState] = useState({ loading: true, order: null, error: "" });
    const [assigning, setAssigning] = useState(null);

    const load = useCallback(
        (silent = false) => {
            if (!silent) setState((s) => ({ ...s, loading: true, error: "" }));
            // The whole tailor-master queue of this invoice: search by its number, then the exact match.
            return getQueueOrders({ search: invoiceId, pageSize: 100 })
                .then((page) => setState({ loading: false, order: (page?.content || []).find((o) => o.invoiceId === invoiceId) || null, error: "" }))
                .catch((err) => setState({ loading: false, order: null, error: getErrorMessage(err, "Could not load the order") }));
        },
        [invoiceId],
    );
    useEffect(() => {
        load();
    }, [load]);
    const { busy, startCutting, assign } = useItemActions(() => load(true));

    const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/tailorMaster/workplace"));
    const order = state.order;
    const items = order?.items || [];
    const toCut = items.filter(canCut);
    const toAssign = items.filter((i) => canAssign(i) && !i.tailor);

    return (
        <>
            <button type="button" className="so-back tm-no-print" onClick={back}>
                <FiArrowLeft aria-hidden /> Back to workplace
            </button>

            {state.loading ? (
                <div className="so-stack">
                    <Skeleton height={80} />
                    <Skeleton height={260} />
                </div>
            ) : state.error ? (
                <ErrorBox message={state.error} onRetry={() => load()} />
            ) : !order ? (
                <Card>
                    <EmptyState
                        title="Nothing to do on this order"
                        message={`${invoiceId} has no items in cutting or with tailors — they may be with the shop assistant already, or delivered.`}
                        action={<Button variant="secondary" onClick={() => navigate("/tailorMaster/workplace")}>Go to the workplace</Button>}
                    />
                </Card>
            ) : (
                <>
                    <header className="so-page-head" style={{ alignItems: "flex-start" }}>
                        <div style={{ minWidth: 0 }}>
                            <div className="so-eyebrow">Order</div>
                            <h1 className="so-page-title so-mono" style={{ fontFamily: "var(--so-font-display)" }}>{order.invoiceId}</h1>
                            <div className="so-badges" style={{ marginTop: 8 }}>
                                <span className="tm-order-customer">{order.customerName || "Customer"}</span>
                                <span className="so-cell-sub">· ordered {formatDate(order.invoiceDate)}</span>
                                <DueBadge dueDate={order.dueDate} daysOverdue={order.daysOverdue} />
                            </div>
                        </div>
                        <div className="so-actions tm-no-print">
                            {toCut.length > 1 && (
                                <Button variant="secondary" disabled={busy} onClick={() => startCutting(toCut)}>
                                    <FiScissors aria-hidden /> Start cutting all ({toCut.length})
                                </Button>
                            )}
                            {toAssign.length > 1 && (
                                <Button variant="secondary" disabled={busy} onClick={() => setAssigning(toAssign)}>
                                    <FiUserPlus aria-hidden /> One tailor for all ({toAssign.length})
                                </Button>
                            )}
                            <Button variant="secondary" onClick={() => window.print()}>
                                <FiPrinter aria-hidden /> Print cutting slip
                            </Button>
                        </div>
                    </header>

                    <div className="so-stack" style={{ gap: 12 }}>
                        {items.map((item) => (
                            <article key={item.itemUniqueId} className="so-card tm-slip">
                                <div className="tm-detail">
                                    <div className="tm-detail-photo">
                                        {item.imageUrl ? (
                                            <a href={item.imageUrl} target="_blank" rel="noreferrer" title="Open the photo">
                                                <img src={item.imageUrl} alt={item.itemName} />
                                            </a>
                                        ) : (
                                            <div className="tm-photo-empty"><FiImage aria-hidden /> No photo</div>
                                        )}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div className="tm-slip-head">
                                            <h2 className="so-card-title">{itemLabel(item)}</h2>
                                            <ItemStatusBadge status={item.status} />
                                        </div>
                                        {item.tailor?.name && <div className="so-cell-sub" style={{ margin: "4px 0 8px" }}>Tailor: <b>{item.tailor.name}</b></div>}
                                        <MeasurementTable item={item} />
                                        <div className="so-actions tm-no-print" style={{ marginTop: 12 }}>
                                            {canCut(item) && (
                                                <Button size="sm" disabled={busy} onClick={() => startCutting([item])}>
                                                    <FiScissors aria-hidden /> Start cutting
                                                </Button>
                                            )}
                                            {canAssign(item) && (
                                                <Button size="sm" variant={item.tailor ? "secondary" : "primary"} disabled={busy} onClick={() => setAssigning([item])}>
                                                    <FiUserPlus aria-hidden /> {item.tailor ? "Re-assign" : "Assign tailor"}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <details className="so-details tm-no-print" style={{ marginTop: 12 }}>
                                    <summary>Stage history</summary>
                                    <div style={{ marginTop: 10 }}>
                                        <StageHistory item={item} invoiceDate={order.invoiceDate} />
                                    </div>
                                </details>
                            </article>
                        ))}
                    </div>
                    <p className="so-hint tm-no-print" style={{ marginTop: 12 }}>
                        Only items in cutting or with tailors are shown; finished-stitching items are with the shop assistant.
                    </p>
                </>
            )}

            <AssignTailorModal
                open={!!assigning}
                items={assigning || []}
                onClose={() => setAssigning(null)}
                onSubmit={(tailor) => assign(assigning, tailor).then(() => setAssigning(null))}
            />
        </>
    );
}
