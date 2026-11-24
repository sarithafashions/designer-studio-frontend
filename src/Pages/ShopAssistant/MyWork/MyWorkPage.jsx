// Shop assistant's My progress: hemming & ironing started, items completed (shared MyWork page).
import { FiPlayCircle, FiCheckCircle } from "react-icons/fi";
import MyWork from "../../shared/production/MyWork.jsx";

const TILES = [
    { type: "ASSISTANT_HEMMING", label: "Hemming & ironing started", foot: "Items you started", icon: <FiPlayCircle aria-hidden /> },
    { type: "ORDER_COMPLETED", label: "Items completed", foot: "Ironed and marked completed", icon: <FiCheckCircle aria-hidden /> },
];

export default function MyWorkPage() {
    return <MyWork tiles={TILES} title="My progress" />;
}
