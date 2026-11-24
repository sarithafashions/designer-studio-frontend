// Tailor master's My progress: items cut and tailor assignments (shared MyWork page).
import { FiScissors, FiUserPlus } from "react-icons/fi";
import MyWork from "../../shared/production/MyWork.jsx";

const TILES = [
    { type: "TAILOR_MASTER_CUTTING", label: "Items cut", foot: "Marked as cutting", icon: <FiScissors aria-hidden /> },
    { type: "ASSIGNED_TO_TAILOR", label: "Tailor assignments", foot: "Re-assignments included", icon: <FiUserPlus aria-hidden /> },
];

export default function MyWorkPage() {
    return <MyWork tiles={TILES} title="My progress" />;
}
