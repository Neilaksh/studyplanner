// Five-step plan builder: name → PDFs → chapters → exam date → study habits → review.
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  GraduationCap,
  Loader2,
  SlidersHorizontal,
  Sparkles,
  Ticket,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAiActions, useChaptersFor, type ChapterRow } from "../lib/ai";
import { localIsoDate } from "../lib/dashboard";
import { useDocuments, type DocumentRow } from "../lib/library";
import { previewSchedule, usePlannerMutations, type CreateProgress } from "../lib/planner";
import { daysBetween, TIME_SLOTS, type TimeSlot } from "../lib/schedule";

const STEPS = ["PDFs", "Chapters", "Date", "Habits", "Ready"] as const;

export const SLOT_INFO: Record<TimeSlot, { emoji: string; label: string; hours: string }> = {
  morning: { emoji: "🌅", label: "Morning", hours: "6AM - 12PM" },
  afternoon: { emoji: "☀️", label: "Afternoon", hours: "12PM - 6PM" },
  evening: { emoji: "🌆", label: "Evening", hours: "6PM - 10PM" },
  night: { emoji: "🌙", label: "Night", hours: "10PM - 2AM" },
};

const QUICK = [
  { label: "Intensive", days: 7 },
  { label: "Standard", days: 14 },
  { label: "Thorough", days: 30 },
];

const caps = "font-black uppercase italic tracking-wide";
const eyebrow = "text-xs font-bold uppercase tracking-[0.12em] text-neutral-500";

function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return localIsoDate(new Date(y, m - 1, d + n));
}

function StepHeading({ n, icon: Icon, title, subtitle, right }: { n: number; icon: LucideIcon; title: string; subtitle: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-neutral-200 pb-4 dark:border-[#2e2e33]">
      <div className="flex items-center gap-3">
        <Icon className="size-6 shrink-0 text-accent-500" />
        <div>
          <h3 className={`text-xl ${caps}`}>
            Step {String(n).padStart(2, "0")}: {title}
          </h3>
          <p className="text-[11px] font-bold tracking-wide text-neutral-500 uppercase">{subtitle}</p>
        </div>
      </div>
      {right}
    </div>
  );
}

function PdfStep({ docs, picked, toggle }: { docs: DocumentRow[]; picked: string[]; toggle: (id: string) => void }) {
  return (
    <>
      <StepHeading
        n={1}
        icon={BookOpen}
        title="PDF Selection"
        subtitle="Choose the source materials for your plan"
        right={<span className={eyebrow}>{picked.length} PDFs selected</span>}
      />
      {docs.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">Upload a PDF in My PDFs first.</p>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {docs.map((d) => {
            const on = picked.includes(d.id);
            return (
              <li key={d.id}>
                <button
                  onClick={() => toggle(d.id)}
                  aria-pressed={on}
                  className={`flex w-full items-center gap-4 rounded-[2px] border p-5 text-left transition-colors ${
                    on ? "border-accent-500 bg-accent-50/50 dark:bg-accent-500/10" : "border-neutral-200 hover:border-neutral-400 dark:border-[#2e2e33] dark:hover:border-neutral-500"
                  }`}
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-sm bg-accent-500 text-white">
                    <FileText className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate font-semibold ${on ? "text-accent-500" : ""}`}>{d.title}</span>
                    <span className="text-xs font-bold text-neutral-500 uppercase">{d.page_count ?? 0} pages</span>
                  </span>
                  <span className={`grid size-5 shrink-0 place-items-center rounded-full ${on ? "bg-accent-500 text-white" : "border border-neutral-300 dark:border-neutral-600"}`}>
                    {on && <Check className="size-3" strokeWidth={3} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function ChapterGroup({ doc, chapters, picked, toggle }: { doc: DocumentRow; chapters: ChapterRow[]; picked: Set<string>; toggle: (id: string) => void }) {
  const [open, setOpen] = useState(true);
  const { extractChapters } = useAiActions(doc.id);
  const selected = chapters.filter((c) => picked.has(c.id)).length;
  return (
    <section className="rounded-[2px] border border-neutral-200 dark:border-[#2e2e33]">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 bg-neutral-50 px-5 py-4 text-left dark:bg-[#202024]">
        <FileText className="size-5 shrink-0 text-red-500" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold uppercase">{doc.title}</span>
          <span className="text-xs font-bold text-neutral-500 uppercase">
            {selected} of {chapters.length} selected
          </span>
        </span>
        <ChevronDown className={`size-4 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="p-3">
          {chapters.length === 0 ? (
            <div className="flex flex-wrap items-center gap-3 p-2 text-sm">
              <span className="flex-1 text-neutral-500">No chapters detected for this PDF yet.</span>
              <button
                disabled={extractChapters.isPending}
                onClick={() => extractChapters.mutate(false)}
                className="btn-primary flex items-center gap-1.5 rounded-[2px] px-3 py-1.5 text-xs font-medium disabled:opacity-60"
              >
                {extractChapters.isPending && <Loader2 className="size-3.5 animate-spin" />} Detect chapters
              </button>
              {extractChapters.isError && <p className="w-full text-red-500">{extractChapters.error.message}</p>}
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {chapters.map((c) => {
                const on = picked.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => toggle(c.id)}
                      aria-pressed={on}
                      className={`flex w-full items-center gap-3 rounded-[2px] border px-4 py-3 text-left transition-colors ${
                        on ? "border-accent-500/60 bg-accent-50/50 dark:bg-accent-500/10" : "border-neutral-200 hover:border-neutral-400 dark:border-[#2e2e33]"
                      }`}
                    >
                      <span className={`grid size-5 shrink-0 place-items-center rounded-[3px] ${on ? "bg-accent-500 text-white" : "border border-neutral-300 dark:border-neutral-600"}`}>
                        {on && <Check className="size-3.5" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate font-medium ${on ? "text-accent-500" : ""}`} title={c.title}>
                          {c.title}
                        </span>
                        <span className="text-[11px] font-bold text-neutral-500 uppercase">
                          Chapter {c.position} • {c.end_page - c.start_page + 1} pages
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function DateStep({ exam, setExam, today }: { exam: string; setExam: (d: string) => void; today: string }) {
  const [view, setView] = useState(() => {
    const [y, m] = (exam || today).split("-").map(Number);
    return new Date(y, m - 1, 1);
  });
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(first.getDay()).fill(null)];
  for (let d = 1; d <= daysInMonth; d++) cells.push(localIsoDate(new Date(view.getFullYear(), view.getMonth(), d)));
  const until = exam ? daysBetween(today, exam) : null;

  return (
    <>
      <StepHeading n={3} icon={CalendarDays} title="Milestone Date" subtitle="Set your exam or project completion deadline" />
      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="rounded-[2px] border border-neutral-200 dark:border-[#2e2e33]">
          <div className="flex items-center justify-between bg-accent-50/60 px-5 py-4 dark:bg-accent-500/10">
            <span className="text-sm font-bold tracking-[0.12em] uppercase">
              {view.toLocaleString("en-US", { month: "long" })} {view.getFullYear()}
            </span>
            <span className="flex gap-1.5">
              {[-1, 1].map((n) => (
                <button
                  key={n}
                  onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + n, 1))}
                  aria-label={n < 0 ? "Previous month" : "Next month"}
                  className="grid size-8 place-items-center rounded-full border border-neutral-300 hover:bg-white dark:border-neutral-600 dark:hover:bg-neutral-800"
                >
                  {n < 0 ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
                </button>
              ))}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1.5 p-4 text-center">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <span key={d} className="pb-2 text-[11px] font-bold tracking-wide text-neutral-500 uppercase">
                {d}
              </span>
            ))}
            {cells.map((iso, i) =>
              iso ? (
                <button
                  key={iso}
                  disabled={iso <= today}
                  onClick={() => setExam(iso)}
                  className={`aspect-[4/3] rounded-[2px] text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                    iso === exam
                      ? "bg-accent-500 text-white"
                      : iso === today
                        ? "border border-accent-500 text-accent-500"
                        : "bg-neutral-50 hover:bg-neutral-100 dark:bg-[#202024] dark:hover:bg-neutral-800"
                  }`}
                >
                  {Number(iso.slice(8))}
                </button>
              ) : (
                <span key={`b${i}`} />
              ),
            )}
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-[2px] border border-neutral-200 p-4 dark:border-[#2e2e33]">
            <p className={eyebrow}>Quick timelines</p>
            <div className="mt-3 space-y-2">
              {QUICK.map((q) => {
                const date = addDays(today, q.days);
                return (
                  <button
                    key={q.days}
                    onClick={() => {
                      setExam(date);
                      const [y, m] = date.split("-").map(Number);
                      setView(new Date(y, m - 1, 1));
                    }}
                    className={`w-full rounded-[2px] py-2.5 text-sm font-semibold transition-colors ${
                      exam === date ? "bg-accent-500 text-white" : "bg-neutral-50 hover:bg-neutral-100 dark:bg-[#202024] dark:hover:bg-neutral-800"
                    }`}
                  >
                    {q.label} ({q.days}d)
                  </button>
                );
              })}
            </div>
          </div>
          <div className="rounded-[2px] bg-accent-50 p-5 text-center dark:bg-accent-500/15">
            <p className="text-5xl font-black text-accent-500">{until ?? "—"}</p>
            <p className="mt-1 text-[11px] font-bold tracking-[0.12em] text-accent-500/80 uppercase">Days until exam</p>
          </div>
        </div>
      </div>
    </>
  );
}

function HabitsStep({ hours, setHours, slots, toggleSlot }: { hours: number; setHours: (h: number) => void; slots: TimeSlot[]; toggleSlot: (s: TimeSlot) => void }) {
  return (
    <>
      <StepHeading n={4} icon={SlidersHorizontal} title="Intensity & Timing" subtitle="Define your daily study limits and efficiency windows" />
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div>
          <div className="flex items-end justify-between border-b border-neutral-200 pb-3 dark:border-[#2e2e33]">
            <span className={eyebrow}>Studying capacity</span>
            <span className="text-3xl font-black text-accent-500">{hours}h</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            aria-label="Hours per day"
            className="mt-6 w-full accent-accent-500"
          />
          <div className={`mt-3 flex justify-between ${eyebrow}`}>
            <span>Casual</span>
            <span>Intensive</span>
            <span>Elite</span>
          </div>
        </div>
        <div>
          <p className={eyebrow}>Efficiency slots</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {TIME_SLOTS.map((s) => {
              const on = slots.includes(s);
              const info = SLOT_INFO[s];
              return (
                <button
                  key={s}
                  onClick={() => toggleSlot(s)}
                  aria-pressed={on}
                  className={`flex items-center gap-3 rounded-[2px] border px-4 py-4 text-left transition-colors ${
                    on ? "border-accent-500 bg-accent-50/50 dark:bg-accent-500/10" : "border-neutral-200 hover:border-neutral-400 dark:border-[#2e2e33]"
                  }`}
                >
                  <span className="text-2xl" aria-hidden>
                    {info.emoji}
                  </span>
                  <span>
                    <span className={`block font-semibold ${on ? "text-accent-500" : ""}`}>{info.label}</span>
                    <span className="text-[11px] font-bold text-neutral-500 uppercase">{info.hours}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {slots.length === 0 && <p className="mt-2 text-sm text-red-500">Pick at least one time slot.</p>}
        </div>
      </div>
    </>
  );
}

const PHASES: Record<CreateProgress, { emoji: string; title: string; subtitle: string; from: number; to: number }> = {
  scheduling: { emoji: "🔍", title: "Analyzing preferences", subtitle: "Understanding your study habits and time constraints", from: 0, to: 20 },
  saving: { emoji: "🗓️", title: "Building your schedule", subtitle: "Placing reading, quizzes and reviews on your calendar", from: 20, to: 45 },
  tips: { emoji: "✨", title: "Writing study tips", subtitle: "Tailoring guidance to each chapter", from: 45, to: 95 },
  done: { emoji: "🎉", title: "Plan ready", subtitle: "Your study plan is set up", from: 100, to: 100 },
};

/** Progress screen shown while a plan is created; the percentage eases toward each phase's ceiling. */
function GeneratingScreen({ phase, chapters }: { phase: CreateProgress; chapters: number }) {
  const p = PHASES[phase];
  const [pct, setPct] = useState(p.from);
  useEffect(() => {
    setPct((v) => Math.max(v, p.from));
    if (p.from === p.to) return;
    const id = setInterval(() => setPct((v) => (v < p.to ? v + Math.max(0.3, (p.to - v) / 25) : v)), 200);
    return () => clearInterval(id);
  }, [p.from, p.to]);
  const tips = [`Organizing ${chapters} chapter${chapters === 1 ? "" : "s"} for optimal learning`, "Spacing quizzes after reading helps you remember more", "Keeping the day before the exam free for review"];
  const tip = tips[Math.floor(pct / 34) % tips.length];

  return (
    <div>
      <div className="overflow-hidden rounded-[2px] border border-neutral-200 dark:border-[#2e2e33]">
        <div className="h-1 bg-neutral-200 dark:bg-[#2e2e33]">
          <div className="h-full bg-accent-500 transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <div className="px-6 py-12 text-center">
          <span className="mx-auto grid size-24 place-items-center rounded-[2px] border border-accent-500/30 bg-accent-50 text-5xl dark:bg-accent-500/10" aria-hidden>
            {p.emoji}
          </span>
          <h3 className="mt-6 text-3xl font-bold text-accent-500">{p.title}</h3>
          <p className="mt-2 text-lg text-neutral-500">{p.subtitle}</p>
          <div className="mx-auto mt-8 max-w-md">
            <div className="flex items-end justify-between">
              <span className="text-xs font-bold tracking-wide text-neutral-500 uppercase">Plan initializing</span>
              <span className="text-2xl font-bold text-accent-500">{Math.round(pct)}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-[#2e2e33]">
              <div className="h-full rounded-full bg-accent-500 transition-[width] duration-300" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      </div>
      <p className="mt-4 flex items-center gap-3 rounded-[2px] border border-accent-500/20 bg-accent-50/60 px-5 py-4 italic dark:bg-accent-500/10">
        <span aria-hidden>💡</span> {tip}
      </p>
    </div>
  );
}

export function PlanWizard({ onClose, planNumber }: { onClose: () => void; planNumber: number }) {
  const docs = useDocuments();
  const { createPlan } = usePlannerMutations();
  const today = localIsoDate(new Date());

  const [step, setStep] = useState(0); // 0 = intro, 1..5 = steps
  const [title, setTitle] = useState("");
  const [docIds, setDocIds] = useState<string[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [exam, setExam] = useState("");
  const [hours, setHours] = useState(4);
  const [slots, setSlots] = useState<TimeSlot[]>(["morning", "afternoon"]);

  const chapters = useChaptersFor(docIds);
  const allChapters = useMemo(() => docIds.flatMap((id) => chapters.byDocument[id] ?? []), [docIds, chapters.byDocument]);
  const chosen = allChapters.filter((c) => picked.has(c.id));

  // Newly loaded chapters start selected; chapters of deselected PDFs drop out.
  const [seen] = useState(() => new Set<string>());
  const allIds = allChapters.map((c) => c.id).join();
  useEffect(() => {
    setPicked((prev) => {
      const next = new Set<string>();
      for (const c of allChapters) if (prev.has(c.id) || !seen.has(c.id)) next.add(c.id);
      for (const c of allChapters) seen.add(c.id);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allIds]);

  const minutesPerDay = Math.round(hours * 60);
  const preview = useMemo(
    () => (exam && chosen.length ? previewSchedule({ chapters: chosen, examDate: exam, minutesPerDay, slots }) : null),
    [exam, chosen, minutesPerDay, slots],
  );

  const canNext = [
    title.trim().length > 0,
    docIds.length > 0,
    chosen.length > 0,
    !!exam && exam > today,
    slots.length > 0,
    !!preview?.ok,
  ][step];

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const docList = docs.data ?? [];
  const pickedDocs = docList.filter((d) => docIds.includes(d.id));

  const [phase, setPhase] = useState<CreateProgress | null>(null);

  function next() {
    if (!canNext) return;
    if (step < 5) setStep(step + 1);
    else
      createPlan.mutate(
        {
          plan: { title: title.trim(), examDate: exam, documentIds: docIds, chapters: chosen, minutesPerDay, slots },
          onProgress: setPhase,
        },
        { onSuccess: () => setTimeout(onClose, 700), onError: () => setPhase(null) },
      );
  }

  const until = exam ? daysBetween(today, exam) : 0;

  if (phase) {
    return (
      <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4">
        <div role="dialog" aria-label="Creating your plan" className="surface w-full max-w-[900px] rounded-[2px] border border-neutral-200 shadow-2xl dark:border-[#2e2e33]">
          <header className="flex items-center gap-4 border-b border-neutral-200 px-7 py-5 dark:border-[#2e2e33]">
            <Sparkles className="size-5 text-accent-500" />
            <h2 className={`text-lg ${caps}`}>Plan Architect</h2>
          </header>
          <div className="p-7">
            <GeneratingScreen phase={phase} chapters={chosen.length} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Plan builder"
        onClick={(e) => e.stopPropagation()}
        className="surface flex max-h-[92vh] w-full max-w-[900px] flex-col rounded-[2px] border border-neutral-200 shadow-2xl dark:border-[#2e2e33]"
      >
        <header className="flex items-center gap-4 border-b border-neutral-200 px-7 py-5 dark:border-[#2e2e33]">
          <Sparkles className="size-5 text-accent-500" />
          <h2 className={`text-lg ${caps}`}>Plan Architect</h2>
          {step > 0 && <span className="rounded-[2px] bg-neutral-100 px-2.5 py-1 text-xs font-bold tracking-wider text-neutral-500 dark:bg-[#2a2a2e]">STEP {step}/5</span>}
          <button onClick={onClose} aria-label="Close" className="ml-auto grid size-8 place-items-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <X className="size-5" />
          </button>
        </header>

        {step > 0 && (
          <div className="flex items-center gap-4 border-b border-neutral-200 px-7 py-4 dark:border-[#2e2e33]">
            {STEPS.map((label, i) => {
              const n = i + 1;
              return (
                <div key={label} className={`flex items-center gap-3 ${n === step ? "flex-[1.4]" : "flex-1"}`}>
                  <span className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-accent-500" : "bg-neutral-200 dark:bg-[#2e2e33]"}`} />
                  {n === step && <span className="text-xs font-bold text-accent-500 uppercase italic">{label}</span>}
                </div>
              );
            })}
          </div>
        )}

        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-7 py-7">
          {step === 0 && (
            <div className="py-6 text-center">
              <span className="mx-auto grid size-24 place-items-center rounded-[2px] bg-accent-500 text-white shadow-lg shadow-accent-500/20">
                <GraduationCap className="size-11" />
              </span>
              <h3 className={`mt-8 text-4xl ${caps} normal-case`}>Design Your Success</h3>
              <p className="mx-auto mt-3 max-w-md text-lg text-neutral-500">Transform your study materials into a personalized achievement roadmap.</p>
              <label className="mx-auto mt-10 block max-w-md text-left">
                <span className={eyebrow}>Plan identification</span>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && next()}
                  maxLength={200}
                  placeholder="e.g. Finals Prep 2026"
                  className="field mt-2 py-5 text-center text-xl font-semibold"
                />
              </label>
            </div>
          )}

          {step === 1 && <PdfStep docs={docList} picked={docIds} toggle={(id) => setDocIds((l) => toggle(l, id))} />}

          {step === 2 && (
            <>
              <StepHeading
                n={2}
                icon={SlidersHorizontal}
                title="Chapter Selection"
                subtitle="Pinpoint specific topics to prioritize"
                right={
                  <span className="flex gap-4 text-xs font-bold tracking-[0.12em] uppercase">
                    <button onClick={() => setPicked(new Set(allChapters.map((c) => c.id)))} className="text-accent-500 hover:underline">
                      Select all
                    </button>
                    <button onClick={() => setPicked(new Set())} className="text-neutral-500 hover:underline">
                      Clear
                    </button>
                  </span>
                }
              />
              {chapters.pending ? (
                <p className="mt-6 text-sm text-neutral-400">Loading chapters…</p>
              ) : (
                <div className="mt-6 space-y-3">
                  {pickedDocs.map((d) => (
                    <ChapterGroup
                      key={d.id}
                      doc={d}
                      chapters={chapters.byDocument[d.id] ?? []}
                      picked={picked}
                      toggle={(id) =>
                        setPicked((s) => {
                          const n = new Set(s);
                          if (n.has(id)) n.delete(id);
                          else n.add(id);
                          return n;
                        })
                      }
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {step === 3 && <DateStep exam={exam} setExam={setExam} today={today} />}

          {step === 4 && <HabitsStep hours={hours} setHours={setHours} slots={slots} toggleSlot={(s) => setSlots((l) => toggle(l, s))} />}

          {step === 5 && (
            <>
              <StepHeading n={5} icon={Ticket} title="Final Review" subtitle="Confirm your plan details before creating it" />
              <div className="mt-6 flex overflow-hidden rounded-[2px] border border-neutral-200 dark:border-[#2e2e33]">
                <div className="flex w-28 shrink-0 flex-col items-center justify-between border-r border-dashed border-accent-500/40 bg-accent-50 py-6 dark:bg-accent-500/10">
                  <span className="text-[10px] font-bold tracking-[0.3em] text-accent-500/70 uppercase [writing-mode:vertical-rl]">Plan-ticket</span>
                  <span className={`text-xl text-accent-500 ${caps}`}>#S-{String(planNumber).padStart(2, "0")}</span>
                </div>
                <div className="flex-1 p-6">
                  <p className={eyebrow}>Plan name</p>
                  <p className={`mt-1 text-3xl normal-case ${caps}`}>{title}</p>
                  <div className="mt-6 grid grid-cols-2 gap-y-5">
                    <div>
                      <p className={eyebrow}>Exam date</p>
                      <p className="mt-1 text-lg font-semibold">
                        {new Date(exam + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={eyebrow}>Content</p>
                      <p className="mt-1 text-lg font-semibold">
                        {chosen.length} Chapter{chosen.length === 1 ? "" : "s"}
                        {docIds.length > 1 ? ` · ${docIds.length} PDFs` : ""}
                      </p>
                    </div>
                    <div>
                      <p className={eyebrow}>Intensity</p>
                      <p className="mt-1 text-lg font-semibold">{hours}h Daily</p>
                    </div>
                    <div className="text-right">
                      <p className={eyebrow}>Timeframe</p>
                      <p className="mt-1 text-lg font-semibold">
                        {until} Day{until === 1 ? "" : "s"} Left
                      </p>
                    </div>
                  </div>
                  <p className="mt-6 text-sm text-neutral-500">
                    {preview?.ok
                      ? `${preview.sessions.length} sessions in your ${slots.map((s) => SLOT_INFO[s].label.toLowerCase()).join(" / ")} slots${preview.reviewDay ? ", with the day before the exam for review" : ""}.`
                      : preview?.error}
                  </p>
                </div>
              </div>
              {createPlan.isError && (
                <p role="alert" className="mt-4 text-sm text-red-500">
                  {createPlan.error.message}
                </p>
              )}
            </>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-neutral-200 px-7 py-5 dark:border-[#2e2e33]">
          <button
            onClick={() => (step === 0 ? onClose() : setStep(step - 1))}
            className="flex items-center gap-2 text-sm font-semibold text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
          >
            <ArrowLeft className="size-4" /> {step === 0 ? "Cancel" : "Back"}
          </button>
          <button
            onClick={next}
            disabled={!canNext || createPlan.isPending}
            className="btn-primary flex h-12 items-center gap-2 rounded-[2px] px-7 text-sm font-semibold disabled:opacity-40"
          >
            {createPlan.isPending && <Loader2 className="size-4 animate-spin" />}
            {step === 5 ? "Create Plan" : "Next Step"} <ArrowRight className="size-4" />
          </button>
        </footer>
      </div>
    </div>
  );
}
