import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { PageTransition } from "./components/motion";
import { NAV, Sidebar, type NavKey } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { Toast } from "./components/Toast";
import { useAuth } from "./lib/auth";
import { navigate, usePath } from "./router";
import { MobileNav } from "./components/MobileNav";
import { Login } from "./pages/auth/Login";
import { ForgotPassword, ResetPassword } from "./pages/auth/PasswordReset";

// Each page is its own chunk, downloaded the first time it is opened.
const Dashboard = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const MyPdfs = lazy(() => import("./pages/MyPdfs").then((m) => ({ default: m.MyPdfs })));
const QuizHistory = lazy(() => import("./pages/QuizHistory").then((m) => ({ default: m.QuizHistory })));
const StudyPlanner = lazy(() => import("./pages/StudyPlanner").then((m) => ({ default: m.StudyPlanner })));
const Settings = lazy(() => import("./pages/Settings").then((m) => ({ default: m.Settings })));
const QuizPlayer = lazy(() => import("./pages/QuizPlayer").then((m) => ({ default: m.QuizPlayer })));
const SearchPalette = lazy(() => import("./components/SearchPalette").then((m) => ({ default: m.SearchPalette })));

const PAGES: Record<NavKey, React.ComponentType<{ onNavigate: (k: NavKey) => void }>> = {
  dashboard: Dashboard,
  pdfs: MyPdfs,
  quizzes: QuizHistory,
  planner: StudyPlanner,
  settings: Settings,
};

const pageFallback = (
  <div className="grid h-64 place-items-center text-neutral-400">
    <Loader2 className="size-6 animate-spin" aria-label="Loading page" />
  </div>
);

const SIGNED_OUT_ONLY = ["/login", "/forgot-password"];
const go = (k: NavKey) => navigate(NAV.find((n) => n.key === k)!.path);

function useTheme() {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("theme") === "dark";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    // Fade colours only while switching, so normal hovers and page loads are unaffected.
    const root = document.documentElement;
    if (root.classList.contains("dark") !== dark) {
      root.classList.add("theme-switching");
      window.setTimeout(() => root.classList.remove("theme-switching"), 320);
    }
    root.classList.toggle("dark", dark);
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      /* storage unavailable */
    }
  }, [dark]);
  return [dark, () => setDark((d) => !d)] as const;
}

function takeWelcomeFlag() {
  try {
    const v = sessionStorage.getItem("welcome");
    sessionStorage.removeItem("welcome");
    return v === "1";
  } catch {
    return false;
  }
}

export default function App() {
  const path = usePath();
  const { session, recovering } = useAuth();
  const [dark, toggleTheme] = useTheme();

  const signedIn = !!session;
  const isResetPage = path === "/reset-password";
  const isSignedOutPage = SIGNED_OUT_ONLY.includes(path);

  // Route guard: decide only once the stored session has been read.
  useEffect(() => {
    if (session === undefined) return;
    if (recovering && !isResetPage) navigate("/reset-password", { replace: true });
    else if (!signedIn && !isSignedOutPage && !isResetPage) navigate("/login", { replace: true });
    else if (signedIn && !recovering && (isSignedOutPage || path === "/")) navigate("/dashboard", { replace: true });
  }, [session, signedIn, recovering, path, isResetPage, isSignedOutPage]);

  if (session === undefined) {
    return (
      <div className="grid h-full place-items-center bg-[#faf9f8] dark:bg-[#232327]" aria-busy="true">
        <Loader2 className="size-6 animate-spin text-neutral-400" aria-label="Loading" />
      </div>
    );
  }

  if (isResetPage || !signedIn) {
    const page = isResetPage ? <ResetPassword /> : path === "/forgot-password" ? <ForgotPassword /> : <Login />;
    return (
      <AnimatePresence mode="wait" initial={false}>
        <PageTransition key={path} className="h-full">
          {page}
        </PageTransition>
      </AnimatePresence>
    );
  }

  return <Shell path={path} dark={dark} onToggleTheme={toggleTheme} />;
}

function Shell({ path, dark, onToggleTheme }: { path: string; dark: boolean; onToggleTheme: () => void }) {
  // "/quiz/<id>" plays a quiz; it belongs to the Quiz History section.
  const quizId = /^\/quiz\/([0-9a-f-]{36})$/i.exec(path)?.[1] ?? null;
  const active = quizId ? "quizzes" : (NAV.find((n) => n.path === path)?.key ?? "dashboard");
  const Page = PAGES[active];
  const [collapsed, setCollapsed] = useState(false);
  const [toast, setToast] = useState<string | null>(() => (takeWelcomeFlag() ? "Welcome back!" : null));
  const closeToast = useCallback(() => setToast(null), []);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const [searchOpen, setSearchOpen] = useState(false);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  useEffect(() => {
    document.getElementById("main-content")?.scrollTo({ top: 0 });
  }, [active]);

  // Ctrl/⌘ + K opens search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <Topbar
        collapsed={collapsed}
        onToggleSidebar={() => setCollapsed((c) => !c)}
        onOpenMenu={() => setMenuOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
        dark={dark}
        onToggleTheme={onToggleTheme}
      />
      <AnimatePresence>{toast && <Toast key="toast" message={toast} onClose={closeToast} />}</AnimatePresence>
      <AnimatePresence>{menuOpen && <MobileNav key="menu" active={active} onSelect={go} onClose={closeMenu} />}</AnimatePresence>
      <Suspense fallback={null}>
        <AnimatePresence>{searchOpen && <SearchPalette key="search" onClose={closeSearch} />}</AnimatePresence>
      </Suspense>
      <div className="flex min-h-0 flex-1">
        <Sidebar collapsed={collapsed} active={active} onSelect={go} />
        <main id="main-content" className="thin-scroll min-w-0 flex-1 overflow-y-auto bg-[#faf9f8] dark:bg-[#232327]">
          {/* Pages cross-fade: the old one leaves before the new one enters. */}
          <AnimatePresence mode="wait" initial={false}>
            <PageTransition key={path}>
              <Suspense fallback={pageFallback}>{quizId ? <QuizPlayer quizId={quizId} /> : <Page onNavigate={go} />}</Suspense>
            </PageTransition>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
