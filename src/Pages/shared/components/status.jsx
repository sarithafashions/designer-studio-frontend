// Status badges used across the invoice pages. Every badge has an icon and text, never colour alone.
import { FiCheckCircle, FiClock, FiCircle, FiAlertTriangle, FiPackage, FiTruck, FiLoader, FiLayers } from "react-icons/fi";
import { Badge } from "./ui.jsx";
import { humanize } from "../lib/format.js";

const STAGE = {
    NEW: { tone: "neutral", label: "New", icon: FiCircle },
    IN_PRODUCTION: { tone: "info", label: "In production", icon: FiLoader },
    READY: { tone: "success", label: "Ready", icon: FiPackage },
    DELIVERED: { tone: "neutral", label: "Delivered", icon: FiTruck },
};

export function StageBadge({ stage }) {
    const s = STAGE[stage] || { tone: "neutral", label: humanize(stage) || "—", icon: FiCircle };
    const Icon = s.icon;
    return (
        <Badge tone={s.tone} icon={<Icon aria-hidden size={12} />}>
            {s.label}
        </Badge>
    );
}

const PAYMENT = {
    Paid: { tone: "success", icon: FiCheckCircle },
    Partial: { tone: "warning", icon: FiClock },
    Dues: { tone: "danger", icon: FiAlertTriangle },
};

export function PaymentBadge({ status }) {
    const p = PAYMENT[status] || { tone: "neutral", icon: FiCircle };
    const Icon = p.icon;
    return (
        <Badge tone={p.tone} icon={<Icon aria-hidden size={12} />}>
            {status === "Dues" ? "Unpaid" : status || "—"}
        </Badge>
    );
}

/** An item's production step; a material item (no production steps) shows "Material". */
export function ItemStatusBadge({ status, material = false }) {
    if (material) {
        return (
            <Badge tone="neutral" icon={<FiLayers aria-hidden size={12} />}>
                Material
            </Badge>
        );
    }
    const done = status === "ORDER_COMPLETED" || status === "ORDER_DELIVERED";
    const waiting = status === "ORDER_ACCEPTED";
    const Icon = done ? FiCheckCircle : waiting ? FiCircle : FiLoader;
    return (
        <Badge tone={done ? "success" : waiting ? "neutral" : "info"} icon={<Icon aria-hidden size={12} />}>
            {humanize(status) || "—"}
        </Badge>
    );
}

export function OverdueBadge({ days }) {
    if (!days) return null;
    return (
        <Badge tone="danger" icon={<FiAlertTriangle aria-hidden size={12} />}>
            {days}d late
        </Badge>
    );
}

/** Thin progress bar: completed / total work items (0 work items = only materials on the invoice). */
export function ItemProgress({ completed = 0, total = 0 }) {
    const pct = total ? Math.round((completed / total) * 100) : 0;
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 90 }}>
            <div className="so-barlist-track" style={{ flex: 1, height: 6 }} aria-hidden>
                <div
                    className="so-barlist-fill"
                    style={{ width: `${pct}%`, background: pct === 100 ? "var(--so-success)" : "var(--so-primary)" }}
                />
            </div>
            <span style={{ fontSize: 12, color: "var(--so-slate)", whiteSpace: "nowrap" }}>
                {total ? `${completed}/${total}` : "Material only"}
            </span>
        </div>
    );
}
