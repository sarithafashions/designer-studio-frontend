// Date input shown as dd-mm-yyyy (the browser's own date input follows the computer's region, e.g. mm/dd/yyyy).
// Value in / out stays "yyyy-MM-dd" ("" = empty) so the API code does not change. Calendar weeks start on Monday.
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { FiCalendar } from "react-icons/fi";

// Calendar days only: build local dates from the parts so no time zone can shift the day.
const toDate = (ymd) => {
    if (!ymd) return null;
    const [y, m, d] = String(ymd).slice(0, 10).split("-").map(Number);
    return y && m && d ? new Date(y, m - 1, d) : null;
};
const toYmd = (date) =>
    date
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
        : "";

/**
 * @param value     "yyyy-MM-dd" or ""
 * @param onChange  called with "yyyy-MM-dd" or "" (cleared)
 * @param min, max  "yyyy-MM-dd" limits (optional)
 * @param clearable show a clear (×) button
 */
export default function DateField({
    id, value, onChange, min, max, invalid, disabled, clearable, ariaLabel, placeholder = "dd-mm-yyyy", className = "",
}) {
    return (
        <DatePicker
            id={id}
            selected={toDate(value)}
            onChange={(date) => onChange(toYmd(date))}
            minDate={toDate(min)}
            maxDate={toDate(max)}
            dateFormat="dd-MM-yyyy"
            placeholderText={placeholder}
            calendarStartDay={1}
            disabled={disabled}
            isClearable={clearable && !disabled}
            showPopperArrow={false}
            showIcon
            icon={<FiCalendar aria-hidden />}
            toggleCalendarOnIconClick
            popperPlacement="bottom-start"
            portalId="so-datepicker-portal"
            wrapperClassName={`so-datefield ${className}`}
            calendarClassName="so-calendar"
            popperClassName="so-calendar-popper"
            clearButtonClassName="so-date-clear"
            autoComplete="off"
            customInput={
                <input
                    className="so-input"
                    aria-label={ariaLabel}
                    aria-invalid={invalid ? "true" : undefined}
                    inputMode="numeric"
                />
            }
        />
    );
}
