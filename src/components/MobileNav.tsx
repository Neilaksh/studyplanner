// Slide-in navigation drawer for small screens (the sidebar is hidden below the md breakpoint).
import { useEffect } from "react";
import { X } from "lucide-react";
import { motion } from "motion/react";
import { Logo } from "./Logo";
import { Backdrop, Panel, SPRING } from "./motion";
import { NAV, type NavKey } from "./Sidebar";

export function MobileNav({ active, onSelect, onClose }: { active: NavKey; onSelect: (k: NavKey) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <Backdrop onClick={onClose} className="md:hidden">
      <Panel
        from="left"
        role="dialog"
        aria-label="Navigation"
        className="surface flex h-full w-[min(300px,85vw)] flex-col border-r border-neutral-200 shadow-2xl dark:border-[#2e2e33]"
      >
        <div className="flex h-16 items-center justify-between border-b border-neutral-200 px-4 dark:border-[#2e2e33]">
          <Logo />
          <button onClick={onClose} aria-label="Close menu" className="grid size-10 place-items-center rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <X className="size-5" />
          </button>
        </div>
        <nav className="space-y-1.5 p-3">
          {NAV.map(({ key, label, icon: Icon }, i) => {
            const isActive = key === active;
            return (
              <motion.button
                key={key}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0, transition: { delay: 0.05 + i * 0.04 } }}
                onClick={() => {
                  onSelect(key);
                  onClose();
                }}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex w-full items-center gap-3 rounded-[2px] px-3.5 py-3 text-base font-semibold ${
                  isActive ? "text-white" : "text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                }`}
              >
                {isActive && <motion.span layoutId="mobile-active" transition={SPRING} className="absolute inset-0 rounded-[2px] bg-neutral-950 dark:bg-accent-500" aria-hidden />}
                <Icon className="relative size-5" />
                <span className="relative">{label}</span>
              </motion.button>
            );
          })}
        </nav>
      </Panel>
    </Backdrop>
  );
}
