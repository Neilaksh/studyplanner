import { useEffect, useState } from "react";
import { NAV, Sidebar, type NavKey } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { Toast } from "./components/Toast";
import { navigate, usePath } from "./router";
import { Dashboard } from "./pages/Dashboard";
import { MyPdfs } from "./pages/MyPdfs";
import { QuizHistory } from "./pages/QuizHistory";
import { StudyPlanner } from "./pages/StudyPlanner";
import { Settings } from "./pages/Settings";

const PAGES: Record<NavKey, React.ComponentType<{ onNavigate: (k: NavKey) => void }>> = {
  dashboard: Dashboard,
  pdfs: MyPdfs,
  quizzes: QuizHistory,
  planner: StudyPlanner,
  settings: Settings,
};

const go = (k: NavKey) => navigate(NAV.find((n) => n.key === k)!.path);

export default function App() {
  const path = usePath();
  const active = NAV.find((n) => n.path === path)?.key ?? "dashboard";
  const Page = PAGES[active];

  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("theme") === "dark";
    } catch {
      return false;
    }
  });
  const [toast, setToast] = useState<string | null>("Welcome back!");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      /* storage unavailable */
    }
  }, [dark]);

  useEffect(() => {
    document.getElementById("main-content")?.scrollTo({ top: 0 });
  }, [active]);

  return (
    <div className="flex h-full flex-col">
      <Topbar
        collapsed={collapsed}
        onToggleSidebar={() => setCollapsed((c) => !c)}
        dark={dark}
        onToggleTheme={() => setDark((d) => !d)}
      />
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      <div className="flex min-h-0 flex-1">
        <Sidebar collapsed={collapsed} active={active} onSelect={go} />
        <main
          id="main-content"
          className="thin-scroll min-w-0 flex-1 overflow-y-auto bg-[#faf9f8] dark:bg-[#232327]"
        >
          <Page onNavigate={go} />
        </main>
      </div>
    </div>
  );
}
