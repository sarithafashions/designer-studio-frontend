// Tailor's Stitching tab: my items in stitching -> choose a shop assistant -> Assign (shared AssignBoard).
// Assigning the shop assistant is how stitching is finished; the item then leaves my queue (no re-assign).
import { assignShopAssistant } from "../../../utils/workQueue.js";
import { listShopAssistantsWithLoad, ACTIONS } from "../../../api/production.js";
import AssignBoard from "../../shared/production/AssignBoard.jsx";

const keep = (item) => item.itemOrderStatus === "STITCHING" && (item.availableActions || []).includes(ACTIONS.ASSIGN_SHOP_ASSISTANT);

export default function AssignAssistantPage() {
    return (
        <AssignBoard
            title="Stitching"
            eyebrow="Hand over"
            statuses={["STITCHING"]}
            keep={keep}
            loadPeople={listShopAssistantsWithLoad}
            assign={assignShopAssistant}
            noun="shop assistant"
            workWord="hemming & ironing"
            subtitle="Items you are stitching, soonest delivery first. When stitching is done, choose a shop assistant and press Assign."
            emptyTitle="Nothing in stitching"
            emptyMessage="Start stitching an item in New jobs; it shows up here to hand over."
            emptyAction={{ label: "Go to new jobs", to: "/tailor/queue" }}
        />
    );
}
