// "Download report" popup: branch report (GET /reports/branch-report) as Excel or PDF for a chosen period.
// Periods: today, yesterday, this / last week, this / last month, pick a month, last 3 / 6 / 12 months, pick a day,
// custom from–to (any range up to 366 days, never after today). Used on the owner's branch page (shopId) and the
// shop owner dashboard (no shopId: the backend uses their own branch).
import { useMemo, useState } from "react";
import { FiDownload, FiGrid, FiFileText } from "react-icons/fi";
import { Modal, Button } from "./ui.jsx";
import { Select } from "./form.jsx";
import DateField from "./DateField.jsx";
import { todayIST, addDays, daysBetween } from "../lib/period.js";
import { downloadBranchReport } from "../../../api/reports.js";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { toast } from "../../../utils/toast.js";

const MAX_DAYS = 366;

const ymd = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const lastDayOf = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m = 1..12
const minDate = (a, b) => (a < b ? a : b);
/** Same day `n` months earlier (clamped to the month's length). */
const addMonths = (date, n) => {
    const [y, m, d] = date.split("-").map(Number);
    const total = y * 12 + (m - 1) + n;
    const ny = Math.floor(total / 12);
    const nm = (total % 12) + 1;
    return ymd(ny, nm, Math.min(d, lastDayOf(ny, nm)));
};
const weekStart = (date) => {
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
    return addDays(date, -((dow + 6) % 7)); // Monday
};

const PRESETS = [
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "week", label: "This week" },
    { value: "lastWeek", label: "Last week" },
    { value: "month", label: "This month" },
    { value: "lastMonth", label: "Last month" },
    { value: "pickMonth", label: "Pick a month" },
    { value: "3m", label: "Last 3 months" },
    { value: "6m", label: "Last 6 months" },
    { value: "12m", label: "Last 12 months" },
    { value: "day", label: "Pick a day" },
    { value: "custom", label: "Custom (from – to)" },
];

/** The last 24 months as options ("2026-11" -> "November 2026"). */
const monthOptions = (today) => {
    const [y, m] = today.split("-").map(Number);
    const out = [];
    for (let i = 0; i < 24; i++) {
        const total = y * 12 + (m - 1) - i;
        const yy = Math.floor(total / 12);
        const mm = (total % 12) + 1;
        const label = new Date(Date.UTC(yy, mm - 1, 15)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
        out.push({ value: `${yy}-${String(mm).padStart(2, "0")}`, label });
    }
    return out;
};

/** {from, to} for a preset ("" when it needs input that is missing). */
const rangeOf = (preset, today, { month, day, from, to }) => {
    const [y, m] = today.split("-").map(Number);
    switch (preset) {
        case "today": return { from: today, to: today };
        case "yesterday": { const d = addDays(today, -1); return { from: d, to: d }; }
        case "week": return { from: weekStart(today), to: today };
        case "lastWeek": { const s = addDays(weekStart(today), -7); return { from: s, to: addDays(s, 6) }; }
        case "month": return { from: ymd(y, m, 1), to: today };
        case "lastMonth": {
            const t = y * 12 + (m - 1) - 1; const yy = Math.floor(t / 12); const mm = (t % 12) + 1;
            return { from: ymd(yy, mm, 1), to: ymd(yy, mm, lastDayOf(yy, mm)) };
        }
        case "pickMonth": {
            if (!month) return { from: "", to: "" };
            const [yy, mm] = month.split("-").map(Number);
            return { from: ymd(yy, mm, 1), to: minDate(ymd(yy, mm, lastDayOf(yy, mm)), today) };
        }
        case "3m": return { from: addDays(addMonths(today, -3), 1), to: today };
        case "6m": return { from: addDays(addMonths(today, -6), 1), to: today };
        case "12m": return { from: addDays(addMonths(today, -12), 1), to: today };
        case "day": return { from: day || "", to: day || "" };
        default: return { from: from || "", to: to || "" };
    }
};

const pretty = (date) => new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export default function ReportDownloadModal({ open, onClose, shopId, branchName }) {
    const today = todayIST();
    const months = useMemo(() => monthOptions(today), [today]);
    const [preset, setPreset] = useState("month");
    const [month, setMonth] = useState(months[1]?.value || "");
    const [day, setDay] = useState(today);
    const [from, setFrom] = useState(addDays(today, -29));
    const [to, setTo] = useState(today);
    const [format, setFormat] = useState("xlsx");
    const [busy, setBusy] = useState(false);

    const range = rangeOf(preset, today, { month, day, from, to });
    const days = range.from && range.to ? daysBetween(range.from, range.to) : 0;
    const error = !range.from || !range.to ? "Pick the dates"
        : range.to < range.from ? "The end date is before the start date"
            : range.to > today ? "The period cannot end after today"
                : days > MAX_DAYS ? `A report can cover at most ${MAX_DAYS} days (this is ${days})` : "";
    const periodText = !error ? (range.from === range.to ? pretty(range.from) : `${pretty(range.from)} – ${pretty(range.to)}`) : "";

    const download = async () => {
        if (error) return;
        setBusy(true);
        try {
            const name = await downloadBranchReport({ shopId, from: range.from, to: range.to, format });
            toast.success("Report downloaded", name);
            onClose?.();
        } catch (err) {
            toast.error("Could not create the report", getErrorMessage(err, "Please try again."));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal open={open} onClose={busy ? undefined : onClose} title="Download report"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
                    <Button onClick={download} disabled={busy || !!error}>
                        {busy ? <><span className="so-spinner" aria-hidden /> Preparing…</> : <><FiDownload aria-hidden /> Download</>}
                    </Button>
                </>
            }>
            <div className="so-stack" style={{ gap: 16 }}>
                <div className="so-field">
                    <label className="so-label" htmlFor="rd-period">Period</label>
                    <Select id="rd-period" options={PRESETS} value={preset} onChange={(e) => setPreset(e.target.value)} />
                </div>

                {preset === "pickMonth" && (
                    <div className="so-field">
                        <label className="so-label" htmlFor="rd-month">Month</label>
                        <Select id="rd-month" options={months} value={month} onChange={(e) => setMonth(e.target.value)} />
                    </div>
                )}
                {preset === "day" && (
                    <div className="so-field">
                        <label className="so-label" htmlFor="rd-day">Day</label>
                        <DateField id="rd-day" ariaLabel="Day" value={day} max={today} onChange={(v) => setDay(v || "")} />
                    </div>
                )}
                {preset === "custom" && (
                    <div className="so-field">
                        <span className="so-label">From – to (up to {MAX_DAYS} days)</span>
                        <div className="so-date-range">
                            <DateField id="rd-from" ariaLabel="From" value={from} max={today} invalid={!!error} onChange={(v) => setFrom(v || "")} />
                            <span style={{ color: "var(--so-slate)" }}>to</span>
                            <DateField id="rd-to" ariaLabel="To" value={to} max={today} invalid={!!error} onChange={(v) => setTo(v || "")} />
                        </div>
                    </div>
                )}

                <div className="so-field">
                    <span className="so-label">Format</span>
                    <div className="rd-formats" role="radiogroup" aria-label="Format">
                        {[
                            { key: "xlsx", icon: <FiGrid aria-hidden />, title: "Excel", text: "Full detail: one sheet per section, every row" },
                            { key: "pdf", icon: <FiFileText aria-hidden />, title: "PDF", text: "Printable A4; long lists show the first 500 rows" },
                        ].map((f) => (
                            <button key={f.key} type="button" role="radio" aria-checked={format === f.key}
                                className={`rd-format${format === f.key ? " on" : ""}`} onClick={() => setFormat(f.key)}>
                                <span className="rd-format-icon">{f.icon}</span>
                                <span><b>{f.title}</b><small>{f.text}</small></span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className={`rd-summary${error ? " bad" : ""}`} role="status">
                    {error || <>{branchName ? <b>{branchName}</b> : "Your branch"} · {periodText} · {days} day{days === 1 ? "" : "s"} · {format === "xlsx" ? "Excel" : "PDF"}</>}
                </div>
                <p className="so-hint" style={{ margin: 0 }}>
                    Includes the summary vs the period before, GST, day by day, orders, payments, deliveries, expenses, petty cash,
                    production, staff, customers, deleted invoices and sales by item.
                </p>
            </div>
        </Modal>
    );
}
