// Study plans: creating a plan with its scheduled sessions, session status changes, pausing and deleting.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { localIsoDate, type StudySessionRow } from "./dashboard";
import { callFunction, type ChapterRow } from "./ai";
import { buildSchedule, type TimeSlot } from "./schedule";

export type SessionStatus = "todo" | "in_progress" | "completed" | "skipped";

function unwrap<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export type NewPlan = {
  title: string;
  examDate: string;
  /** PDFs the plan covers; the first is stored as the plan's main document. */
  documentIds: string[];
  chapters: ChapterRow[];
  minutesPerDay: number;
  slots: TimeSlot[];
};

/** Schedules from today; the same function previews the plan in the wizard. */
export function previewSchedule(p: Pick<NewPlan, "chapters" | "examDate" | "minutesPerDay" | "slots">) {
  return buildSchedule({
    chapters: p.chapters.map((c) => ({ id: c.id, title: c.title, pages: c.end_page - c.start_page + 1, startPage: c.start_page })),
    today: localIsoDate(new Date()),
    examDate: p.examDate,
    minutesPerDay: p.minutesPerDay,
    slots: p.slots,
  });
}

export type CreateProgress = "scheduling" | "saving" | "tips" | "done";

export function usePlannerMutations() {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["study_plans"] });
    void qc.invalidateQueries({ queryKey: ["study_sessions"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const createPlan = useMutation({
    mutationFn: async ({ plan: p, onProgress }: { plan: NewPlan; onProgress?: (s: CreateProgress) => void }) => {
      onProgress?.("scheduling");
      const schedule = previewSchedule(p);
      if (!schedule.ok) throw new Error(schedule.error);
      onProgress?.("saving");
      const plan = unwrap(
        await supabase
          .from("study_plans")
          .insert({
            title: p.title,
            exam_date: p.examDate,
            document_id: p.documentIds[0] ?? null,
            minutes_per_day: p.minutesPerDay,
            preferred_slots: p.slots,
          })
          .select("id")
          .single(),
      );
      if (!plan) throw new Error("The plan was not saved.");
      try {
        unwrap(await supabase.from("study_plan_chapters").insert(p.chapters.map((c) => ({ plan_id: plan.id, chapter_id: c.id }))));
        unwrap(await supabase.from("study_sessions").insert(schedule.sessions.map((s) => ({ ...s, plan_id: plan.id }))));
        unwrap(await supabase.from("activity_events").insert({ kind: "plan", document_id: p.documentIds[0] ?? null }));
      } catch (err) {
        // Roll back: deleting the plan cascades to its chapters and sessions.
        await supabase.from("study_plans").delete().eq("id", plan.id);
        throw err;
      }
      // AI-written tips are a bonus: the plan is complete with template text if this fails.
      onProgress?.("tips");
      let tipsError: string | null = null;
      try {
        await callFunction("plan-tips", { plan_id: plan.id });
      } catch (err) {
        tipsError = err instanceof Error ? err.message : String(err);
      }
      onProgress?.("done");
      return { planId: plan.id, tipsError };
    },
    onSettled: refresh,
  });

  /**
   * Moves a session to a status. Entering "completed" logs its minutes as study time linked to the
   * session; leaving "completed" removes exactly that entry, so toggling never double-counts.
   */
  const setStatus = useMutation({
    mutationFn: async ({ session, status, documentId }: { session: StudySessionRow; status: SessionStatus; documentId: string | null }) => {
      if (session.status === status) return;
      const completing = status === "completed";
      unwrap(
        await supabase
          .from("study_sessions")
          .update({ status, completed_at: completing ? new Date().toISOString() : null })
          .eq("id", session.id),
      );
      if (completing) {
        unwrap(
          await supabase
            .from("activity_events")
            .insert({ kind: "study", document_id: documentId, minutes: session.duration_minutes, session_id: session.id }),
        );
      } else if (session.status === "completed") {
        unwrap(await supabase.from("activity_events").delete().eq("session_id", session.id));
      }
    },
    onSettled: refresh,
  });

  const deleteSession = useMutation({
    mutationFn: async (sessionId: string) => unwrap(await supabase.from("study_sessions").delete().eq("id", sessionId)),
    onSettled: refresh,
  });

  const setPlanPaused = useMutation({
    mutationFn: async ({ planId, paused }: { planId: string; paused: boolean }) =>
      unwrap(await supabase.from("study_plans").update({ status: paused ? "paused" : "active" }).eq("id", planId)),
    onSettled: refresh,
  });

  const deletePlan = useMutation({
    mutationFn: async (planId: string) => unwrap(await supabase.from("study_plans").delete().eq("id", planId)),
    onSettled: refresh,
  });

  return { createPlan, setStatus, deleteSession, setPlanPaused, deletePlan };
}
