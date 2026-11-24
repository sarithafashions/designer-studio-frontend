// Pick a tailor for one or more items. Tailors are listed least busy first, with their current load
// (GET /items/assignees/tailors?withLoad=true); the last tailor used is pre-selected when free to choose.
import { useEffect, useState } from "react";
import { FiUser, FiCheck } from "react-icons/fi";
import { listTailorsWithLoad } from "../../../api/production.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { Modal, Button, EmptyState, ErrorBox, Skeleton } from "../../shared/components/ui.jsx";
import { byLoad, loadText, lastTailor, itemLabel } from "../lib/workplace.js";

/**
 * @param items     work items to assign (all must allow ASSIGN_TAILOR)
 * @param onSubmit  (tailor {userId, name}) => Promise
 */
export default function AssignTailorModal({ open, items = [], onClose, onSubmit }) {
    const [state, setState] = useState({ loading: true, tailors: [], error: "" });
    const [selected, setSelected] = useState(null);
    const [saving, setSaving] = useState(false);
    // The current tailor (only meaningful for one item, or when all items share it).
    const currentIds = new Set(items.map((i) => i.tailor?.userId).filter(Boolean));
    const current = currentIds.size === 1 && items.every((i) => i.tailor?.userId) ? [...currentIds][0] : null;
    const reassign = items.some((i) => i.tailor?.userId);

    useEffect(() => {
        if (!open) return;
        setState({ loading: true, tailors: [], error: "" });
        setSaving(false);
        listTailorsWithLoad()
            .then((list) => {
                const sorted = byLoad(list);
                setState({ loading: false, tailors: sorted, error: "" });
                const free = sorted.filter((t) => t.userId !== current);
                const remembered = free.find((t) => t.userId === lastTailor());
                setSelected((remembered || free[0] || null)?.userId || null);
            })
            .catch((err) => setState({ loading: false, tailors: [], error: getErrorMessage(err, "Could not load tailors") }));
        // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the dialog opens
    }, [open]);

    const tailor = state.tailors.find((t) => t.userId === selected);
    const submit = async () => {
        if (!tailor) return;
        setSaving(true);
        try {
            await onSubmit(tailor);
        } finally {
            setSaving(false);
        }
    };

    const title = `${reassign ? "Re-assign" : "Assign"} ${items.length === 1 ? itemLabel(items[0]) : `${items.length} items`}`;
    return (
        <Modal
            open={open}
            title={title}
            onClose={saving ? undefined : onClose}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button onClick={submit} disabled={saving || !tailor || tailor.userId === current}>
                        {saving ? "Saving…" : tailor ? `Assign to ${tailor.name}` : "Choose a tailor"}
                    </Button>
                </>
            }
        >
            {items.length > 1 && (
                <div className="so-chips" style={{ marginBottom: 12 }} aria-label="Items">
                    {items.map((i) => (
                        <span key={`${i.invoiceId}-${i.itemUniqueId}`} className="so-chip">{itemLabel(i)}</span>
                    ))}
                </div>
            )}
            {reassign && (
                <p className="so-hint" style={{ marginTop: 0 }}>
                    The new tailor starts again from “Tailor assigned”.
                </p>
            )}
            {state.loading ? (
                <div className="so-stack" style={{ gap: 8 }}>
                    <Skeleton height={52} />
                    <Skeleton height={52} />
                    <Skeleton height={52} />
                </div>
            ) : state.error ? (
                <ErrorBox message={state.error} />
            ) : state.tailors.length === 0 ? (
                <EmptyState compact title="No tailors in your shop" message="Ask the shop owner to add a tailor." />
            ) : (
                <div className="tm-pick" role="radiogroup" aria-label="Tailor">
                    {state.tailors.map((t) => {
                        const isCurrent = t.userId === current;
                        const on = t.userId === selected;
                        return (
                            <button
                                key={t.userId}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                disabled={isCurrent}
                                className={`tm-pick-row ${on ? "on" : ""}`}
                                onClick={() => setSelected(t.userId)}
                            >
                                <span className="tm-pick-icon" aria-hidden>{on ? <FiCheck /> : <FiUser />}</span>
                                <span className="tm-pick-text">
                                    <span className="tm-pick-name">
                                        {t.name || "Tailor"}
                                        {isCurrent && <span className="so-cell-sub"> · current</span>}
                                    </span>
                                    <span className="so-cell-sub">{loadText(t)}</span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </Modal>
    );
}
