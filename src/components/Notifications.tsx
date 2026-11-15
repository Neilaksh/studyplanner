// Notifications derived from the user's own data: today's and overdue sessions, upcoming exams, untaken quizzes.
// "Seen" state is a per-browser convenience kept in localStorage.
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bell, CalendarClock, GraduationCap, Target, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Pop } from "./motion";
import { localIsoDate, useStudyPlans, useStudySessions } from "../lib/dashboard";
import { useAllQuizzes, useAttempts } from "../lib/quizzes";
import { navigate } from "../router";

type Note = { id: string; icon: LucideIcon; tone: string; title: string; body: string; to: string };

const SEEN_KEY = "notifications:seen";
const readSeen = () => {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"));
  } catch {
    return new Set<string>();
  }
};

function daysUntil(iso: string, today: string) {
  const [a, b] = [today, iso].map((d) => d.split("-").map(Number));
  return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86_400_000);
}

function useNotes(): Note[] {
  const plans = useStudyPlans();
  const sessions = useStudySessions();
  const quizzes = useAllQuizzes();
  const attempts = useAttempts();
  const today = localIsoDate(new Date());

  return useMemo(() => {
    const active = new Set((plans.data ?? []).filter((p) => p.status !== "paused").map((p) => p.id));
    const open = (sessions.data ?? []).filter((s) => active.has(s.plan_id) && (s.status === "todo" || s.status === "in_progress"));
    const notes: Note[] = [];
    const due = open.filter((s) => s.scheduled_for === today);
    if (due.length)
      notes.push({
        id: `today-${today}-${due.length}`,
        icon: CalendarClock,
        tone: "text-accent-500 bg-accent-50 dark:bg-accent-500/15",
        title: `${due.length} session${due.length === 1 ? "" : "s"} today`,
        body: due.slice(0, 2).map((s) => s.title).join(" · "),
        to: "/study-planner",
      });
    const overdue = open.filter((s) => s.scheduled_for < today);
    if (overdue.length)
      notes.push({
        id: `overdue-${today}-${overdue.length}`,
        icon: AlertTriangle,
        tone: "text-red-500 bg-red-50 dark:bg-red-500/15",
        title: `${overdue.length} overdue session${overdue.length === 1 ? "" : "s"}`,
        body: "Catch up or skip them in the planner.",
        to: "/study-planner",
      });
    for (const p of plans.data ?? []) {
      const d = daysUntil(p.exam_date, today);
      if (p.status !== "paused" && d >= 0 && d <= 7)
        notes.push({
          id: `exam-${p.id}-${d}`,
          icon: Target,
          tone: "text-violet-600 bg-violet-50 dark:bg-violet-500/15",
          title: d === 0 ? `Exam today: ${p.title}` : `Exam in ${d} day${d === 1 ? "" : "s"}`,
          body: p.title,
          to: "/study-planner",
        });
    }
    const taken = new Set((attempts.data ?? []).map((a) => a.quiz_id));
    for (const z of (quizzes.data ?? []).filter((q) => !taken.has(q.id)).slice(0, 3))
      notes.push({
        id: `quiz-${z.id}`,
        icon: GraduationCap,
        tone: "text-sky-600 bg-sky-50 dark:bg-sky-500/15",
        title: "Quiz ready to take",
        body: `${z.title} · ${z.question_count} questions`,
        to: `/quiz/${z.id}`,
      });
    return notes;
  }, [plans.data, sessions.data, quizzes.data, attempts.data, today]);
}

export function Notifications({ buttonClass }: { buttonClass: string }) {
  const notes = useNotes();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(readSeen);
  const ref = useRef<HTMLDivElement>(null);
  const unseen = notes.filter((n) => !seen.has(n.id)).length;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const markAllSeen = () => {
    const next = new Set([...seen, ...notes.map((n) => n.id)]);
    setSeen(next);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...next].slice(-200)));
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label={`Notifications${unseen ? ` (${unseen} new)` : ""}`} aria-expanded={open} className={buttonClass}>
        <Bell className="size-5" />
        <AnimatePresence>
          {unseen > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] leading-4 font-bold text-white"
            >
              {unseen}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
      <AnimatePresence>
        {open && (
          <Pop key="panel" className="surface absolute right-0 z-30 mt-2 w-[min(360px,90vw)] rounded-sm border border-neutral-200 shadow-xl dark:border-[#2e2e33]">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-[#2e2e33]">
              <p className="font-semibold">Notifications</p>
              {unseen > 0 && (
                <button onClick={markAllSeen} className="text-xs font-medium text-accent-500 hover:underline">
                  Mark all as read
                </button>
              )}
            </div>
            {notes.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-neutral-500">You're all caught up.</p>
            ) : (
              <ul className="thin-scroll max-h-96 overflow-y-auto py-1">
                {notes.map((n, i) => {
                  const Icon = n.icon;
                  const isNew = !seen.has(n.id);
                  return (
                    <motion.li key={n.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0, transition: { delay: i * 0.03 } }}>
                      <button
                        onClick={() => {
                          setOpen(false);
                          navigate(n.to);
                        }}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-[#202024]"
                      >
                        <span className={`grid size-8 shrink-0 place-items-center rounded-full ${n.tone}`}>
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{n.title}</span>
                          <span className="block truncate text-xs text-neutral-500">{n.body}</span>
                        </span>
                        {isNew && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent-500" aria-label="New" />}
                      </button>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </Pop>
        )}
      </AnimatePresence>
    </div>
  );
}
