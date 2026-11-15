// Quick finder (Ctrl/⌘ + K) across pages, PDFs, chapters, quizzes and plans.
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarDays, CornerDownLeft, FileText, GraduationCap, Search, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Backdrop, Panel } from "./motion";
import { NAV } from "./Sidebar";
import { useStudyPlans } from "../lib/dashboard";
import { useDocuments } from "../lib/library";
import { useAllQuizzes } from "../lib/quizzes";
import { supabase } from "../lib/supabase";
import { navigate } from "../router";

type Result = { id: string; group: string; title: string; subtitle?: string; icon: LucideIcon; go: () => void };

function useAllChapters(enabled: boolean) {
  return useQuery({
    queryKey: ["chapters", "all-titles"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("document_chapters").select("id, title, document_id, start_page").limit(1000);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export function SearchPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const docs = useDocuments();
  const quizzes = useAllQuizzes();
  const plans = useStudyPlans();
  const chapters = useAllChapters(true);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const match = (...texts: (string | null | undefined)[]) => !q || texts.some((t) => t?.toLowerCase().includes(q));
    const docTitle = (id: string) => docs.data?.find((d) => d.id === id)?.title;
    const out: Result[] = [];
    for (const n of NAV) if (match(n.label)) out.push({ id: `page-${n.key}`, group: "Pages", title: n.label, icon: n.icon, go: () => navigate(n.path) });
    for (const d of docs.data ?? [])
      if (match(d.title)) out.push({ id: `doc-${d.id}`, group: "PDFs", title: d.title, subtitle: `${d.page_count ?? "?"} pages`, icon: FileText, go: () => navigate("/pdfs") });
    if (q)
      for (const c of chapters.data ?? [])
        if (match(c.title))
          out.push({ id: `ch-${c.id}`, group: "Chapters", title: c.title, subtitle: `${docTitle(c.document_id) ?? "PDF"} · page ${c.start_page}`, icon: BookOpen, go: () => navigate("/pdfs") });
    for (const z of quizzes.data ?? [])
      if (match(z.title, z.document_title))
        out.push({ id: `quiz-${z.id}`, group: "Quizzes", title: z.title, subtitle: `${z.question_count} questions`, icon: GraduationCap, go: () => navigate(`/quiz/${z.id}`) });
    for (const p of plans.data ?? [])
      if (match(p.title)) out.push({ id: `plan-${p.id}`, group: "Study plans", title: p.title, subtitle: `Exam ${p.exam_date}`, icon: CalendarDays, go: () => navigate("/study-planner") });
    return out.slice(0, 40);
  }, [query, docs.data, quizzes.data, plans.data, chapters.data]);

  useEffect(() => setCursor(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const choose = (r: Result | undefined) => {
    if (!r) return;
    r.go();
    onClose();
  };

  let lastGroup = "";
  return (
    <Backdrop onClick={onClose} className="z-50 flex items-start justify-center p-4 pt-[12vh]">
      <Panel role="dialog" aria-label="Search" className="surface w-full max-w-xl overflow-hidden rounded-[2px] border border-neutral-200 shadow-2xl dark:border-[#2e2e33]">
        <label className="flex items-center gap-3 border-b border-neutral-200 px-4 dark:border-[#2e2e33]">
          <Search className="size-5 text-neutral-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === "Enter") choose(results[cursor]);
              else if (e.key === "Escape") onClose();
            }}
            placeholder="Search PDFs, chapters, quizzes, plans…"
            aria-label="Search"
            className="h-14 flex-1 bg-transparent text-[15px] outline-none"
          />
          <kbd className="rounded border border-neutral-200 px-1.5 text-xs text-neutral-500 dark:border-[#2e2e33]">Esc</kbd>
        </label>
        <ul ref={listRef} className="thin-scroll max-h-[50vh] overflow-y-auto p-2" role="listbox">
          {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-neutral-500">No matches for “{query}”.</li>}
          <AnimatePresence initial={false}>
            {results.map((r, i) => {
              const header = r.group !== lastGroup ? r.group : null;
              lastGroup = r.group;
              const Icon = r.icon;
              return (
                <motion.li key={r.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {header && <p className="px-3 pt-3 pb-1 text-[11px] font-bold tracking-wider text-neutral-500 uppercase">{header}</p>}
                  <button
                    data-index={i}
                    role="option"
                    aria-selected={i === cursor}
                    onMouseMove={() => setCursor(i)}
                    onClick={() => choose(r)}
                    className={`flex w-full items-center gap-3 rounded-[2px] px-3 py-2.5 text-left ${i === cursor ? "bg-accent-50 dark:bg-accent-500/15" : ""}`}
                  >
                    <Icon className={`size-4 shrink-0 ${i === cursor ? "text-accent-500" : "text-neutral-400"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.title}</span>
                      {r.subtitle && <span className="block truncate text-xs text-neutral-500">{r.subtitle}</span>}
                    </span>
                    {i === cursor && <CornerDownLeft className="size-4 text-neutral-400" />}
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </Panel>
    </Backdrop>
  );
}
