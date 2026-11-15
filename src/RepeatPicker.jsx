const DAYS = [
  { id: 1, label: "M", name: "Monday" },
  { id: 2, label: "T", name: "Tuesday" },
  { id: 3, label: "W", name: "Wednesday" },
  { id: 4, label: "T", name: "Thursday" },
  { id: 5, label: "F", name: "Friday" },
  { id: 6, label: "S", name: "Saturday" },
  { id: 0, label: "S", name: "Sunday" },
];

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export default function RepeatPicker({
  value,
  onChange,
  inCalendar = false,
  selectedDate = "",
}) {
  const selectedObj = selectedDate
    ? new Date(`${selectedDate}T00:00:00`)
    : new Date();
  const calDayOfMonth = selectedObj.getDate();
  const calWeekdayName = WEEKDAY_NAMES[selectedObj.getDay()];

  const switchMode = (newType) => {
    if (newType === "none") {
      onChange({
        type: "none",
        date: selectedDate || value.date,
        time: value.time,
        daysOfWeek: [],
        daysOfMonth: [],
        lastDayOfMonth: false,
      });
    } else if (newType === "weekly") {
      onChange({
        type: "weekly",
        date: value.date,
        time: value.time,
        daysOfWeek: value.daysOfWeek?.length
          ? value.daysOfWeek
          : [selectedObj.getDay()],
        daysOfMonth: [],
        lastDayOfMonth: false,
      });
    } else if (newType === "monthly") {
      onChange({
        type: "monthly",
        date: value.date,
        time: value.time,
        daysOfWeek: [],
        daysOfMonth: value.daysOfMonth?.length
          ? value.daysOfMonth
          : [calDayOfMonth],
        lastDayOfMonth: false,
      });
    }
  };

  const toggleWeekDay = (d) => {
    const current = value.daysOfWeek || [];
    const next = current.includes(d)
      ? current.length > 1
        ? current.filter((x) => x !== d)
        : current
      : [...current, d];
    onChange({ ...value, daysOfWeek: next });
  };

  const toggleMonthDay = (d) => {
    const current = value.daysOfMonth || [];
    const exists = current.includes(d);
    if (exists && current.length === 1 && !value.lastDayOfMonth) return;
    const next = exists ? current.filter((x) => x !== d) : [...current, d];
    onChange({ ...value, daysOfMonth: next });
  };

  const sortedMonthDays = [...(value.daysOfMonth || [])].sort((a, b) => a - b);
  const monthlyParts = sortedMonthDays.map(ordinal);
  if (value.lastDayOfMonth) monthlyParts.push("last day");

  const activeDateStr = inCalendar ? selectedDate : value.date;
  const isOnceInPast =
    value.type === "none" &&
    activeDateStr &&
    new Date(`${activeDateStr}T${value.time || "09:00"}:00`).getTime() <=
      Date.now();

  return (
    <div
      className={`p-2.5 rounded-lg border space-y-2 transition-colors ${
        isOnceInPast
          ? "border-red-500/60 bg-red-500/10"
          : "border-current/15 bg-black/5"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider opacity-80">
          Type
        </span>
        <div
          role="group"
          aria-label="Reminder frequency"
          className="grid grid-cols-3 bg-black/10 p-0.5 rounded-md w-52"
        >
          {[
            { id: "none", label: "Once" },
            { id: "weekly", label: "Weekly" },
            { id: "monthly", label: "Monthly" },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={value.type === m.id}
              onClick={() => switchMode(m.id)}
              className={`text-xs font-semibold py-1 rounded transition ${
                value.type === m.id
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "opacity-80 hover:opacity-100"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {value.type === "none" && !inCalendar && (
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs font-bold uppercase opacity-80">
              Date
              <input
                type="date"
                value={value.date}
                onChange={(e) => onChange({ ...value, date: e.target.value })}
                className={`px-2 py-1 rounded border bg-white/90 text-slate-900 text-xs ${
                  isOnceInPast
                    ? "border-red-500 ring-1 ring-red-500"
                    : "border-current/20"
                }`}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold uppercase opacity-80">
              Time
              <input
                type="time"
                value={value.time}
                onChange={(e) => onChange({ ...value, time: e.target.value })}
                className={`px-2 py-1 rounded border bg-white/90 text-slate-900 text-xs ${
                  isOnceInPast
                    ? "border-red-500 ring-1 ring-red-500"
                    : "border-current/20"
                }`}
              />
            </label>
          </div>
          {isOnceInPast && (
            <div
              role="alert"
              className="text-xs text-red-600 font-semibold flex items-center gap-1"
            >
              <span>⚠️</span>
              <span>Selected date &amp; time has already passed.</span>
            </div>
          )}
        </div>
      )}

      {value.type === "weekly" && (
        <div className="space-y-2">
          <div
            role="group"
            aria-label="Days of week"
            className="grid grid-cols-7 gap-1"
          >
            {DAYS.map((d) => {
              const active = (value.daysOfWeek || []).includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  aria-label={d.name}
                  aria-pressed={active}
                  onClick={() => toggleWeekDay(d.id)}
                  className={`h-8 rounded-full text-xs font-bold border transition ${
                    active
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "border-current/25 opacity-85 hover:opacity-100"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() =>
                  onChange({ ...value, daysOfWeek: [1, 2, 3, 4, 5] })
                }
                className="text-xs font-semibold px-2.5 py-1 rounded border border-current/20 hover:border-emerald-500"
              >
                Weekdays
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...value, daysOfWeek: [6, 0] })}
                className="text-xs font-semibold px-2.5 py-1 rounded border border-current/20 hover:border-emerald-500"
              >
                Weekends
              </button>
            </div>
            {!inCalendar && (
              <input
                type="time"
                aria-label="Reminder time"
                value={value.time}
                onChange={(e) => onChange({ ...value, time: e.target.value })}
                className="px-2 py-1 rounded border border-current/20 bg-white/90 text-slate-900 text-xs"
              />
            )}
          </div>
        </div>
      )}

      {value.type === "monthly" && inCalendar && (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-emerald-600">
              Every month on {monthlyParts.join(", ")}
            </span>
            <label className="flex items-center gap-1.5 cursor-pointer opacity-90 hover:opacity-100 shrink-0">
              <input
                type="checkbox"
                checked={value.lastDayOfMonth}
                onChange={(e) => {
                  const checked = e.target.checked;
                  const nextDays =
                    !checked && (value.daysOfMonth || []).length === 0
                      ? [calDayOfMonth]
                      : value.daysOfMonth;
                  onChange({
                    ...value,
                    lastDayOfMonth: checked,
                    daysOfMonth: nextDays,
                  });
                }}
                className="accent-emerald-600"
              />
              <span>Last day</span>
            </label>
          </div>
          <div className="text-xs opacity-75">
            Tap dates in the calendar above to add or remove days.
          </div>
        </div>
      )}

      {value.type === "monthly" && !inCalendar && (
        <div className="space-y-2">
          <div
            role="group"
            aria-label="Days of month"
            className="grid grid-cols-7 gap-1 p-1 rounded border border-current/15 bg-white/5"
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
              const active = (value.daysOfMonth || []).includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleMonthDay(day)}
                  className={`h-7 rounded text-xs font-semibold ${
                    active
                      ? "bg-emerald-600 text-white"
                      : "opacity-85 hover:bg-emerald-500/15"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              aria-pressed={value.lastDayOfMonth}
              onClick={() => {
                if (
                  value.lastDayOfMonth &&
                  (value.daysOfMonth || []).length === 0
                )
                  return;
                onChange({ ...value, lastDayOfMonth: !value.lastDayOfMonth });
              }}
              className={`text-xs font-semibold px-2.5 py-1 rounded border ${
                value.lastDayOfMonth
                  ? "bg-emerald-600/20 border-emerald-500 text-emerald-600"
                  : "border-current/20 opacity-85"
              }`}
            >
              Last day of month
            </button>
            <input
              type="time"
              aria-label="Reminder time"
              value={value.time}
              onChange={(e) => onChange({ ...value, time: e.target.value })}
              className="px-2 py-1 rounded border border-current/20 bg-white/90 text-slate-900 text-xs"
            />
          </div>
        </div>
      )}

      {value.type === "none" && inCalendar && (
        <div
          role={isOnceInPast ? "alert" : undefined}
          className={`text-xs flex items-center gap-1.5 ${
            isOnceInPast ? "text-red-600 font-semibold" : "opacity-80"
          }`}
        >
          <span>{isOnceInPast ? "⚠️" : "📅"}</span>
          <span>
            {isOnceInPast
              ? "This date has passed. Pick a future date or switch to Monthly/Weekly."
              : `One-time alert on ${calWeekdayName}, ${ordinal(calDayOfMonth)}`}
          </span>
        </div>
      )}
    </div>
  );
}
