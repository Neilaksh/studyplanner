import {
  Bell,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  FileText,
  Globe,
  MessageCircle,
  Moon,
  Search,
  Sun,
} from "lucide-react";
import { Logo } from "./Logo";
import { user } from "../data";
import { navigate } from "../router";

type Props = {
  collapsed: boolean;
  onToggleSidebar: () => void;
  dark: boolean;
  onToggleTheme: () => void;
};

const iconBtn =
  "grid size-10 place-items-center rounded-md text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800";

export function Topbar({ collapsed, onToggleSidebar, dark, onToggleTheme }: Props) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 sm:px-6 dark:border-[#2e2e33] dark:bg-[#1c1c1f]">
      <div className="flex items-center gap-4">
        <button
          className={iconBtn}
          onClick={onToggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight className="size-5" /> : <ChevronsLeft className="size-5" />}
        </button>
        <a
          href="/dashboard"
          aria-label="Home"
          onClick={(e) => {
            e.preventDefault();
            navigate("/dashboard");
          }}
        >
          <Logo />
        </a>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <span className="hidden gap-1 rounded-md border border-neutral-200 p-1 md:flex dark:border-[#2e2e33]">
          <span
            className="flex items-center gap-1.5 rounded bg-accent-50 px-2 py-1 text-sm font-semibold text-accent-500 dark:bg-accent-500/15"
            title="PDFs"
          >
            <FileText className="size-4" /> 0
          </span>
          <span
            className="flex items-center gap-1.5 rounded bg-accent-50 px-2 py-1 text-sm font-semibold text-accent-500 dark:bg-accent-500/15"
            title="Quizzes"
          >
            <ClipboardList className="size-4" /> 0
          </span>
        </span>
        <a
          href="#"
          className="hidden items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold hover:bg-neutral-100 lg:flex dark:hover:bg-neutral-800"
        >
          <MessageCircle className="size-5" /> Join Community
        </a>
        <button className={iconBtn} aria-label="Search">
          <Search className="size-5" />
        </button>
        <button
          className="hidden items-center gap-1.5 rounded-md px-3 py-2 text-sm hover:bg-neutral-100 sm:flex dark:hover:bg-neutral-800"
          aria-label="Language: English"
        >
          <Globe className="size-4 text-neutral-500" /> English <ChevronDown className="size-4 text-neutral-500" />
        </button>
        <button className={iconBtn} aria-label="Notifications">
          <Bell className="size-5" />
        </button>
        <button className={iconBtn} onClick={onToggleTheme} aria-label="Toggle theme">
          {dark ? <Moon className="size-5" /> : <Sun className="size-5" />}
        </button>
        <button
          className="btn-primary ml-1 grid size-10 place-items-center rounded-md font-semibold"
          aria-label="Account settings"
          onClick={() => navigate("/settings")}
        >
          {user.initial}
        </button>
      </div>
    </header>
  );
}
