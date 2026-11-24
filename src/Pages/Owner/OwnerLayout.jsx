// App shell for the platform OWNER (all branches): sidebar + content in the shared theme.
import { FiGrid, FiHome, FiColumns, FiCreditCard, FiActivity, FiUsers, FiShield, FiHeart } from "react-icons/fi";
import AppShell from "../shared/AppShell.jsx";

const NAV = [
    { to: "/owner/overview", label: "Overview", icon: FiGrid },
    { to: "/owner/branches", label: "Branches", icon: FiHome },
    { to: "/owner/compare", label: "Compare", icon: FiColumns },
    { to: "/owner/expenses", label: "Expenses", icon: FiCreditCard },
    // { to: "/owner/production", label: "Production", icon: FiActivity },
    { to: "/owner/people", label: "People", icon: FiUsers },
    // { to: "/owner/customers", label: "Customers", icon: FiHeart },
    // { to: "/owner/audit", label: "Audit", icon: FiShield },
];

export default function OwnerLayout() {
    return <AppShell role="OWNER" roleLabel="Owner" navLabel="Business" nav={NAV} brand="All branches" />;
}
