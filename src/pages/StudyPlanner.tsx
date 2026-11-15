import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarCheck, CalendarDays, CheckCircle2, Clock, List, Loader2, MoreVertical, Pause, Play, Plus, Trash2 } from "lucide-react";
import { IconTile, PageBody, PageHeader } from "../components/ui";
import { AnimatePresence, motion } from "motion/react";
import { Pop, ProgressBar, SPRING, Stagger, StaggerItem } from "../components/motion";
import { PlanWizard } from "../components/PlanWizard";
import { PlanBoard } from "../components/planner/PlanBoard";
import { PlanCalendar } from "../components/planner/PlanCalendar";
import { PlanTimeline } from "../components/planner/PlanTimeline";
import { SessionDialog } from "../components/planner/SessionDialog";
import { longDate, statusOf } from "../components/planner/shared";
import { localIsoDate, useStudyPlans, useStudySessions, type StudyPlanRow, type StudySessionRow } from "../lib/dashboard";
import { usePlannerMutations } from "../lib/planner";

type View = "calendar" | "board" | "timeline";
const VIEWS: { key: View; label: string; icon: typeof CalendarDays }[] = [
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "board", label: "Board", icon: List },
  { key: "timeline", label: "Timeline", icon: Clock },
];

function Stat({ icon: Icon, tint, value, label, bar, danger }: { icon: typeof Clock; tint: string; value: string; label: string; bar?: number; danger?: boolean }) {
  return (
    <StaggerItem className="dot-card lift flex flex-col justify-center px-5 py-4">
      <span className="dots" />
      <div className="flex items-center gap-4">
        <span className={`grid size-11 shrink-0 place-items-center rounded-sm ${tint}`}>
          <Icon className="size-5" />
        </span>
        <span>
          <span className={`block text-2xl leading-none font-bold ${danger ? "text-red-500" : ""}`}>{value}</span>
          <span className="mt-1.5 block text-sm text-neutral-500">{label}</span>
        </span>
      </div>
      {bar !== undefined && (
        <ProgressBar value={bar} className="mt-3 h-1" />
      )}
    </StaggerItem>
  );
}

function PlanCard({ plan, sessions, selected, onSelect }: { plan: StudyPlanRow; sessions: StudySessionRow[]; selected: boolean; onSelect: () => void }) {
  const { setPlanPaused, deletePlan } = usePlannerMutations();
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const done = sessions.filter((s) => statusOf(s) === "completed").length;
  const pct = sessions.length ? Math.round((done / sessions.length) * 100) : 0;
  const paused = plan.status === "paused";

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect()}
      aria-pressed={selected}
      className={`dot-card lift relative w-full cursor-pointer p-6 text-left transition-shadow sm:w-80 ${selected ? "ring-2 ring-accent-500" : ""} ${paused ? "opacity-70" : ""}`}
    >
      <span className="dots" />
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold" title={plan.title}>
            {plan.title}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Exam {longDate(plan.exam_date)}
            {paused && <span className="ml-2 rounded-[2px] bg-neutral-200 px-1.5 text-xs font-semibold dark:bg-[#2a2a2e]">Paused</span>}
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenu((m) => !m);
          }}
          aria-label={`Options for ${plan.title}`}
          aria-haspopup="menu"
          aria-expanded={menu}
          className="grid size-7 place-items-center rounded text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <MoreVertical className="size-4" />
        </button>
      </div>
      <div className="mt-6 flex items-center justify-between text-sm font-bold tracking-wide uppercase">
        <span className="text-neutral-500">
          {done} / {sessions.length} sessions
        </span>
        <span>{pct}%</span>
      </div>
      <ProgressBar value={pct} className="mt-2 h-1.5" />

      <AnimatePresence>
      {menu && (
        <Pop key="menu" role="menu" onClick={(e) => e.stopPropagation()} className="surface absolute top-12 right-4 z-20 w-44 rounded-[2px] border border-neutral-200 py-1 shadow-lg dark:border-[#2e2e33]">
          <button
            role="menuitem"
            onClick={() => {
              setMenu(false);
              setPlanPaused.mutate({ planId: plan.id, paused: !paused });
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-bold tracking-wide text-amber-600 uppercase hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            {paused ? <Play className="size-4" /> : <Pause className="size-4" />} {paused ? "Resume plan" : "Pause plan"}
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setMenu(false);
              if (window.confirm(`Delete the plan "${plan.title}" and all its sessions? This cannot be undone.`)) deletePlan.mutate(plan.id);
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-bold tracking-wide text-red-500 uppercase hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <Trash2 className="size-4" /> Delete plan
          </button>
        </Pop>
      )}
      </AnimatePresence>
    </div>
  );
}

export function StudyPlanner() {
  const plans = useStudyPlans();
  const sessionsQuery = useStudySessions();
  const { setStatus } = usePlannerMutations();
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<View>("calendar");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useMemo(() => plans.data ?? [], [plans.data]);
  const allSessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);
  const visiblePlans = selectedPlan ? list.filter((p) => p.id === selectedPlan) : list;
  // Paused plans keep their sessions out of the views until resumed, unless that plan is selected.
  const visibleSessions = allSessions.filter((s) => {
    const plan = list.find((p) => p.id === s.plan_id);
    return selectedPlan ? s.plan_id === selectedPlan : plan?.status !== "paused";
  });
  const openSession = allSessions.find((s) => s.id === openId) ?? null;

  const today = localIsoDate(new Date());
  const active = list.filter((p) => p.status !== "paused").length;
  const completed = allSessions.filter((s) => statusOf(s) === "completed").length;
  const overdue = allSessions.filter((s) => s.scheduled_for < today && ["todo", "in_progress"].includes(statusOf(s))).length;
  const progress = allSessions.length ? Math.round((completed / allSessions.length) * 100) : 0;
  const planDoc = (planId: string) => list.find((p) => p.id === planId)?.document_id ?? null;

  const newPlanButton = (label: string) => (
    <button onClick={() => setCreating(true)} className="btn-primary inline-flex h-12 items-center gap-2 rounded-[2px] px-6 text-[15px] font-medium">
      <Plus className="size-5" /> {label}
    </button>
  );

  const data = { plans: visiblePlans, sessions: visibleSessions, onOpen: (s: StudySessionRow) => setOpenId(s.id) };

  return (
    <PageBody>
      <PageHeader
        title="Study Planner"
        subtitle="Create AI-powered study plans, map chapters to your exams, and practice with quizzes."
        actions={list.length > 0 ? newPlanButton("New Study Plan") : undefined}
      />

      {plans.isPending || sessionsQuery.isPending ? (
        <div className="mt-8 grid h-48 place-items-center text-neutral-400">
          <Loader2 className="size-6 animate-spin" aria-label="Loading plans" />
        </div>
      ) : plans.isError || sessionsQuery.isError ? (
        <p role="alert" className="mt-8 text-red-500">
          Could not load your plans: {(plans.error ?? sessionsQuery.error)?.message}
        </p>
      ) : list.length === 0 ? (
        <div className="mt-8 rounded-sm border border-dashed border-neutral-300 px-6 py-28 text-center dark:border-[#3a3a40]">
          <IconTile icon={CalendarDays} className="mx-auto text-accent-500" />
          <h3 className="mt-8 text-xl font-bold">No Study Plans Yet</h3>
          <p className="mx-auto mt-3 max-w-sm text-neutral-500">Create an AI-powered study plan by picking your chapters and exam date.</p>
          <div className="mt-8">{newPlanButton("Create Your First Plan")}</div>
        </div>
      ) : (
        <>
          <Stagger className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={CalendarCheck} tint="bg-accent-50 text-accent-500 dark:bg-accent-500/15" value={`${active} / ${list.length}`} label="Active Plans" />
            <Stat icon={CheckCircle2} tint="bg-green-50 text-green-600 dark:bg-green-500/15" value={`${completed} / ${allSessions.length}`} label="Completed Sessions" />
            <Stat icon={Clock} tint="bg-sky-50 text-sky-600 dark:bg-sky-500/15" value={`${progress}%`} label="Overall Progress" bar={progress} />
            <Stat icon={AlertTriangle} tint="bg-red-50 text-red-500 dark:bg-red-500/15" value={String(overdue)} label="Overdue Sessions" danger={overdue > 0} />
          </Stagger>

          <div className="mt-8 flex w-fit rounded-[2px] border border-neutral-200 p-1 dark:border-[#2e2e33]">
            {VIEWS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`relative flex items-center gap-2 rounded-[2px] px-5 py-2 text-sm font-bold tracking-wider uppercase transition-colors ${view === key ? "text-white" : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"}`}
              >
                {view === key && <motion.span layoutId="planner-view" transition={SPRING} className="absolute inset-0 rounded-[2px] bg-neutral-950 dark:bg-accent-500" aria-hidden />}
                <Icon className="relative size-4" /> <span className="relative">{label}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 border-t border-neutral-200 pt-6 dark:border-[#2e2e33]">
            <button
              onClick={() => setSelectedPlan(null)}
              className={`text-sm font-bold tracking-wider uppercase ${selectedPlan ? "text-neutral-500 hover:text-neutral-900 dark:hover:text-white" : "text-accent-500"}`}
            >
              All plans <span className="text-neutral-500">({allSessions.length})</span>
            </button>
            <div className="mt-4 flex flex-wrap gap-4">
              {list.map((p) => (
                <PlanCard
                  key={p.id}
                  plan={p}
                  sessions={allSessions.filter((s) => s.plan_id === p.id)}
                  selected={selectedPlan === p.id}
                  onSelect={() => setSelectedPlan((cur) => (cur === p.id ? null : p.id))}
                />
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
          <motion.div key={view} className="mt-8" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.25 } }} exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}>
            {view === "calendar" && <PlanCalendar {...data} />}
            {view === "board" && (
              <PlanBoard {...data} onMove={(s, status) => setStatus.mutate({ session: s, status, documentId: planDoc(s.plan_id) })} />
            )}
            {view === "timeline" && <PlanTimeline {...data} />}
          </motion.div>
          </AnimatePresence>
          {setStatus.isError && (
            <p role="alert" className="mt-3 text-sm text-red-500">
              {setStatus.error.message}
            </p>
          )}
        </>
      )}

      <AnimatePresence>{creating && <PlanWizard key="wizard" planNumber={list.length + 1} onClose={() => setCreating(false)} />}</AnimatePresence>
      <AnimatePresence>{openSession && <SessionDialog key="session" session={openSession} onClose={() => setOpenId(null)} />}</AnimatePresence>
    </PageBody>
  );
}
