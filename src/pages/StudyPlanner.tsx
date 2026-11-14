import { useState } from "react";
import { CalendarDays, GraduationCap, Plus, Trash2, X } from "lucide-react";
import { IconTile, PageBody, PageHeader } from "../components/ui";
import { documents, studyPlans as seedPlans, type StudyPlan } from "../data";

function daysUntil(iso: string) {
  const ms = new Date(iso + "T00:00:00").getTime() - new Date(new Date().toDateString()).getTime();
  return Math.round(ms / 86_400_000);
}

function NewPlanDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (p: StudyPlan) => void }) {
  const [title, setTitle] = useState("");
  const [exam, setExam] = useState("");
  const [pdf, setPdf] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const valid = title.trim() && exam && exam >= today;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form
        role="dialog"
        aria-label="Create study plan"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onCreate({ id: crypto.randomUUID(), title: title.trim(), exam });
        }}
        className="surface w-full max-w-md rounded-sm border border-neutral-200 p-6 shadow-xl dark:border-[#2e2e33]"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">New Study Plan</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <X className="size-4" />
          </button>
        </div>
        <label className="mt-5 block text-sm font-medium">
          Plan name
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Biology midterm" className="field mt-1.5" />
        </label>
        <label className="mt-4 block text-sm font-medium">
          Exam date
          <input type="date" min={today} value={exam} onChange={(e) => setExam(e.target.value)} className="field mt-1.5" />
        </label>
        <label className="mt-4 block text-sm font-medium">
          Source PDF
          <select value={pdf} onChange={(e) => setPdf(e.target.value)} disabled={documents.length === 0} className="field mt-1.5 disabled:opacity-60">
            <option value="">{documents.length === 0 ? "Upload a PDF to pick chapters" : "Choose a PDF"}</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary rounded-[2px] px-4 py-2 text-sm font-medium">
            Cancel
          </button>
          <button disabled={!valid} className="btn-primary rounded-[2px] px-4 py-2 text-sm font-medium disabled:opacity-50">
            Create Plan
          </button>
        </div>
      </form>
    </div>
  );
}

export function StudyPlanner() {
  const [plans, setPlans] = useState<StudyPlan[]>(seedPlans);
  const [creating, setCreating] = useState(false);

  const createButton = (label: string) => (
    <button onClick={() => setCreating(true)} className="btn-primary inline-flex h-12 items-center gap-2 rounded-[2px] px-6 text-[15px] font-medium">
      <Plus className="size-5" /> {label}
    </button>
  );

  return (
    <PageBody>
      <PageHeader
        title="Study Planner"
        subtitle="Create AI-powered study plans, map chapters to your exams, and practice with quizzes."
        actions={plans.length > 0 ? createButton("New Plan") : undefined}
      />

      {plans.length === 0 ? (
        <div className="mt-8 rounded-sm border border-dashed border-neutral-300 px-6 py-28 text-center dark:border-[#3a3a40]">
          <IconTile icon={CalendarDays} className="mx-auto text-accent-500" />
          <h3 className="mt-8 text-xl font-bold">No Study Plans Yet</h3>
          <p className="mx-auto mt-3 max-w-sm text-neutral-500">
            Create an AI-powered study plan by picking your chapters and exam date.
          </p>
          <div className="mt-8">{createButton("Create Your First Plan")}</div>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => {
            const d = daysUntil(p.exam);
            return (
              <li key={p.id} className="dot-card p-6">
                <span className="dots" />
                <div className="flex items-start gap-3">
                  <GraduationCap className="size-6 text-accent-500" />
                  <div className="flex-1">
                    <p className="font-semibold">{p.title}</p>
                    <p className="mt-1 text-sm text-neutral-500">Exam {new Date(p.exam + "T00:00:00").toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={() => setPlans((ps) => ps.filter((x) => x.id !== p.id))}
                    aria-label={`Delete ${p.title}`}
                    className="grid size-8 place-items-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-red-500 dark:hover:bg-neutral-800"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <p className="mt-4 text-sm font-medium text-accent-500">
                  {d === 0 ? "Exam is today" : `${d} day${d === 1 ? "" : "s"} to go`}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {creating && (
        <NewPlanDialog
          onClose={() => setCreating(false)}
          onCreate={(p) => {
            setPlans((ps) => [...ps, p]);
            setCreating(false);
          }}
        />
      )}
    </PageBody>
  );
}
