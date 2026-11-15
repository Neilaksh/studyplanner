import { useEffect, useMemo, useState } from "react";
import {
  BookOpenCheck,
  ClipboardList,
  Eye,
  ListTree,
  Loader2,
  MessageCircleQuestion,
  Play,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useAiActions, useChapters, useDeleteQuiz, useQuizzes, useSummaries, type SummaryRow } from "../lib/ai";
import type { DocumentRow } from "../lib/library";
import { Markdown } from "./Markdown";
import { navigate } from "../router";

type Output =
  | { kind: "summary"; title: string; content: string; fromSaved: boolean; chapterId?: string }
  | { kind: "quiz"; id: string; title: string; count: number; truncated: boolean }
  | { kind: "explanation"; question: string; content: string };

type Explanation = { question: string; answer: string; at: number };

const small = "flex items-center gap-1.5 rounded-[2px] px-2.5 py-1.5 text-xs font-medium disabled:opacity-50";
const MAX_SAVED_EXPLANATIONS = 10;

/** Explanations are not stored in the database; keep recent ones for this browser session per document. */
function useSessionExplanations(documentId: string) {
  const key = `explanations:${documentId}`;
  const [items, setItems] = useState<Explanation[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(key) ?? "[]") as Explanation[];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(items));
    } catch {
      /* storage unavailable: keep them in memory only */
    }
  }, [key, items]);
  const add = (e: Explanation) => setItems((xs) => [e, ...xs].slice(0, MAX_SAVED_EXPLANATIONS));
  return { items, add };
}

export function StudyPanel({ doc, onClose }: { doc: DocumentRow; onClose: () => void }) {
  const chapters = useChapters(doc.id);
  const summaries = useSummaries(doc.id);
  const quizzes = useQuizzes(doc.id);
  const deleteQuiz = useDeleteQuiz(doc.id);
  const { extractChapters, summarize, generateQuiz, explain } = useAiActions(doc.id);
  const explanations = useSessionExplanations(doc.id);
  const [output, setOutput] = useState<Output | null>(null);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [page, setPage] = useState("");

  const error = [extractChapters, summarize, generateQuiz, explain, deleteQuiz].find((m) => m.isError)?.error?.message;
  const busy = busyLabel !== null;

  // Latest saved summary per chapter ("" = whole document).
  const savedSummary = useMemo(() => {
    const map = new Map<string, SummaryRow>();
    for (const s of summaries.data ?? []) if (!map.has(s.chapter_id ?? "")) map.set(s.chapter_id ?? "", s);
    return map;
  }, [summaries.data]);
  const chapterTitle = (id: string | null) => (id ? chapters.data?.find((c) => c.id === id)?.title : null) ?? doc.title;

  async function run(label: string, fn: () => Promise<void>) {
    setBusyLabel(label);
    for (const m of [extractChapters, summarize, generateQuiz, explain]) m.reset();
    try {
      await fn();
    } catch {
      /* shown via the mutation error */
    } finally {
      setBusyLabel(null);
    }
  }

  const showSaved = (title: string, s: SummaryRow) =>
    setOutput({ kind: "summary", title, content: s.content, fromSaved: true, chapterId: s.chapter_id ?? undefined });

  const doSummary = (title: string, chapterId?: string, force = false) =>
    run(`Summarising ${title}…`, async () => {
      const r = await summarize.mutateAsync({ chapterId, force });
      setOutput({ kind: "summary", title, content: r.summary.content, fromSaved: r.cached, chapterId });
    });

  const doQuiz = (title: string, chapterId?: string) =>
    run(`Writing a quiz on ${title}…`, async () => {
      const r = await generateQuiz.mutateAsync({ chapterId });
      setOutput({ kind: "quiz", id: r.quiz_id, title: r.title, count: r.question_count, truncated: r.source_truncated });
    });

  const doChapters = (force: boolean) => {
    if (force && !window.confirm("Re-detecting chapters deletes this document's chapter summaries. Continue?")) return;
    void run("Detecting chapters…", async () => {
      await extractChapters.mutateAsync(force);
    });
  };

  /** "View summary" when one is saved (no AI call), otherwise "Summarize". */
  function SummaryButton({ title, chapterId }: { title: string; chapterId?: string }) {
    const saved = savedSummary.get(chapterId ?? "");
    return saved ? (
      <button disabled={busy} onClick={() => showSaved(title, saved)} className={`btn-secondary ${small}`}>
        <Eye className="size-3.5" /> View summary
      </button>
    ) : (
      <button disabled={busy} onClick={() => void doSummary(title, chapterId)} className={`btn-secondary ${small}`}>
        Summarize
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        role="dialog"
        aria-label={`Study ${doc.title}`}
        onClick={(e) => e.stopPropagation()}
        className="surface thin-scroll flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-neutral-200 shadow-2xl dark:border-[#2e2e33]"
      >
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-neutral-200 bg-inherit px-6 py-4 dark:border-[#2e2e33]">
          <Sparkles className="size-5 text-accent-500" />
          <h2 className="min-w-0 flex-1 truncate text-lg font-bold" title={doc.title}>
            {doc.title}
          </h2>
          <button onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <X className="size-4" />
          </button>
        </header>

        <div className="space-y-6 p-6">
          {(busy || error) && (
            <p
              role={error ? "alert" : "status"}
              className={`flex items-center gap-2 rounded-[2px] px-3 py-2 text-sm ${error ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" : "bg-neutral-100 dark:bg-[#26262a]"}`}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {error ?? busyLabel}
            </p>
          )}

          {output && (
            <section className="rounded-sm border border-accent-200 p-5 dark:border-accent-500/40">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="font-bold">
                  {output.kind === "summary" ? `Summary · ${output.title}` : output.kind === "quiz" ? "Quiz created" : "Explanation"}
                </h3>
                <div className="flex items-center gap-1">
                  {output.kind === "summary" && (
                    <button
                      disabled={busy}
                      onClick={() => void doSummary(output.title, output.chapterId, true)}
                      className={`${small} text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100`}
                    >
                      <RefreshCw className="size-3.5" /> Regenerate
                    </button>
                  )}
                  <button onClick={() => setOutput(null)} aria-label="Hide" className="grid size-7 place-items-center rounded text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
              {output.kind === "summary" && (
                <>
                  {output.fromSaved && <p className="mb-2 text-xs text-neutral-500">Saved summary — no AI call used.</p>}
                  <Markdown text={output.content} />
                </>
              )}
              {output.kind === "quiz" && (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <p className="flex-1">
                    Created <strong>{output.title}</strong> with {output.count} questions.
                    {output.truncated && " The material was long, so it covers the first part only."}
                  </p>
                  <button onClick={() => navigate(`/quiz/${output.id}`)} className={`btn-primary ${small}`}>
                    <Play className="size-3.5" /> Take it now
                  </button>
                </div>
              )}
              {output.kind === "explanation" && (
                <>
                  <p className="mb-2 text-sm text-neutral-500">“{output.question}”</p>
                  <Markdown text={output.content} />
                </>
              )}
            </section>
          )}

          <section>
            <h3 className="flex items-center gap-2 font-semibold">
              <BookOpenCheck className="size-4" /> Whole document
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <SummaryButton title={doc.title} />
              <button disabled={busy} onClick={() => void doQuiz(doc.title)} className={`btn-secondary ${small}`}>
                Generate quiz
              </button>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold">
                <ListTree className="size-4" /> Chapters
              </h3>
              {(chapters.data?.length ?? 0) > 0 && (
                <button disabled={busy} onClick={() => doChapters(true)} className={`${small} text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100`}>
                  <RefreshCw className="size-3.5" /> Re-detect
                </button>
              )}
            </div>
            {chapters.isPending ? (
              <p className="mt-3 text-sm text-neutral-400">Loading…</p>
            ) : (chapters.data?.length ?? 0) === 0 ? (
              <div className="mt-3 rounded-sm border border-dashed border-neutral-300 p-4 text-sm dark:border-[#3a3a40]">
                <p className="text-neutral-500">No chapters yet. Detect them to summarise or quiz one chapter at a time.</p>
                <button disabled={busy} onClick={() => doChapters(false)} className={`btn-primary mt-3 ${small}`}>
                  Detect chapters
                </button>
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-neutral-200 rounded-sm border border-neutral-200 dark:divide-[#2e2e33] dark:border-[#2e2e33]">
                {chapters.data!.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium" title={c.title}>
                        {c.title}
                      </span>
                      <span className="text-xs text-neutral-500">
                        Pages {c.start_page}–{c.end_page}
                      </span>
                    </span>
                    <SummaryButton title={c.title} chapterId={c.id} />
                    <button disabled={busy} onClick={() => void doQuiz(c.title, c.id)} className={`btn-secondary ${small}`}>
                      Quiz
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="flex items-center gap-2 font-semibold">
              <ClipboardList className="size-4" /> Saved quizzes
            </h3>
            {quizzes.isPending ? (
              <p className="mt-3 text-sm text-neutral-400">Loading…</p>
            ) : (quizzes.data?.length ?? 0) === 0 ? (
              <p className="mt-3 text-sm text-neutral-500">No quizzes yet. Generate one for the whole document or a chapter.</p>
            ) : (
              <>
                <ul className="mt-3 divide-y divide-neutral-200 rounded-sm border border-neutral-200 dark:divide-[#2e2e33] dark:border-[#2e2e33]">
                  {quizzes.data!.map((q) => (
                    <li key={q.id} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium" title={q.title}>
                          {q.title}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {q.question_count} questions · {chapterTitle(q.chapter_id)} · {new Date(q.created_at).toLocaleDateString()}
                        </span>
                      </span>
                      <button
                        onClick={() => navigate(`/quiz/${q.id}`)}
                        className={`btn-primary ${small}`}
                      >
                        <Play className="size-3.5" /> Start
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete the quiz "${q.title}"? This cannot be undone.`)) deleteQuiz.mutate(q.id);
                        }}
                        disabled={deleteQuiz.isPending}
                        aria-label={`Delete quiz ${q.title}`}
                        className="grid size-8 place-items-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-red-500 dark:hover:bg-neutral-800"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section>
            <h3 className="flex items-center gap-2 font-semibold">
              <MessageCircleQuestion className="size-4" /> Explain something
            </h3>
            <form
              className="mt-3 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                const text = question.trim();
                if (!text) return;
                const p = Number(page);
                void run("Explaining…", async () => {
                  const r = await explain.mutateAsync({ text, page: Number.isInteger(p) && p > 0 ? p : undefined });
                  explanations.add({ question: text, answer: r.explanation, at: Date.now() });
                  setOutput({ kind: "explanation", question: text, content: r.explanation });
                  setQuestion("");
                });
              }}
            >
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={4000}
                rows={3}
                placeholder="Paste a passage or ask about a concept…"
                className="field resize-y"
              />
              <div className="flex items-center gap-2">
                <input
                  value={page}
                  onChange={(e) => setPage(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  placeholder="Page (optional)"
                  aria-label="Page number for context"
                  className="field w-40 py-2"
                />
                <button disabled={busy || !question.trim()} className={`btn-primary ${small} py-2`}>
                  Explain
                </button>
              </div>
            </form>
            {explanations.items.length > 0 && (
              <ul className="mt-3 space-y-1">
                {explanations.items.map((x) => (
                  <li key={x.at}>
                    <button
                      onClick={() => setOutput({ kind: "explanation", question: x.question, content: x.answer })}
                      className="w-full truncate rounded-[2px] px-2 py-1.5 text-left text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      title={x.question}
                    >
                      ↺ {x.question}
                    </button>
                  </li>
                ))}
                <li className="px-2 text-xs text-neutral-400">Recent explanations are kept until you close this browser tab.</li>
              </ul>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
