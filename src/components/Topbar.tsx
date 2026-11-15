import { ChevronsLeft, ChevronsRight, ClipboardList, FileText, Menu, Moon, Search, Sun } from "lucide-react";
import { Logo } from "./Logo";
import { useEffect, useRef, useState } from "react";
import { LogOut, Settings as SettingsIcon } from "lucide-react";
import { displayName, useAuth } from "../lib/auth";
import { navigate } from "../router";
import { AnimatePresence, motion } from "motion/react";
import { Notifications } from "./Notifications";
import { useDashboardStats } from "../lib/dashboard";
import { Pop } from "./motion";

function AccountMenu() {
  const { user, profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const name = displayName(profile, user);

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

  const item = "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800";
  return (
    <div ref={ref} className="relative ml-1">
      <button
        className="btn-primary grid size-10 place-items-center rounded-md font-semibold"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {name.charAt(0).toUpperCase() || "?"}
      </button>
      <AnimatePresence>{open && (
        <Pop key="menu" role="menu" className="surface absolute right-0 z-30 mt-2 w-60 rounded-sm border border-neutral-200 py-1 shadow-lg dark:border-[#2e2e33]">
          <div className="border-b border-neutral-200 px-4 py-3 dark:border-[#2e2e33]">
            <p className="truncate font-semibold">{name}</p>
            <p className="truncate text-sm text-neutral-500">{user?.email}</p>
          </div>
          <button role="menuitem" className={item} onClick={() => { setOpen(false); navigate("/settings"); }}>
            <SettingsIcon className="size-4" /> Settings
          </button>
          <button role="menuitem" className={`${item} text-red-600`} onClick={() => void signOut()}>
            <LogOut className="size-4" /> Sign out
          </button>
        </Pop>
      )}</AnimatePresence>
    </div>
  );
}

type Props = {
  collapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMenu: () => void;
  onOpenSearch: () => void;
  dark: boolean;
  onToggleTheme: () => void;
};

const iconBtn =
  "relative grid size-10 place-items-center rounded-md text-neutral-800 transition-colors hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800";

export function Topbar({ collapsed, onToggleSidebar, onOpenMenu, onOpenSearch, dark, onToggleTheme }: Props) {
  const stats = useDashboardStats();
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-3 sm:px-6 dark:border-[#2e2e33] dark:bg-[#1c1c1f]">
      <div className="flex items-center gap-2 sm:gap-4">
        <button className={`${iconBtn} md:hidden`} onClick={onOpenMenu} aria-label="Open menu">
          <Menu className="size-5" />
        </button>
        <button className={`${iconBtn} hidden md:grid`} onClick={onToggleSidebar} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
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
          <button
            onClick={() => navigate("/pdfs")}
            className="flex items-center gap-1.5 rounded bg-accent-50 px-2 py-1 text-sm font-semibold text-accent-500 transition-colors hover:bg-accent-500/20 dark:bg-accent-500/15"
            title="PDFs"
          >
            <FileText className="size-4" /> {stats.data?.documents ?? "…"}
          </button>
          <button
            onClick={() => navigate("/quiz-history")}
            className="flex items-center gap-1.5 rounded bg-accent-50 px-2 py-1 text-sm font-semibold text-accent-500 transition-colors hover:bg-accent-500/20 dark:bg-accent-500/15"
            title="Quizzes"
          >
            <ClipboardList className="size-4" /> {stats.data?.quizzes ?? "…"}
          </button>
        </span>
        <button
          onClick={onOpenSearch}
          aria-label="Search"
          className="hidden items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-500 transition-colors hover:bg-neutral-50 lg:flex dark:border-[#2e2e33] dark:hover:bg-neutral-800"
        >
          <Search className="size-4" /> Search
          <kbd className="ml-4 rounded border border-neutral-200 px-1.5 text-xs dark:border-[#2e2e33]">{isMac ? "⌘" : "Ctrl"} K</kbd>
        </button>
        <button className={`${iconBtn} lg:hidden`} onClick={onOpenSearch} aria-label="Search">
          <Search className="size-5" />
        </button>
        <Notifications buttonClass={iconBtn} />
        <button className={iconBtn} onClick={onToggleTheme} aria-label="Toggle theme">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={dark ? "moon" : "sun"} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
              {dark ? <Moon className="size-5" /> : <Sun className="size-5" />}
            </motion.span>
          </AnimatePresence>
        </button>
        <AccountMenu />
      </div>
    </header>
  );
}
