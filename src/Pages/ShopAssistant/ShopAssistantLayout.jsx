// App shell for the SHOP_ASSISTANT: sidebar (My jobs · My progress) + content, in the shared theme.
import { FiInbox, FiBarChart2 } from "react-icons/fi";
import AppShell from "../shared/AppShell.jsx";

const NAV = [
    { to: "/shopAssistant/jobs", label: "My jobs", icon: FiInbox },
    { to: "/shopAssistant/my-work", label: "My progress", icon: FiBarChart2 },
];

export default function ShopAssistantLayout() {
    return <AppShell role="SHOP_ASSISTANT" roleLabel="Shop assistant" navLabel="Finishing" nav={NAV} />;
}
