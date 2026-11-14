// Dashboard read models: stats, daily activity, plans and scheduled sessions.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type { Database } from "./database.types";

export type StudyPlanRow = Database["public"]["Tables"]["study_plans"]["Row"];
export type StudySessionRow = Database["public"]["Tables"]["study_sessions"]["Row"];

export type DashboardStats = {
  documents: number;
  quizzes: number;
  questions: number;
  avgScore: number | null;
  studyMinutes: number;
};

/** A dated item on the calendar: a study session or a plan's exam. */
export type CalendarEvent = { id: string; title: string; date: string; kind: "session" | "exam"; done: boolean };

function unwrap<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** Local calendar date as YYYY-MM-DD (the format Postgres `date` columns use). */
export function localIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: async (): Promise<DashboardStats> => {
      const raw = unwrap(await supabase.rpc("dashboard_stats"));
      const o = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
      return {
        documents: num(o.documents),
        quizzes: num(o.quizzes),
        questions: num(o.questions),
        avgScore: typeof o.avg_score === "number" ? o.avg_score : null,
        studyMinutes: num(o.study_minutes),
      };
    },
  });
}

/** Event counts per local day for the last ~53 weeks, keyed by YYYY-MM-DD. */
export function useActivityByDay() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return useQuery({
    queryKey: ["dashboard", "activity", tz],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 53 * 7);
      const rows = unwrap(await supabase.rpc("activity_by_day", { p_since: localIsoDate(since), p_tz: tz })) ?? [];
      return Object.fromEntries(rows.map((r) => [r.day, r.events])) as Record<string, number>;
    },
  });
}

export function useStudyPlans() {
  return useQuery({
    queryKey: ["study_plans"],
    queryFn: async () =>
      unwrap(await supabase.from("study_plans").select("*").order("exam_date", { ascending: true })) ?? [],
  });
}

export function useStudySessions() {
  return useQuery({
    queryKey: ["study_sessions"],
    queryFn: async () =>
      unwrap(await supabase.from("study_sessions").select("*").order("scheduled_for", { ascending: true })) ?? [],
  });
}

/** Sessions plus each plan's exam date, for the calendar and "Next Up". */
export function toCalendarEvents(plans: StudyPlanRow[], sessions: StudySessionRow[]): CalendarEvent[] {
  return [
    ...sessions.map((s) => ({ id: s.id, title: s.title, date: s.scheduled_for, kind: s.kind, done: !!s.completed_at })),
    ...plans.map((p) => ({ id: `exam-${p.id}`, title: `${p.title} exam`, date: p.exam_date, kind: "exam" as const, done: false })),
  ].sort((a, b) => a.date.localeCompare(b.date));
}
