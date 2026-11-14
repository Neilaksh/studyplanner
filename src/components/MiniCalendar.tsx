import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { localIsoDate, type CalendarEvent } from "../lib/dashboard";

const DOW = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function MiniCalendar({ events, today = new Date() }: { events: CalendarEvent[]; today?: Date }) {
  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < first.getDay(); i++) {
    cells.push({ date: new Date(view.getFullYear(), view.getMonth(), i - first.getDay() + 1), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(view.getFullYear(), view.getMonth(), d), inMonth: true });
  while (cells.length % 7) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false });
  }

  // Dates are compared as local YYYY-MM-DD strings; an exam outranks a session on the same day.
  const kindOn = (d: Date) => {
    const onDay = events.filter((e) => e.date === localIsoDate(d));
    return onDay.some((e) => e.kind === "exam") ? "exam" : onDay.length ? "session" : undefined;
  };
  const shift = (n: number) => setView(new Date(view.getFullYear(), view.getMonth() + n, 1));

  return (
    <section className="dot-card p-6">
      <span className="dots" />
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-sm bg-neutral-100 dark:bg-neutral-800">
            <CalendarDays className="size-5" />
          </span>
          <h2 className="text-xl leading-tight font-bold">
            {view.toLocaleString("en-US", { month: "long" })}
            <br />
            {view.getFullYear()}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} aria-label="Previous month" className="grid size-8 place-items-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => setView(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="rounded px-2 py-1 text-[15px] hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Today
          </button>
          <button onClick={() => shift(1)} aria-label="Next month" className="grid size-8 place-items-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-7 gap-y-2 text-center">
        {DOW.map((d) => (
          <span key={d} className="pb-4 text-xs font-medium tracking-wide text-neutral-500">
            {d}
          </span>
        ))}
        {cells.map(({ date, inMonth }) => {
          const isToday = sameDay(date, today);
          const kind = kindOn(date);
          return (
            <button
              key={date.toISOString()}
              className={`relative mx-auto grid aspect-square w-full max-w-11 place-items-center rounded-sm text-[15px] ${
                isToday
                  ? "bg-neutral-950 font-bold text-white dark:bg-white dark:text-neutral-950"
                  : inMonth
                    ? "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    : "text-neutral-300 dark:text-neutral-700"
              }`}
            >
              {date.getDate()}
              {kind && (
                <span
                  className={`absolute bottom-1 size-1 rounded-full ${kind === "exam" ? "bg-red-500" : "bg-neutral-400"}`}
                />
              )}
            </button>
          );
        })}
      </div>

      <footer className="mt-5 flex justify-center gap-5 border-t border-neutral-200 pt-4 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-neutral-950 dark:bg-white" />Today</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-neutral-400" />Session</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-red-500" />Exam</span>
      </footer>
    </section>
  );
}
