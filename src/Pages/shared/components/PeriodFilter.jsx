// Period filter: Today · This week · This month · Custom · Overall (top-right of a page).
// Controlled: value = { key, from, to } where from/to are yyyy-MM-dd (null for "overall").
import { useState } from "react";
import { PERIODS, rangeFor, todayIST, daysBetween } from "../lib/period.js";
import { Segmented, Button } from "./ui.jsx";
import DateField from "./DateField.jsx";

export default function PeriodFilter({ value, onChange, maxCustomDays }) {
    const [draft, setDraft] = useState({ from: value.from || todayIST(), to: value.to || todayIST() });
    const [error, setError] = useState("");

    const pick = (key) => {
        setError("");
        if (key === "custom") {
            // Open the custom inputs pre-filled with the current range; apply on "Apply".
            const start = { from: value.from || todayIST(), to: value.to || todayIST() };
            setDraft(start);
            onChange({ key: "custom", ...start });
            return;
        }
        onChange({ key, ...rangeFor(key) });
    };

    const apply = () => {
        if (!draft.from || !draft.to) return setError("Pick both dates");
        if (draft.from > draft.to) return setError("Start date is after end date");
        if (draft.to > todayIST()) return setError("End date is in the future");
        if (maxCustomDays && daysBetween(draft.from, draft.to) > maxCustomDays) {
            return setError(`Pick at most ${maxCustomDays} days`);
        }
        setError("");
        onChange({ key: "custom", from: draft.from, to: draft.to });
    };

    return (
        <div className="so-period">
            <Segmented options={PERIODS} value={value.key} onChange={pick} label="Period" />
            {value.key === "custom" && (
                <div className="so-date-range">
                    <DateField
                        id="so-from"
                        ariaLabel="From"
                        value={draft.from}
                        max={todayIST()}
                        invalid={!!error}
                        onChange={(v) => setDraft((d) => ({ ...d, from: v }))}
                    />
                    <span style={{ color: "var(--so-slate)" }}>to</span>
                    <DateField
                        id="so-to"
                        ariaLabel="To"
                        value={draft.to}
                        max={todayIST()}
                        invalid={!!error}
                        onChange={(v) => setDraft((d) => ({ ...d, to: v }))}
                    />
                    <Button size="sm" onClick={apply}>
                        Apply
                    </Button>
                    {error && (
                        <span className="so-field-error" role="alert" style={{ marginTop: 0 }}>
                            {error}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
