import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SPRING } from "../motion";
import { CheckCircle2, Clock, Pause, Play, type LucideIcon } from "lucide-react";
import type { StudySessionRow } from "../../lib/dashboard";
import type { SessionStatus } from "../../lib/planner";
import { ACTIVITY, activityOf, bySchedule, PRIORITY, priorityOf, shortDate, statusOf, type PlannerData, type Priority } from "./shared";

type GroupBy = "status" | "priority" | "date";
type Column = { key: string; title: string; icon?: LucideIcon; tint: string; items: StudySessionRow[]; status?: SessionStatus };

const STATUS_COLUMNS: { status: SessionStatus; title: string; icon: LucideIcon; tint: string }[] = [
  { status: "todo", title: "To Do", icon: Clock, tint: "" },
  { status: "in_progress", title: "In Progress", icon: Play, tint: "bg-accent-500/10" },
  { status: "completed", title: "Completed", icon: CheckCircle2, tint: "bg-green-500/10" },
  { status: "skipped", title: "Skipped", icon: Pause, tint: "bg-neutral-500/10" },
];

function Card({ s, onOpen, draggable }: { s: StudySessionRow; onOpen: () => void; draggable: boolean }) {
  const a = ACTIVITY[activityOf(s)];
  const p = PRIORITY[priorityOf(s)];
  const Icon = a.icon;
  return (
    <button
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData("text/session-id", s.id)}
      onClick={onOpen}
      className={`lift w-full rounded-[2px] border border-l-4 border-neutral-200 bg-white p-4 text-left shadow-sm dark:border-[#2e2e33] dark:bg-[#1c1c1f] ${p.border} ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <span className="flex items-center gap-2 text-[11px] font-bold tracking-wide text-neutral-500 uppercase">
        <Icon className="size-3.5" /> {p.label}
      </span>
      <span className="mt-2 block font-semibold">{s.title}</span>
      {s.description && <span className="mt-1 line-clamp-2 block text-sm text-neutral-500">{s.description}</span>}
      <span className="mt-3 flex items-center justify-between text-xs text-neutral-500">
        <span className="flex items-center gap-1">
          <Clock className="size-3.5" /> {s.duration_minutes} min
        </span>
        <span>{shortDate(s.scheduled_for)}</span>
      </span>
    </button>
  );
}

export function PlanBoard({ sessions, onOpen, onMove }: PlannerData & { onMove: (s: StudySessionRow, status: SessionStatus) => void }) {
  const [group, setGroup] = useState<GroupBy>("status");
  const [over, setOver] = useState<string | null>(null);
  const sorted = [...sessions].sort(bySchedule);

  const columns: Column[] =
    group === "status"
      ? STATUS_COLUMNS.map((c) => ({ key: c.status, title: c.title, icon: c.icon, tint: c.tint, status: c.status, items: sorted.filter((s) => statusOf(s) === c.status) }))
      : group === "priority"
        ? (["high", "medium", "low"] as Priority[]).map((p) => ({ key: p, title: PRIORITY[p].label, tint: "", items: sorted.filter((s) => priorityOf(s) === p) }))
        : [...new Set(sorted.map((s) => s.scheduled_for))].map((d) => ({ key: d, title: shortDate(d), tint: "", items: sorted.filter((s) => s.scheduled_for === d) }));

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Study Sessions</h2>
        <div className="flex rounded-[2px] border border-neutral-200 p-1 dark:border-[#2e2e33]">
          {(["status", "priority", "date"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGroup(g)}
              className={`relative rounded-[2px] px-4 py-1.5 text-xs font-bold tracking-wider uppercase transition-colors ${group === g ? "text-white" : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"}`}
            >
              {group === g && <motion.span layoutId="board-group" transition={SPRING} className="absolute inset-0 rounded-[2px] bg-neutral-950 dark:bg-accent-500" aria-hidden />}
              <span className="relative">{g}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="thin-scroll flex gap-4 overflow-x-auto pb-3">
        {columns.map((c) => {
          const droppable = !!c.status;
          const Icon = c.icon;
          return (
            <div
              key={c.key}
              onDragOver={(e) => {
                if (!droppable) return;
                e.preventDefault();
                setOver(c.key);
              }}
              onDragLeave={() => setOver((o) => (o === c.key ? null : o))}
              onDrop={(e) => {
                setOver(null);
                const id = e.dataTransfer.getData("text/session-id");
                const s = sessions.find((x) => x.id === id);
                if (s && c.status) onMove(s, c.status);
              }}
              className={`flex w-80 shrink-0 flex-col rounded-[2px] border border-neutral-200 transition-[box-shadow,background-color] duration-200 dark:border-[#2e2e33] ${over === c.key ? "bg-accent-50/40 ring-2 ring-accent-500 dark:bg-accent-500/5" : ""}`}
            >
              <header className={`flex items-center gap-2 border-b border-neutral-200 px-4 py-3.5 dark:border-[#2e2e33] ${c.tint}`}>
                {Icon && <Icon className="size-4" />}
                <span className="flex-1 font-bold">{c.title}</span>
                <span className="rounded-[2px] bg-neutral-100 px-1.5 text-xs tabular-nums dark:bg-[#2a2a2e]">{c.items.length}</span>
              </header>
              <div className="flex min-h-40 flex-col gap-3 p-3">
                <AnimatePresence initial={false}>
                  {c.items.map((s) => (
                    <motion.div
                      key={s.id}
                      layout
                      layoutId={`board-${s.id}`}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={SPRING}
                    >
                      <Card s={s} onOpen={() => onOpen(s)} draggable={group === "status"} />
                    </motion.div>
                  ))}
                </AnimatePresence>
                {c.items.length === 0 && <span className="grid flex-1 place-items-center text-sm text-neutral-400">{droppable ? "Drop here" : "Nothing here"}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
