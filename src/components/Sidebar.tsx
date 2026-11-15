import { CalendarDays, Clock, FileText, Home, Settings, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { SPRING } from "./motion";

export type NavKey = "dashboard" | "pdfs" | "quizzes" | "planner" | "settings";

export const NAV: { key: NavKey; label: string; path: string; icon: LucideIcon }[] = [
  { key: "dashboard", label: "Dashboard", path: "/dashboard", icon: Home },
  { key: "pdfs", label: "My PDFs", path: "/pdfs", icon: FileText },
  { key: "quizzes", label: "Quiz History", path: "/quiz-history", icon: Clock },
  { key: "planner", label: "Study Planner", path: "/study-planner", icon: CalendarDays },
  { key: "settings", label: "Settings", path: "/settings", icon: Settings },
];

type Props = { collapsed: boolean; active: NavKey; onSelect: (k: NavKey) => void };

export function Sidebar({ collapsed, active, onSelect }: Props) {
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 288 }}
      transition={SPRING}
      className="hidden shrink-0 flex-col overflow-hidden border-r border-neutral-200 bg-white md:flex dark:border-[#2e2e33] dark:bg-[#1c1c1f]"
    >
      <nav className="flex-1 space-y-1.5 p-3">
        {NAV.map(({ key, label, icon: Icon }) => {
          const isActive = key === active;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              title={collapsed ? label : undefined}
              className={`relative flex w-full items-center gap-3 rounded-[2px] px-3.5 py-2.5 text-base font-semibold transition-colors duration-200 ${
                isActive ? "text-white" : "text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
              } ${collapsed ? "justify-center px-0" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              {/* One highlight that slides between items instead of jumping. */}
              {isActive && (
                <motion.span
                  layoutId="sidebar-active"
                  transition={SPRING}
                  className="absolute inset-0 rounded-[2px] bg-neutral-950 dark:bg-accent-500"
                  aria-hidden
                />
              )}
              <Icon className="relative size-5 shrink-0" />
              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.span
                    key="label"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0, transition: { delay: 0.08, duration: 0.2 } }}
                    exit={{ opacity: 0, x: -6, transition: { duration: 0.1 } }}
                    className="relative flex-1 truncate text-left whitespace-nowrap"
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
              {!collapsed && isActive && (
                <motion.span layoutId="sidebar-dot" className="relative size-1.5 rounded-full bg-white/70" transition={SPRING} />
              )}
            </button>
          );
        })}
      </nav>
    </motion.aside>
  );
}
