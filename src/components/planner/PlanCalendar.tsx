import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { EASE_OUT, SPRING } from "../motion";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { localIsoDate } from "../../lib/dashboard";
import { bySchedule, PRIORITY, priorityOf, statusOf, type PlannerData } from "./shared";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfWeek(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
}

export function PlanCalendar({ plans, sessions, onOpen }: PlannerData) {
  const today = localIsoDate(new Date());
  const [mode, setMode] = useState<"month" | "week">("month");
  const [anchor, setAnchor] = useState(() => new Date());

  const days: { iso: string; inMonth: boolean }[] = [];
  if (mode === "month") {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = startOfWeek(first);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    for (let d = new Date(start); d <= last || d.getDay() !== 0; d.setDate(d.getDate() + 1)) {
      days.push({ iso: localIsoDate(d), inMonth: d.getMonth() === anchor.getMonth() });
    }
  } else {
    const start = startOfWeek(anchor);
    for (let i = 0; i < 7; i++) days.push({ iso: localIsoDate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)), inMonth: true });
  }

  const [slide, setSlide] = useState(1);
  const shift = (n: number) => {
    setSlide(n);
    setAnchor(mode === "month" ? new Date(anchor.getFullYear(), anchor.getMonth() + n, 1) : new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 7 * n));
  };
  const on = (iso: string) => sessions.filter((s) => s.scheduled_for === iso).sort(bySchedule);
  const exams = (iso: string) => plans.filter((p) => p.exam_date === iso);

  const chip = (s: (typeof sessions)[number], withMinutes = false) => {
    const done = ["completed", "skipped"].includes(statusOf(s));
    return (
      <button
        key={s.id}
        onClick={() => onOpen(s)}
        title={s.title}
        className={`flex w-full items-center gap-1 truncate rounded-[2px] border-l-[3px] bg-accent-50/70 px-1.5 py-1 text-left text-xs font-medium text-accent-700 hover:bg-accent-50 dark:bg-accent-500/10 dark:text-accent-300 ${PRIORITY[priorityOf(s)].border} ${done ? "line-through opacity-50" : ""}`}
      >
        <span className="truncate">{s.title}</span>
        {withMinutes && <span className="ml-auto shrink-0 opacity-70">{s.duration_minutes}m</span>}
      </button>
    );
  };

  return (
    <section className="dot-card overflow-hidden">
      <span className="dots" />
      <header className="flex flex-wrap items-center gap-4 border-b border-neutral-200 px-6 py-5 dark:border-[#2e2e33]">
        <CalendarDays className="size-5 text-accent-500" />
        <h2 className="text-xl font-bold">
          {mode === "month"
            ? anchor.toLocaleString("en-US", { month: "long", year: "numeric" })
            : `Week of ${startOfWeek(anchor).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
        </h2>
        <div className="flex items-center rounded-[2px] border border-neutral-200 dark:border-[#2e2e33]">
          <button onClick={() => shift(-1)} aria-label="Previous" className="grid size-8 place-items-center hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <ChevronLeft className="size-4" />
          </button>
          <button onClick={() => setAnchor(new Date())} className="px-2 text-xs font-medium">
            Today
          </button>
          <button onClick={() => shift(1)} aria-label="Next" className="grid size-8 place-items-center hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="ml-auto flex rounded-[2px] border border-neutral-200 p-1 dark:border-[#2e2e33]">
          {(["month", "week"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`relative rounded-[2px] px-4 py-1.5 text-xs font-bold tracking-wider uppercase transition-colors ${mode === m ? "text-white" : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"}`}
            >
              {mode === m && <motion.span layoutId="calendar-mode" transition={SPRING} className="absolute inset-0 rounded-[2px] bg-neutral-950 dark:bg-accent-500" aria-hidden />}
              <span className="relative">{m}</span>
            </button>
          ))}
        </div>
      </header>

      <AnimatePresence mode="wait" initial={false} custom={slide}>
      <motion.div
        key={mode + days[0]?.iso}
        custom={slide}
        initial={{ opacity: 0, x: slide * 24 }}
        animate={{ opacity: 1, x: 0, transition: { duration: 0.25, ease: EASE_OUT } }}
        exit={{ opacity: 0, x: slide * -16, transition: { duration: 0.12 } }}
        className="grid grid-cols-7 gap-2 p-4"
      >
        {DOW.map((d) => (
          <span key={d} className="pb-1 text-center text-xs font-bold tracking-wider text-neutral-500 uppercase">
            {d}
          </span>
        ))}
        {days.map(({ iso, inMonth }) => {
          const list = on(iso);
          const examPlans = exams(iso);
          const isToday = iso === today;
          return (
            <div
              key={iso}
              className={`flex flex-col gap-1 rounded-[2px] border p-2 ${mode === "month" ? "min-h-28" : "min-h-56"} ${
                isToday ? "border-accent-500 bg-accent-50/40 dark:bg-accent-500/10" : "border-neutral-200 dark:border-[#2e2e33]"
              } ${inMonth ? "" : "opacity-40"}`}
            >
              <span className="flex items-center justify-between">
                <span className={`grid size-7 place-items-center rounded-full text-sm font-bold ${isToday ? "bg-accent-500 text-white" : ""}`}>{Number(iso.slice(8))}</span>
                {isToday && <span className="size-1.5 rounded-full bg-accent-500" />}
              </span>
              {examPlans.length > 0 && (
                <>
                  <span className="text-[11px] font-bold tracking-wide text-red-500 uppercase">🎯 Exam day</span>
                  {examPlans.map((p) => (
                    <span key={p.id} className="truncate rounded-[2px] bg-red-500/10 px-1.5 py-1 text-xs font-medium text-red-600 dark:text-red-400" title={p.title}>
                      📚 {p.title}
                    </span>
                  ))}
                </>
              )}
              {mode === "month" ? (
                <>
                  {list.slice(0, 3).map((s) => chip(s))}
                  {list.length > 3 && <span className="text-[11px] text-neutral-500">+{list.length - 3} more</span>}
                </>
              ) : list.length ? (
                list.map((s) => chip(s, true))
              ) : (
                <span className="mt-2 text-center text-xs text-neutral-400">No sessions</span>
              )}
            </div>
          );
        })}
      </motion.div>
      </AnimatePresence>
    </section>
  );
}
