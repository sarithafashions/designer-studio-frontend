// Shared by the platform owner pages: period in the URL, section loading, period wording, branch colours.
import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "../../LoginPages/axios.js";
import { PERIODS, rangeFor } from "../../shared/lib/period.js";
import { formatDate } from "../../shared/lib/format.js";

export const PERIOD_TEXT = { today: "Today", week: "This week", month: "This month", overall: "All time" };

/** "This month" / "1 Nov 2026 – 18 Nov 2026" for the subtitle. */
export const periodText = (period) =>
    period.key === "custom" ? `${formatDate(period.from)} – ${formatDate(period.to)}` : PERIOD_TEXT[period.key];

/** Period from the URL (?period=&from=&to=), default this month. */
export const periodFrom = (params) => {
    const key = PERIODS.some((p) => p.key === params.get("period")) ? params.get("period") : "month";
    if (key === "custom" && params.get("from") && params.get("to")) return { key, from: params.get("from"), to: params.get("to") };
    const k = key === "custom" ? "month" : key;
    return { key: k, ...rangeFor(k) };
};

/** URLSearchParams updater that writes a period. */
export const withPeriod = (cur, p) => {
    const next = new URLSearchParams(cur);
    next.set("period", p.key);
    if (p.key === "custom") {
        next.set("from", p.from);
        next.set("to", p.to);
    } else {
        next.delete("from");
        next.delete("to");
    }
    return next;
};

/** Loads one section of a page; a failing section shows its own error, the rest of the page still works. */
export function useSection(loader, deps) {
    const [state, setState] = useState({ loading: true, data: null, error: null });
    const run = useCallback(() => {
        let live = true;
        setState((s) => ({ ...s, loading: true, error: null }));
        loader()
            .then((data) => live && setState({ loading: false, data, error: null }))
            .catch((err) => live && setState({ loading: false, data: null, error: getErrorMessage(err, "Could not load") }));
        return () => {
            live = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
    useEffect(() => run(), [run]);
    return [state, run];
}

/**
 * Branch colours for comparisons: 8 categorical slots in fixed order, assigned by the branch's position in the
 * selection (validate_palette.js, light: all checks pass; some slots are below 3:1 on white, so every chart using
 * them also has a legend and a table view). There is no limit on branches: from the 9th on the colours repeat
 * with a dashed line (BRANCH_DASHES), so no two branches look the same.
 */
export const BRANCH_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#8b62d9", "#16a3b8", "#a35a2a"];
/** Line style per round of 8 branches: solid, dashed, dotted, long dash. */
export const BRANCH_DASHES = [undefined, "6 4", "2 3", "10 4"];
/** {color, dash} for the branch at this position of the selection. */
export const branchStyle = (index) => ({
    color: BRANCH_COLORS[index % BRANCH_COLORS.length],
    dash: BRANCH_DASHES[Math.floor(index / BRANCH_COLORS.length) % BRANCH_DASHES.length],
});
/** Legend line swatch background: solid colour, or the dash pattern drawn as a gradient. */
export const swatchBackground = ({ color, dash }) => {
    if (!dash) return color;
    const [on, off] = dash.split(" ").map(Number);
    return `repeating-linear-gradient(90deg, ${color} 0 ${on}px, transparent ${on}px ${on + off}px)`;
};
