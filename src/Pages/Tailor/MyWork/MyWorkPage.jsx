// Tailor's My progress: stitching started and items handed to a shop assistant (shared MyWork page).
import { FiPlayCircle, FiSend } from "react-icons/fi";
import MyWork from "../../shared/production/MyWork.jsx";

const TILES = [
    { type: "TAILOR_STITCHING", label: "Stitching started", foot: "Items you started", icon: <FiPlayCircle aria-hidden /> },
    { type: "ASSIGNED_TO_ASSISTANT", label: "Handed over", foot: "Given to a shop assistant", icon: <FiSend aria-hidden /> },
];

export default function MyWorkPage() {
    return <MyWork tiles={TILES} title="My progress" />;
}
