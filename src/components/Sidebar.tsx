import { CalendarDays, Clock, FileText, Home, Settings, type LucideIcon } from "lucide-react";

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
    <aside
      className={`hidden shrink-0 flex-col border-r border-neutral-200 bg-white transition-[width] duration-200 md:flex dark:border-[#2e2e33] dark:bg-[#1c1c1f] ${
        collapsed ? "w-[72px]" : "w-[288px]"
      }`}
    >
      <nav className="flex-1 space-y-1.5 p-3">
        {NAV.map(({ key, label, icon: Icon }) => {
          const isActive = key === active;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              title={collapsed ? label : undefined}
              className={`flex w-full items-center gap-3 rounded-[2px] px-3.5 py-2.5 text-base font-semibold transition-colors ${
                isActive
                  ? "btn-primary"
                  : "text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
              } ${collapsed ? "justify-center px-0" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="size-5 shrink-0" />
              {!collapsed && <span className="flex-1 text-left">{label}</span>}
              {!collapsed && isActive && <span className="size-1.5 rounded-full bg-white/70" />}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
