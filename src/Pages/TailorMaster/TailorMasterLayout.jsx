// App shell for the TAILOR_MASTER: sidebar (Cutting queue · Assign tailors · Tailors · My progress) + content.
// Same functionality as the old tailor master screens, in the shared theme.
import { FiScissors, FiUserPlus, FiUsers, FiBarChart2 } from "react-icons/fi";
import AppShell from "../shared/AppShell.jsx";

const NAV = [
    { to: "/tailorMaster/cutting", label: "Cutting queue", icon: FiScissors },
    { to: "/tailorMaster/assign", label: "Assign tailors", icon: FiUserPlus },
    { to: "/tailorMaster/follow-up", label: "Tailors", icon: FiUsers },
    { to: "/tailorMaster/my-work", label: "My progress", icon: FiBarChart2 },
];

export default function TailorMasterLayout() {
    return <AppShell role="TAILOR_MASTER" roleLabel="Tailor master" navLabel="Production" nav={NAV} />;
}
