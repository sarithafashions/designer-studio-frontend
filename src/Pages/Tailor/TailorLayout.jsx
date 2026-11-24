// App shell for the TAILOR: sidebar (New jobs · Stitching · My progress) + content, in the shared theme.
import { FiInbox, FiSend, FiBarChart2 } from "react-icons/fi";
import AppShell from "../shared/AppShell.jsx";

const NAV = [
    { to: "/tailor/queue", label: "New jobs", icon: FiInbox },
    { to: "/tailor/assign", label: "Stitching", icon: FiSend },
    { to: "/tailor/my-work", label: "My progress", icon: FiBarChart2 },
];

export default function TailorLayout() {
    return <AppShell role="TAILOR" roleLabel="Tailor" navLabel="Stitching" nav={NAV} />;
}
