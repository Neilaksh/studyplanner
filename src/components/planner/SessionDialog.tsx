// Session details with study actions: open the PDF, take a chapter quiz, read its summary, and status changes.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BookOpen, CalendarDays, CheckCircle2, Clock, ExternalLink, FastForward, FileText, GraduationCap, Loader2, RotateCcw, Trash2, X } from "lucide-react";
import { Markdown } from "../Markdown";
import { AnimatePresence } from "motion/react";
import { Backdrop, Collapse, Panel } from "../motion";
import { callFunction } from "../../lib/ai";
import type { StudySessionRow } from "../../lib/dashboard";
import { useDocuments, useLibraryMutations } from "../../lib/library";
import { usePlannerMutations } from "../../lib/planner";
import { supabase } from "../../lib/supabase";
import { navigate } from "../../router";
import { ACTIVITY, activityOf, formatTime, longDate, PriorityPill, STATUS, statusOf } from "./shared";

/** The chapter a session belongs to, with its document. */
function useChapter(chapterId: string | null) {
  return useQuery({
    queryKey: ["chapter", chapterId],
    enabled: !!chapterId,
    queryFn: async () => {
      const { data, error } = await supabase.from("document_chapters").select("id, title, document_id").eq("id", chapterId!).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

export function SessionDialog({ session, onClose }: { session: StudySessionRow; onClose: () => void }) {
  const chapter = useChapter(session.chapter_id);
  const docs = useDocuments();
  const { openDocument } = useLibraryMutations();
  const { setStatus, deleteSession } = usePlannerMutations();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const status = statusOf(session);
  const activity = ACTIVITY[activityOf(session)];
  const doc = docs.data?.find((d) => d.id === chapter.data?.document_id) ?? null;
  const hasChapter = !!chapter.data && !!doc;
  const time = formatTime(session.start_time);

  async function act(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  const takeQuiz = () =>
    act("quiz", async () => {
      // Reuse the newest quiz for this chapter; generate one only if there is none.
      const { data, error: e } = await supabase
        .from("quizzes")
        .select("id")
        .eq("chapter_id", chapter.data!.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (e) throw new Error(e.message);
      const quizId =
        data?.[0]?.id ??
        (await callFunction<{ quiz_id: string }>("generate-quiz", { document_id: doc!.id, chapter_id: chapter.data!.id, count: 8 })).quiz_id;
      navigate(`/quiz/${quizId}`);
    });

  const showSummary = () =>
    act("summary", async () => {
      const r = await callFunction<{ summary: { content: string } }>("summarize", { document_id: doc!.id, chapter_id: chapter.data!.id });
      setSummary(r.summary.content);
    });

  const change = (to: "completed" | "skipped" | "todo" | "in_progress") =>
    act(to, async () => {
      await setStatus.mutateAsync({ session, status: to, documentId: doc?.id ?? null });
      onClose();
    });

  const Icon = activity.icon;
  const bigBtn = "flex flex-1 items-center justify-center gap-2 rounded-[2px] py-3 text-[15px] font-semibold disabled:opacity-40";

  return (
    <Backdrop onClick={onClose} className="z-50 grid place-items-center p-4">
      <Panel
        role="dialog"
        aria-label={session.title}
        className="surface thin-scroll flex max-h-[92vh] w-full max-w-[640px] flex-col overflow-y-auto rounded-[2px] border border-neutral-200 shadow-2xl dark:border-[#2e2e33]"
      >
        <header className="flex items-start gap-4 px-6 pt-6 pb-4">
          <span className={`grid size-11 shrink-0 place-items-center rounded-[2px] ${activity.tile}`}>
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold">{session.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className={`flex items-center gap-1 rounded-[2px] px-2 py-0.5 font-medium ${STATUS[status].pill}`}>
                {status === "todo" && <AlertTriangle className="size-3.5" />}
                {STATUS[status].label}
              </span>
              <PriorityPill s={session} />
              {chapter.data && <span className="truncate text-neutral-500">{chapter.data.title}</span>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <X className="size-5" />
          </button>
        </header>

        <div className="flex flex-wrap gap-5 border-y border-neutral-200 bg-neutral-50 px-6 py-3 text-[15px] dark:border-[#2e2e33] dark:bg-[#202024]">
          <span className="flex items-center gap-2">
            <CalendarDays className="size-4 text-neutral-500" /> {longDate(session.scheduled_for)}
          </span>
          {time && (
            <span className="flex items-center gap-2">
              <Clock className="size-4 text-neutral-500" /> {time}
            </span>
          )}
          <span>{session.duration_minutes} min</span>
        </div>

        <div className="space-y-5 px-6 py-5">
          {session.description && (
            <section>
              <h3 className="text-xs font-bold tracking-[0.12em] text-neutral-500 uppercase">Description</h3>
              <p className="mt-2">{session.description}</p>
            </section>
          )}
          {session.requirements.length > 0 && (
            <section>
              <h3 className="text-xs font-bold tracking-[0.12em] text-neutral-500 uppercase">Requirements</h3>
              <ul className="mt-2 space-y-1">
                {session.requirements.map((r) => (
                  <li key={r} className="flex items-center gap-2">
                    <Icon className="size-4 text-neutral-500" /> {r}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {session.tips.length > 0 && (
            <section>
              <h3 className="text-xs font-bold tracking-[0.12em] text-neutral-500 uppercase">AI Tips</h3>
              <ul className="mt-2 space-y-2 rounded-[2px] border border-accent-500/20 bg-accent-50/50 p-4 dark:bg-accent-500/10">
                {session.tips.map((t) => (
                  <li key={t} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent-500" />
                    {t}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <AnimatePresence initial={false}>
            {summary && (
              <Collapse>
                <section className="rounded-[2px] border border-neutral-200 p-4 dark:border-[#2e2e33]">
                  <Markdown text={summary} />
                </section>
              </Collapse>
            )}
          </AnimatePresence>
          {error && (
            <p role="alert" className="text-sm text-red-500">
              {error}
            </p>
          )}
        </div>

        <footer className="mt-auto space-y-3 border-t border-neutral-200 px-6 py-4 dark:border-[#2e2e33]">
          <div className="flex gap-2">
            <button disabled={!hasChapter || !!busy} onClick={() => doc && openDocument.mutate(doc)} className={`btn-primary ${bigBtn}`}>
              <BookOpen className="size-4" /> Read <ExternalLink className="size-3.5 opacity-70" />
            </button>
            <button disabled={!hasChapter || !!busy} onClick={() => void takeQuiz()} className={`btn-primary ${bigBtn}`}>
              {busy === "quiz" ? <Loader2 className="size-4 animate-spin" /> : <GraduationCap className="size-4" />} Quiz
            </button>
            <button disabled={!hasChapter || !!busy} onClick={() => void showSummary()} className={`btn-secondary ${bigBtn}`}>
              {busy === "summary" ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />} Summary
            </button>
          </div>
          {!session.chapter_id && <p className="text-xs text-neutral-500">This review covers every chapter: use the chapter sessions for reading, quizzes and summaries.</p>}
          <div className="flex items-center gap-4">
            {status !== "skipped" && status !== "completed" && (
              <button disabled={!!busy} onClick={() => void change("skipped")} className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
                <FastForward className="size-4" /> Skip
              </button>
            )}
            <button
              disabled={!!busy}
              onClick={() => {
                if (window.confirm(`Delete "${session.title}"? This cannot be undone.`))
                  void act("delete", async () => {
                    await deleteSession.mutateAsync(session.id);
                    onClose();
                  });
              }}
              className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-red-500"
            >
              <Trash2 className="size-4" /> Delete
            </button>
            {status === "completed" || status === "skipped" ? (
              <button disabled={!!busy} onClick={() => void change("todo")} className="btn-secondary ml-auto flex items-center gap-2 rounded-[2px] px-4 py-2.5 text-sm font-semibold">
                <RotateCcw className="size-4" /> Mark as not done
              </button>
            ) : (
              <button
                disabled={!!busy}
                onClick={() => void change("completed")}
                className="ml-auto flex items-center gap-2 rounded-[2px] bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {busy === "completed" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Mark Complete
              </button>
            )}
          </div>
        </footer>
      </Panel>
    </Backdrop>
  );
}
