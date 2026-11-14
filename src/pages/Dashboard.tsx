import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronUp,
  Clock,
  FileText,
  GraduationCap,
  HelpCircle,
  Sparkles,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import { ActivityHeatmap } from "../components/ActivityHeatmap";
import { MiniCalendar } from "../components/MiniCalendar";
import type { NavKey } from "../components/Sidebar";
import { activity, recentDocuments, sessions, stats, studyPlans, user } from "../data";

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function StatCard({ icon: Icon, tint, value, label }: { icon: LucideIcon; tint: string; value: string; label: string }) {
  return (
    <button className="dot-card flex items-center gap-3 px-4 py-3.5 text-left transition-shadow hover:shadow-sm">
      <span className="dots" />
      <span className={`grid size-9 shrink-0 place-items-center rounded-sm ${tint}`}>
        <Icon className="size-4" />
      </span>
      <span>
        <span className="block text-2xl leading-none font-bold">{value}</span>
        <span className="mt-1.5 block text-sm text-neutral-500">{label}</span>
      </span>
    </button>
  );
}

function SectionHeading({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 text-lg font-bold">
      <Icon className="size-5" />
      {children}
    </h2>
  );
}

function EmptyState({ title, body, action, onAction }: { title: string; body: string; action: string; onAction?: () => void }) {
  return (
    <div className="mt-5 rounded-sm border border-dashed border-neutral-300 bg-neutral-50/60 px-6 py-10 text-center dark:border-neutral-700 dark:bg-neutral-950/40">
      <Sparkles className="mx-auto size-8 text-neutral-400" />
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-neutral-500">{body}</p>
      <button
        onClick={onAction}
        className="btn-primary mt-5 inline-flex items-center gap-2 rounded-sm px-4 py-2 text-sm font-medium"
      >
        {action}
      </button>
    </div>
  );
}

export function Dashboard({ onNavigate }: { onNavigate: (k: NavKey) => void }) {
  const [getStartedOpen, setGetStartedOpen] = useState(true);
  const minutes = stats.studyMinutes;
  const studyTime = minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;

  return (
    <div className="mx-auto max-w-[1440px] p-5 sm:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {greeting()}, {user.firstName}
          </h1>
          <p className="mt-2 text-neutral-500">Ready to start your learning journey?</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onNavigate("pdfs")}
            className="btn-primary flex h-12 items-center gap-2 rounded-[2px] px-4 text-sm font-medium"
          >
            <UploadCloud className="size-5" /> Upload PDF
          </button>
          <button
            onClick={() => onNavigate("planner")}
            className="btn-secondary flex h-12 items-center gap-2 rounded-[2px] px-4 text-sm font-medium"
          >
            <Sparkles className="size-5 text-accent-500" /> New Plan
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard icon={FileText} tint="bg-blue-50 text-blue-600 dark:bg-blue-950" value={String(stats.documents)} label="Documents" />
        <StatCard icon={CheckCircle2} tint="bg-violet-50 text-violet-600 dark:bg-violet-950" value={String(stats.quizzes)} label="Quizzes" />
        <StatCard icon={HelpCircle} tint="bg-sky-50 text-sky-600 dark:bg-sky-950" value={String(stats.questions)} label="Questions" />
        <StatCard icon={BarChart3} tint="bg-green-50 text-green-600 dark:bg-green-950" value={stats.avgScore == null ? "—" : `${stats.avgScore}%`} label="Avg Score" />
        <StatCard icon={Clock} tint="bg-accent-50 text-accent-500 dark:bg-accent-500/15" value={studyTime} label="Study Time" />
      </div>

      {/* Two-column body */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_344px]">
        <div className="min-w-0 space-y-6">
          <ActivityHeatmap activity={activity} />

          <section className="dot-card px-6 py-6">
            <span className="dots" />
            <div className="flex items-center gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-sm bg-accent-50 text-accent-500 dark:bg-accent-500/15">
                <Sparkles className="size-5" />
              </span>
              <div className="flex-1">
                <span className="rounded-sm bg-accent-50 px-1.5 py-0.5 text-[11px] font-bold tracking-wider text-accent-500 dark:bg-accent-500/15">
                  GET STARTED
                </span>
                <h2 className="mt-1 font-bold">Start Your Learning Journey</h2>
                {getStartedOpen && <p className="text-sm text-neutral-500">Upload a PDF to get started</p>}
              </div>
              <ArrowRight className="size-5 text-accent-500" />
              <button
                onClick={() => setGetStartedOpen((o) => !o)}
                aria-label={getStartedOpen ? "Collapse card" : "Expand card"}
                className="grid size-8 place-items-center rounded text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <ChevronUp className={`size-4 transition-transform ${getStartedOpen ? "" : "rotate-180"}`} />
              </button>
            </div>
          </section>

          <section className="dot-card p-6">
            <span className="dots" />
            <SectionHeading icon={GraduationCap}>Study Plans</SectionHeading>
            {studyPlans.length === 0 ? (
              <EmptyState
                title="No Study Plans Yet"
                body="Create an AI-powered study plan to organize your learning."
                action="Create Study Plan"
                onAction={() => onNavigate("planner")}
              />
            ) : (
              <ul className="mt-4 divide-y divide-neutral-200 dark:divide-neutral-800">
                {studyPlans.map((p) => (
                  <li key={p.id} className="py-3">
                    <p className="font-medium">{p.title}</p>
                    <p className="text-sm text-neutral-500">Exam: {p.exam}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="dot-card p-6">
            <span className="dots" />
            <SectionHeading icon={FileText}>Recent Documents</SectionHeading>
            {recentDocuments.length === 0 ? (
              <p className="mt-4 text-sm text-neutral-500">No documents uploaded yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-neutral-200 dark:divide-neutral-800">
                {recentDocuments.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 py-3">
                    <FileText className="size-5 text-blue-600" />
                    <span className="flex-1 font-medium">{d.name}</span>
                    <span className="text-sm text-neutral-500">{d.pages} pages</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <MiniCalendar sessions={sessions} />

          <section className="dot-card p-6">
            <span className="dots" />
            <SectionHeading icon={CalendarDays}>Next Up</SectionHeading>
            {sessions.length === 0 ? (
              <div className="mt-6 text-center">
                <p className="font-semibold">No Sessions Scheduled</p>
                <p className="mt-1 text-sm text-neutral-500">Add sessions to your study plans</p>
                <button
                  onClick={() => onNavigate("planner")}
                  className="mt-4 rounded-sm border border-neutral-200 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  Go to Planner
                </button>
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {sessions.map((s) => (
                  <li key={s.id} className="text-sm">
                    {s.title} — {new Date(s.date).toLocaleDateString()}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="dot-card p-6">
            <span className="dots" />
            <h2 className="flex items-center gap-2.5 text-lg font-bold">
              <Sparkles className="size-5 text-accent-500" /> Quick Start
            </h2>
            <p className="mt-2 text-sm text-neutral-500">Upload a PDF to generate quizzes, and study plans.</p>
            <button
              onClick={() => onNavigate("pdfs")}
              className="btn-primary mt-5 flex w-full items-center justify-center gap-2 rounded-[2px] py-2.5 text-sm font-medium"
            >
              <UploadCloud className="size-4" /> Upload First PDF
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
