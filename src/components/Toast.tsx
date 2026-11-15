import { useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";
import { motion } from "motion/react";
import { SPRING } from "./motion";

/** Slides down on show and back up on dismiss; render inside <AnimatePresence>. */
export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div role="region" aria-label="Notifications" className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: -24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: SPRING }}
        exit={{ opacity: 0, y: -16, scale: 0.98, transition: { duration: 0.18 } }}
        className="pointer-events-auto relative flex w-full max-w-sm items-center gap-3 rounded-md border border-neutral-200 bg-white px-4 py-3.5 text-sm font-medium shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
      >
        <button
          onClick={onClose}
          aria-label="Close toast"
          className="absolute -top-2 -left-2 grid size-5 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
        >
          <X className="size-3" />
        </button>
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1, transition: { ...SPRING, delay: 0.1 } }}>
          <CheckCircle2 className="size-5 text-emerald-600" />
        </motion.span>
        {message}
      </motion.div>
    </div>
  );
}
