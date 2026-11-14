import { useEffect, useMemo, useRef } from "react";
import { CalendarDays, Flame } from "lucide-react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LEVELS = [
  "bg-neutral-100 dark:bg-neutral-800",
  "bg-accent-200",
  "bg-accent-300",
  "bg-accent-400",
  "bg-accent-500",
];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function level(count: number) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

// Consecutive active days ending today, or ending yesterday if nothing is logged yet today.
function streak(activity: Record<string, number>, today: Date) {
  let n = 0;
  const d = new Date(today);
  if (!activity[iso(d)]) d.setDate(d.getDate() - 1);
  while ((activity[iso(d)] ?? 0) > 0) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function ActivityHeatmap({ activity }: { activity: Record<string, number> }) {
  const todayKey = new Date().toDateString();
  const today = useMemo(() => new Date(todayKey), [todayKey]);
  const scroller = useRef<HTMLDivElement>(null);

  // 53 week columns ending with the week containing today, Sunday-first.
  const weeks = useMemo(() => {
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const start = new Date(end);
    start.setDate(start.getDate() - end.getDay() - 52 * 7);
    const cols: { date: Date; inRange: boolean }[][] = [];
    const cur = new Date(start);
    for (let w = 0; w < 53; w++) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        col.push({ date: new Date(cur), inRange: cur <= end });
        cur.setDate(cur.getDate() + 1);
      }
      cols.push(col);
    }
    return cols;
  }, [today]);

  const total = Object.values(activity).reduce((a, b) => a + b, 0);
  const activeDays = Object.values(activity).filter((c) => c > 0).length;
  const currentStreak = streak(activity, today);

  useEffect(() => {
    scroller.current?.scrollTo({ left: scroller.current.scrollWidth });
  }, []);

  return (
    <section className="dot-card p-6">
      <span className="dots" />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-baseline gap-2">
          <CalendarDays className="size-5 self-center" />
          <span className="text-lg font-bold">{total} activity</span>
          <span className="text-neutral-500">in the last year</span>
        </h2>
        <div className="flex items-center gap-6 text-neutral-500">
          <span className="flex items-center gap-1.5">
            <Flame className="size-4 text-accent-500" />
            <b className="font-semibold text-neutral-900 dark:text-neutral-100">{currentStreak}</b> day streak
          </span>
          <span>
            <b className="font-semibold text-neutral-900 dark:text-neutral-100">{activeDays}</b> active days
          </span>
        </div>
      </header>

      <div ref={scroller} className="thin-scroll mt-5 overflow-x-auto pb-2">
        <div className="inline-flex flex-col gap-1">
          <div className="flex gap-[3px] text-xs text-neutral-500">
            {weeks.map((col, i) => {
              const first = col[0].date;
              const show = i === 0 || first.getMonth() !== weeks[i - 1][0].date.getMonth();
              return (
                <span key={i} className="w-3 overflow-visible whitespace-nowrap">
                  {show && i < 51 ? MONTHS[first.getMonth()] : ""}
                </span>
              );
            })}
          </div>
          <div className="flex gap-[3px]">
            {weeks.map((col, i) => (
              <div key={i} className="flex flex-col gap-[3px]">
                {col.map(({ date, inRange }) => {
                  const count = activity[iso(date)] ?? 0;
                  return (
                    <span
                      key={iso(date)}
                      title={inRange ? `${count} on ${date.toDateString()}` : undefined}
                      className={`size-3 rounded-[2px] ${inRange ? LEVELS[level(count)] : "invisible"}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="mt-3 flex items-center justify-end gap-1.5 text-xs text-neutral-500">
        Less
        {LEVELS.map((c) => (
          <span key={c} className={`size-3 rounded-[2px] ${c}`} />
        ))}
        More
      </footer>
    </section>
  );
}
