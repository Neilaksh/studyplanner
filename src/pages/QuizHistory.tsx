import { useMemo, useState } from "react";
import { BarChart3, ClipboardList, FileText, Loader2, Play, RotateCcw, Zap } from "lucide-react";
import { IconTile, PageBody, PageHeader } from "../components/ui";
import { useAllQuizzes, useAttempts } from "../lib/quizzes";
import { navigate } from "../router";

function performance(avg: number, total: number) {
  if (total === 0) return { emoji: "💪", label: "keep learning" };
  if (avg >= 85) return { emoji: "🏆", label: "excellent" };
  if (avg >= 70) return { emoji: "🔥", label: "on track" };
  return { emoji: "💪", label: "keep learning" };
}

const scoreColor = (s: number) => (s >= 70 ? "text-green-600" : s >= 50 ? "text-amber-500" : "text-red-500");

function Stat({ icon: Icon, value, label }: { icon: typeof Zap; value: React.ReactNode; label: string }) {
  return (
    <div className="dot-card flex items-center gap-3 px-4 py-3.5">
      <span className="dots" />
      <span className="grid size-9 shrink-0 place-items-center rounded-sm bg-accent-50 text-accent-500 dark:bg-accent-500/15">
        <Icon className="size-4" />
      </span>
      <span>
        <span className="block text-2xl leading-none font-bold">{value}</span>
        <span className="mt-1.5 block text-sm text-neutral-500">{label}</span>
      </span>
    </div>
  );
}

export function QuizHistory() {
  const attemptsQuery = useAttempts();
  const quizzesQuery = useAllQuizzes();
  const [pdf, setPdf] = useState("all");
  const [query, setQuery] = useState("");

  const attempts = useMemo(() => attemptsQuery.data ?? [], [attemptsQuery.data]);
  const quizzes = quizzesQuery.data ?? [];
  const scored = attempts.filter((a) => a.score !== null);
  const avg = scored.length ? Math.round(scored.reduce((s, a) => s + Number(a.score), 0) / scored.length) : 0;
  const perf = performance(avg, scored.length);
  const takenQuizIds = new Set(attempts.map((a) => a.quiz_id));
  const notTaken = quizzes.filter((q) => !takenQuizIds.has(q.id));

  const pdfs = [...new Set(attempts.map((a) => a.document_title).filter((t): t is string => !!t))].sort();
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return attempts.filter(
      (a) =>
        (pdf === "all" || a.document_title === pdf) &&
        (!q || `${a.document_title ?? ""} ${a.chapter_title ?? ""} ${a.quiz_title}`.toLowerCase().includes(q)),
    );
  }, [attempts, pdf, query]);

  return (
    <PageBody>
      <PageHeader title="Quiz History" subtitle="Track your progress and review past quiz attempts" />

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Stat icon={BarChart3} value={<span className={scored.length ? scoreColor(avg) : "text-red-500"}>{avg}%</span>} label="Average Score" />
        <Stat icon={ClipboardList} value={attempts.length} label="Quizzes Taken" />
        <Stat
          icon={Zap}
          value={
            <span className="flex items-center gap-2 text-sm font-semibold italic">
              <span className="text-2xl not-italic">{perf.emoji}</span> {perf.label}
            </span>
          }
          label="Performance"
        />
      </div>

      {notTaken.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold">Ready to take</h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {notTaken.map((q) => (
              <li key={q.id} className="dot-card flex items-center gap-3 p-4">
                <span className="dots" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium" title={q.title}>
                    {q.title}
                  </span>
                  <span className="block truncate text-sm text-neutral-500">
                    {q.question_count} questions{q.document_title ? ` · ${q.document_title}` : ""}
                  </span>
                </span>
                <button onClick={() => navigate(`/quiz/${q.id}`)} className="btn-primary flex items-center gap-1.5 rounded-[2px] px-3 py-1.5 text-sm font-medium">
                  <Play className="size-3.5" /> Start
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="surface mt-8 grid gap-4 rounded-sm border border-neutral-200 p-6 sm:grid-cols-2 dark:border-[#2e2e33]">
        <select value={pdf} onChange={(e) => setPdf(e.target.value)} aria-label="Filter by PDF" className="field">
          <option value="all">All PDFs</option>
          {pdfs.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by PDF or chapter..." className="field" />
      </div>

      {attemptsQuery.isPending ? (
        <div className="mt-6 grid h-48 place-items-center text-neutral-400">
          <Loader2 className="size-6 animate-spin" aria-label="Loading history" />
        </div>
      ) : attemptsQuery.isError ? (
        <p role="alert" className="mt-6 text-red-500">
          Could not load your history: {attemptsQuery.error.message}{" "}
          <button onClick={() => void attemptsQuery.refetch()} className="underline">
            Try again
          </button>
        </p>
      ) : shown.length === 0 ? (
        <div className="surface mt-6 rounded-sm border border-neutral-200 px-6 py-20 text-center dark:border-[#2e2e33]">
          <IconTile icon={FileText} className="mx-auto text-neutral-400" />
          <h3 className="mt-6 text-2xl font-bold">No Quiz History</h3>
          <p className="mt-3 text-neutral-500">
            {attempts.length === 0
              ? quizzes.length > 0
                ? "Start one of your quizzes above to see your history here!"
                : "Generate a quiz from a PDF's Study panel, then take it to see your history here!"
              : "No attempts match these filters."}
          </p>
        </div>
      ) : (
        <ul className="surface mt-6 divide-y divide-neutral-200 rounded-sm border border-neutral-200 dark:divide-[#2e2e33] dark:border-[#2e2e33]">
          {shown.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-4 px-6 py-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{a.quiz_title}</p>
                <p className="truncate text-sm text-neutral-500">{[a.document_title, a.chapter_title].filter(Boolean).join(" · ")}</p>
              </div>
              <span className="text-sm text-neutral-500">{a.completed_at ? new Date(a.completed_at).toLocaleString() : ""}</span>
              <span className={`w-14 text-right font-bold tabular-nums ${a.score === null ? "" : scoreColor(Number(a.score))}`}>
                {a.score === null ? "—" : `${Math.round(Number(a.score))}%`}
              </span>
              <button
                onClick={() => navigate(`/quiz/${a.quiz_id}`)}
                className="btn-secondary flex items-center gap-1.5 rounded-[2px] px-3 py-1.5 text-sm font-medium"
              >
                <RotateCcw className="size-3.5" /> Retake
              </button>
            </li>
          ))}
        </ul>
      )}
    </PageBody>
  );
}
