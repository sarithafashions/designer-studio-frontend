// Excel (.xlsx) export of a table, made in the browser with SheetJS (already a dependency; loaded only on export).
//
// exportXlsx({ fileName, title, filters, columns, rows })
//   columns: [{ header, value: (row) => any, type: "text" | "money" | "number" | "date" | "datetime", width }]
//   filters: [[label, value], ...] — the filters in use, printed above the table (empty values left out)
// The sheet has a title, the filters, "Exported on …", then the table with an auto-filter on the header row and
// a total under every money column. Money uses Indian grouping with ₹; dates are real Excel dates (sortable).
//
// fetchAllPages(fetchPage) collects every page of a paged API ({content, totalPages, lastPage}) so the export holds
// ALL rows matching the filters, not only the page on screen.

const MONEY_FORMAT = '[>=10000000]"₹"##\\,##\\,##\\,##0.00;[>=100000]"₹"##\\,##\\,##0.00;"₹"##,##0.00';
const NUMBER_FORMAT = "#,##0.##";
const DATE_FORMAT = "dd-mmm-yyyy";
const DATETIME_FORMAT = "dd-mmm-yyyy hh:mm AM/PM";
const MAX_ROWS = 50000;

/** Every row of a paged list (100 per request), up to MAX_ROWS. fetchPage({pageNumber, pageSize}) -> page. */
export async function fetchAllPages(fetchPage, pageSize = 100) {
    const rows = [];
    for (let pageNumber = 0; ; pageNumber++) {
        const page = await fetchPage({ pageNumber, pageSize });
        const content = Array.isArray(page) ? page : page?.content || [];
        rows.push(...content);
        const lastPage = Array.isArray(page) || page?.lastPage || content.length < pageSize || pageNumber + 1 >= (page?.totalPages ?? 0);
        if (lastPage || rows.length >= MAX_ROWS) return rows;
    }
}

/** "SarithaFashions_Invoices_Pending_2026-11-24.xlsx" (parts made file-safe, blanks left out). */
export function exportFileName(...parts) {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // yyyy-mm-dd
    const safe = ["SarithaFashions", ...parts, today]
        .filter((p) => p !== undefined && p !== null && String(p).trim() !== "")
        .map((p) => String(p).trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-"));
    return `${safe.join("_")}.xlsx`;
}

const toDate = (value) => {
    if (value === null || value === undefined || value === "") return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    // "yyyy-mm-dd" is a calendar day: keep it on that day in the sheet
    const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
    const date = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * The Excel date number of the browser's (IST) wall-clock time. Computed here rather than by SheetJS, whose own
 * conversion is a few seconds off in IST (it applies the historical 1899 offset).
 */
const excelSerial = (date, dayOnly) => {
    const wall = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(),
        dayOnly ? 0 : date.getHours(), dayOnly ? 0 : date.getMinutes(), dayOnly ? 0 : date.getSeconds());
    return (wall - Date.UTC(1899, 11, 30)) / 86400000;
};

const cellValue = (column, row) => {
    let value;
    try {
        value = column.value(row);
    } catch {
        value = null;
    }
    if (value === undefined || value === null || value === "") return null;
    switch (column.type) {
        case "money":
        case "number": {
            const n = Number(value);
            return Number.isFinite(n) ? n : String(value);
        }
        case "date":
        case "datetime": {
            const date = toDate(value);
            return date ? excelSerial(date, column.type === "date") : String(value);
        }
        default:
            return Array.isArray(value) ? value.join(", ") : String(value);
    }
};

/** Builds the workbook and downloads it. @returns {Promise<string>} the file name */
export async function exportXlsx({ fileName, sheetName = "Data", title, filters = [], columns, rows }) {
    const XLSX = await import("xlsx");
    const exportedAt = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
    const filterText = filters
        .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
        .map(([k, v]) => `${k}: ${v}`)
        .join("  ·  ");

    const head = [[title || sheetName], [filterText ? `Filters: ${filterText}` : "Filters: none"],
        [`Exported on ${exportedAt} · ${rows.length} ${rows.length === 1 ? "row" : "rows"}`], []];
    const headerRow = head.length; // 0-based row index of the column headers
    const body = rows.map((row) => columns.map((c) => cellValue(c, row)));
    const aoa = [...head, columns.map((c) => c.header), ...body];

    const moneyCols = columns.map((c, i) => (c.type === "money" ? i : -1)).filter((i) => i >= 0);
    const totalRow = moneyCols.length && body.length ? aoa.length : -1;
    if (totalRow >= 0) aoa.push(columns.map((_, i) => (i === 0 ? "Total" : null)));

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const firstData = headerRow + 1;
    const lastData = headerRow + body.length;
    columns.forEach((c, col) => {
        const z = { money: MONEY_FORMAT, number: NUMBER_FORMAT, date: DATE_FORMAT, datetime: DATETIME_FORMAT }[c.type];
        if (!z) return;
        for (let r = firstData; r <= lastData; r++) {
            const cell = ws[XLSX.utils.encode_cell({ r, c: col })];
            if (cell && cell.t !== "s") cell.z = z;
        }
    });
    if (totalRow >= 0) {
        moneyCols.forEach((col) => {
            const from = XLSX.utils.encode_cell({ r: firstData, c: col });
            const to = XLSX.utils.encode_cell({ r: lastData, c: col });
            const total = body.reduce((sum, row) => sum + (typeof row[col] === "number" ? row[col] : 0), 0);
            ws[XLSX.utils.encode_cell({ r: totalRow, c: col })] = { t: "n", f: `SUM(${from}:${to})`, v: total, z: MONEY_FORMAT };
        });
    }
    ws["!cols"] = columns.map((c, i) => {
        if (c.width) return { wch: c.width };
        const shown = { date: 12, datetime: 20 }[c.type];
        const longest = Math.max(String(c.header).length,
            ...body.slice(0, 500).map((row) => (shown && typeof row[i] === "number" ? shown : String(row[i] ?? "").length)));
        return { wch: Math.min(48, Math.max(c.type === "money" ? 15 : 10, longest + (c.type === "money" ? 6 : 2))) };
    });
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: headerRow, c: 0 }, e: { r: Math.max(lastData, headerRow), c: columns.length - 1 } }) };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31).replace(/[\\/?*[\]:]/g, "-"));
    XLSX.writeFile(wb, fileName, { compression: true });
    return fileName;
}
