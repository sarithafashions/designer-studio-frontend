// "Export" button for a filtered table: runs onExport (which fetches all matching rows and calls exportXlsx),
// shows a spinner meanwhile and a toast when done or failed. onExport resolves to the file name.
import { useState } from "react";
import { FiDownload } from "react-icons/fi";
import { Button } from "./ui.jsx";
import { toast } from "../../../utils/toast.js";
import { getErrorMessage } from "../../LoginPages/axios.js";

export default function ExportButton({ onExport, disabled, label = "Export", size = "sm" }) {
    const [busy, setBusy] = useState(false);
    const run = async () => {
        setBusy(true);
        try {
            const name = await onExport();
            toast.success("Excel downloaded", name || "");
        } catch (err) {
            toast.error("Could not export", getErrorMessage(err, "Please try again."));
        } finally {
            setBusy(false);
        }
    };
    return (
        <Button variant="secondary" size={size} onClick={run} disabled={disabled || busy} title="Download these rows as an Excel sheet">
            {busy ? <span className="so-spinner" aria-hidden /> : <FiDownload aria-hidden />} {busy ? "Exporting…" : label}
        </Button>
    );
}
