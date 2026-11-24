// Tailor master's Assign tailors tab: cut items waiting for a tailor -> choose a tailor -> Assign (shared AssignBoard).
import { assignTailor } from "../../../utils/workQueue.js";
import { listTailorsWithLoad, ACTIONS } from "../../../api/production.js";
import AssignBoard from "../../shared/production/AssignBoard.jsx";

const keep = (item) => item.itemOrderStatus === "CUTTING" && !item.assignedTo && (item.availableActions || []).includes(ACTIONS.ASSIGN_TAILOR);

export default function AssignBoardPage() {
    return (
        <AssignBoard
            title="Assign tailors"
            statuses={["CUTTING"]}
            keep={keep}
            loadPeople={listTailorsWithLoad}
            assign={assignTailor}
            noun="tailor"
            workWord="stitching"
            subtitle="Cut items waiting for a tailor, soonest delivery first. Choose a tailor and press Assign."
            emptyTitle="No cut items are waiting for a tailor"
            emptyMessage="Items show up here after you mark them as cut."
            emptyAction={{ label: "Go to the cutting queue", to: "/tailorMaster/cutting" }}
            orderPath={(invoiceId) => `/tailorMaster/orders/${encodeURIComponent(invoiceId)}`}
        />
    );
}
