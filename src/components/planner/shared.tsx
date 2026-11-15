// Shared look-up tables and small helpers for the planner views.
import { BookOpen, ClipboardCheck, FileText, GraduationCap, type LucideIcon } from "lucide-react";
import type { StudyPlanRow, StudySessionRow } from "../../lib/dashboard";
import type { SessionStatus } from "../../lib/planner";

export type Activity = "read" | "quiz" | "summary" | "review";
export type Priority = "high" | "medium" | "low";

export const ACTIVITY: Record<Activity, { label: string; icon: LucideIcon; tile: string }> = {
  read: { label: "Read", icon: BookOpen, tile: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400" },
  quiz: { label: "Quiz", icon: GraduationCap, tile: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400" },
  summary: { label: "Summary", icon: FileText, tile: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" },
  review: { label: "Review", icon: ClipboardCheck, tile: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" },
};

export const PRIORITY: Record<Priority, { label: string; pill: string; border: string }> = {
  high: { label: "High", pill: "bg-red-500/15 text-red-600 dark:text-red-400", border: "border-l-red-500" },
  medium: { label: "Medium", pill: "bg-amber-400/20 text-amber-700 dark:text-amber-300", border: "border-l-amber-400" },
  low: { label: "Low", pill: "bg-sky-500/15 text-sky-600 dark:text-sky-400", border: "border-l-sky-500" },
};

export const STATUS: Record<SessionStatus, { label: string; pill: string }> = {
  todo: { label: "Not Started", pill: "bg-neutral-100 text-neutral-600 dark:bg-[#2a2a2e] dark:text-neutral-300" },
  in_progress: { label: "In Progress", pill: "bg-accent-500/15 text-accent-600 dark:text-accent-400" },
  completed: { label: "Completed", pill: "bg-green-500/15 text-green-700 dark:text-green-400" },
  skipped: { label: "Skipped", pill: "bg-neutral-200 text-neutral-500 dark:bg-[#2a2a2e] dark:text-neutral-400" },
};

export const activityOf = (s: StudySessionRow) => (s.activity in ACTIVITY ? s.activity : "read") as Activity;
export const priorityOf = (s: StudySessionRow) => (s.priority in PRIORITY ? s.priority : "medium") as Priority;
export const statusOf = (s: StudySessionRow) => (s.status in STATUS ? s.status : "todo") as SessionStatus;

/** "14:30:00" → "2:30 PM". */
export function formatTime(t: string | null) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export const parseDate = (iso: string) => new Date(iso + "T00:00:00");
export const shortDate = (iso: string) => parseDate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
export const longDate = (iso: string) => parseDate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Sorts by date, then start time. */
export const bySchedule = (a: StudySessionRow, b: StudySessionRow) =>
  a.scheduled_for.localeCompare(b.scheduled_for) || (a.start_time ?? "99").localeCompare(b.start_time ?? "99");

export type PlannerData = {
  plans: StudyPlanRow[];
  sessions: StudySessionRow[];
  onOpen: (s: StudySessionRow) => void;
};

export function PriorityPill({ s }: { s: StudySessionRow }) {
  const p = PRIORITY[priorityOf(s)];
  return <span className={`rounded-[2px] px-1.5 py-0.5 text-[11px] font-bold uppercase ${p.pill}`}>{p.label}</span>;
}

export function ActivityTile({ s, size = "size-9" }: { s: StudySessionRow; size?: string }) {
  const a = ACTIVITY[activityOf(s)];
  const Icon = a.icon;
  return (
    <span className={`grid ${size} shrink-0 place-items-center rounded-[2px] ${a.tile}`}>
      <Icon className="size-4" />
    </span>
  );
}
