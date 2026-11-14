import {
  ArrowRight,
  CalendarDays,
  Clock,
  Crown,
  FileText,
  FileStack,
  HelpCircle,
  Home,
  NotebookText,
  Search,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { usage } from "../data";

export type NavKey = "dashboard" | "pdfs" | "quizzes" | "planner" | "settings";

export const NAV: { key: NavKey; label: string; path: string; icon: LucideIcon }[] = [
  { key: "dashboard", label: "Dashboard", path: "/dashboard", icon: Home },
  { key: "pdfs", label: "My PDFs", path: "/pdfs", icon: FileText },
  { key: "quizzes", label: "Quiz History", path: "/quiz-history", icon: Clock },
  { key: "planner", label: "Study Planner", path: "/study-planner", icon: CalendarDays },
  { key: "settings", label: "Settings", path: "/settings", icon: Settings },
];

const USAGE_ICONS: Record<(typeof usage)[number]["icon"], LucideIcon> = {
  file: FileText,
  quiz: FileStack,
  summary: NotebookText,
  help: HelpCircle,
  search: Search,
  calendar: CalendarDays,
};

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

      {!collapsed && (
        <div className="border-t border-neutral-200 p-4 dark:border-[#2e2e33]">
          <section
            aria-label="Upgrade to Pro promotion"
            className="rounded-sm border border-neutral-200 bg-neutral-50 p-4 dark:border-[#2e2e33] dark:bg-[#202024]"
          >
            <div className="flex items-center gap-3">
              <span className="btn-primary grid size-10 place-items-center rounded-sm">
                <Crown className="size-5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold">Upgrade to Pro</h2>
                <p className="text-xs text-neutral-500">Unlimited everything</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-[13px]">
              {usage.map((u) => {
                const Icon = USAGE_ICONS[u.icon];
                return (
                  <li key={u.label} className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                    <Icon className="size-4" />
                    <span className="flex-1">{u.label}</span>
                    <span className="font-medium text-neutral-900 tabular-nums dark:text-neutral-100">
                      {u.used}/{u.limit}
                    </span>
                  </li>
                );
              })}
            </ul>
            <button className="mt-4 w-full text-center text-xs font-medium hover:underline dark:text-accent-500">View Details →</button>
            <button className="btn-primary mt-2 flex w-full items-center justify-center gap-2 rounded-sm py-2 text-sm font-medium">
              Upgrade Now <ArrowRight className="size-4" />
            </button>
          </section>
        </div>
      )}
    </aside>
  );
}
