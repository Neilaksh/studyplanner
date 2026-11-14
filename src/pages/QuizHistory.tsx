import { useMemo, useState } from "react";
import { BarChart3, ClipboardList, FileText, Zap } from "lucide-react";
import { IconTile, PageBody, PageHeader } from "../components/ui";
import { quizAttempts } from "../data";

function performance(avg: number, total: number) {
  if (total === 0) return { emoji: "💪", label: "keep learning" };
  if (avg >= 85) return { emoji: "🏆", label: "excellent" };
  if (avg >= 70) return { emoji: "🔥", label: "on track" };
  return { emoji: "💪", label: "keep learning" };
}

function Stat({ icon: Icon, value, label, valueClass = "" }: { icon: typeof Zap; value: React.ReactNode; label: string; valueClass?: string }) {
  return (
    <div className="dot-card flex items-center gap-3 px-4 py-3.5">
      <span className="dots" />
      <span className="grid size-9 shrink-0 place-items-center rounded-sm bg-accent-50 text-accent-500 dark:bg-accent-500/15">
        <Icon className="size-4" />
      </span>
      <span>
        <span className={`block text-2xl leading-none font-bold ${valueClass}`}>{value}</span>
        <span className="mt-1.5 block text-sm text-neutral-500">{label}</span>
      </span>
    </div>
  );
}

export function QuizHistory() {
  const [pdf, setPdf] = useState("all");
  const [query, setQuery] = useState("");

  const pdfs = [...new Set(quizAttempts.map((a) => a.pdf))];
  const total = quizAttempts.length;
  const avg = total ? Math.round(quizAttempts.reduce((s, a) => s + a.score, 0) / total) : 0;
  const perf = performance(avg, total);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return quizAttempts
      .filter((a) => (pdf === "all" || a.pdf === pdf) && (!q || `${a.pdf} ${a.chapter}`.toLowerCase().includes(q)))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [pdf, query]);

  return (
    <PageBody>
      <PageHeader title="Quiz History" subtitle="Track your progress and review past quiz attempts" />

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Stat icon={BarChart3} value={`${avg}%`} label="Average Score" valueClass={avg < 50 ? "text-red-500" : "text-green-600"} />
        <Stat icon={ClipboardList} value={total} label="Total Quizzes" />
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

      <div className="surface mt-8 grid gap-4 rounded-sm border border-neutral-200 p-6 sm:grid-cols-2 dark:border-[#2e2e33]">
        <select value={pdf} onChange={(e) => setPdf(e.target.value)} aria-label="Filter by PDF" className="field">
          <option value="all">All PDFs</option>
          {pdfs.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by PDF or chapter..." className="field" />
      </div>

      {shown.length === 0 ? (
        <div className="surface mt-6 rounded-sm border border-neutral-200 px-6 py-20 text-center dark:border-[#2e2e33]">
          <IconTile icon={FileText} className="mx-auto text-neutral-400" />
          <h3 className="mt-6 text-2xl font-bold">No Quiz History</h3>
          <p className="mt-3 text-neutral-500">
            {total === 0 ? "Start taking quizzes to see your history here!" : "No attempts match these filters."}
          </p>
        </div>
      ) : (
        <ul className="surface mt-6 divide-y divide-neutral-200 rounded-sm border border-neutral-200 dark:divide-[#2e2e33] dark:border-[#2e2e33]">
          {shown.map((a) => (
            <li key={a.id} className="flex items-center gap-4 px-6 py-4">
              <div className="flex-1">
                <p className="font-semibold">{a.pdf}</p>
                <p className="text-sm text-neutral-500">{a.chapter}</p>
              </div>
              <span className="text-sm text-neutral-500">{new Date(a.date).toLocaleDateString()}</span>
              <span className={`w-14 text-right font-bold tabular-nums ${a.score < 50 ? "text-red-500" : "text-green-600"}`}>{a.score}%</span>
            </li>
          ))}
        </ul>
      )}
    </PageBody>
  );
}
