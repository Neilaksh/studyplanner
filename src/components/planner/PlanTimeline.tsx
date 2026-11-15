import { Clock } from "lucide-react";
import { localIsoDate } from "../../lib/dashboard";
import { ACTIVITY, ActivityTile, activityOf, bySchedule, formatTime, parseDate, PriorityPill, statusOf, type PlannerData } from "./shared";

function dayLabel(iso: string, today: string) {
  const diff = Math.round((parseDate(iso).getTime() - parseDate(today).getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return parseDate(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function dayStatus(list: PlannerData["sessions"]) {
  const done = list.filter((s) => ["completed", "skipped"].includes(statusOf(s))).length;
  if (done === list.length) return "Completed";
  if (done === 0 && list.every((s) => statusOf(s) === "todo")) return "Not started";
  return `${done} of ${list.length} done`;
}

export function PlanTimeline({ sessions, onOpen }: PlannerData) {
  const today = localIsoDate(new Date());
  const days = [...new Set([...sessions].sort(bySchedule).map((s) => s.scheduled_for))];
  if (days.length === 0) return <p className="py-16 text-center text-neutral-500">No sessions scheduled.</p>;
  let side = 0;

  return (
    <section className="relative mx-auto max-w-5xl py-4">
      <span className="absolute top-0 bottom-0 left-6 w-px bg-accent-500/40 md:left-1/2" aria-hidden />
      {days.map((day) => {
        const list = sessions.filter((s) => s.scheduled_for === day).sort(bySchedule);
        const date = parseDate(day);
        return (
          <div key={day} className="relative mb-6">
            <div className="flex items-center gap-4 md:grid md:grid-cols-[1fr_auto_1fr]">
              <div className="hidden text-right md:block">
                <p className="text-2xl font-bold">{dayLabel(day, today)}</p>
                <p className="text-neutral-500">{date.toLocaleDateString("en-US", { weekday: "long" })}</p>
              </div>
              <div className="surface relative z-10 grid w-14 place-items-center rounded-[2px] border border-neutral-200 py-2 dark:border-[#2e2e33]">
                <span className="text-xl leading-none font-bold">{date.getDate()}</span>
                <span className="text-xs text-neutral-500">{date.toLocaleDateString("en-US", { month: "short" })}</span>
              </div>
              <div>
                <p className="font-semibold md:text-lg">
                  <span className="md:hidden">{dayLabel(day, today)} · </span>
                  {list.length} session{list.length === 1 ? "" : "s"}
                </p>
                <p className="text-sm text-neutral-500">{dayStatus(list)}</p>
              </div>
            </div>
            {list.map((s) => {
              const left = side++ % 2 === 0;
              const done = ["completed", "skipped"].includes(statusOf(s));
              return (
                <div key={s.id} className={`relative mt-5 pl-16 md:w-1/2 md:pl-0 ${left ? "md:pr-12" : "md:ml-auto md:pl-12"}`}>
                  <span
                    className={`absolute top-1/2 left-[18px] z-10 size-4 -translate-y-1/2 rounded-full border-2 border-accent-500 bg-white md:left-auto dark:bg-[#1c1c1f] ${left ? "md:-right-2" : "md:-left-2"}`}
                    aria-hidden
                  />
                  <button onClick={() => onOpen(s)} className={`dot-card block w-full p-5 text-left transition-shadow hover:shadow-md ${done ? "opacity-60" : ""}`}>
                    <span className="dots" />
                    <span className="flex items-center gap-3">
                      <ActivityTile s={s} />
                      <span>
                        <span className="block text-xs font-bold tracking-wide text-neutral-500 uppercase">{ACTIVITY[activityOf(s)].label}</span>
                        <span className="mt-0.5 flex items-center gap-2">
                          <PriorityPill s={s} />
                          {formatTime(s.start_time) && <span className="text-xs text-neutral-500">{formatTime(s.start_time)}</span>}
                        </span>
                      </span>
                    </span>
                    <span className={`mt-3 block text-lg font-bold ${done ? "line-through" : ""}`}>{s.title}</span>
                    {s.description && <span className="mt-1 line-clamp-2 block text-neutral-500">{s.description}</span>}
                    <span className="mt-3 flex items-center gap-1.5 border-t border-neutral-200 pt-3 text-sm text-neutral-500 dark:border-[#2e2e33]">
                      <Clock className="size-4" /> {s.duration_minutes} min
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}
