// App shell for the SHOP_OWNER: sidebar (Dashboard · Invoices · Deliveries · Employees · Expenses) + content.
import { FiGrid, FiFileText, FiTruck, FiUsers, FiCreditCard } from "react-icons/fi";
import AppShell from "../shared/AppShell.jsx";

const NAV = [
    { to: "/shopOwner/dashboard", label: "Dashboard", icon: FiGrid },
    { to: "/shopOwner/invoices", label: "Invoices", icon: FiFileText },
    { to: "/shopOwner/deliveries", label: "Deliveries", icon: FiTruck },
    { to: "/shopOwner/employees", label: "Employees", icon: FiUsers },
    { to: "/shopOwner/expenses", label: "Expenses", icon: FiCreditCard },
];

export default function ShopOwnerLayout() {
    return <AppShell role="SHOP_OWNER" roleLabel="Shop owner" navLabel="Shop" nav={NAV} />;
}
