// Shared motion primitives so every screen moves the same way.
// Respect for "reduce motion" comes from <MotionConfig reducedMotion="user"> in main.tsx.
import { useEffect, useRef } from "react";
import { animate, motion, useInView, type HTMLMotionProps, type Transition, type Variants } from "motion/react";

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const SPRING: Transition = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 };
export const SOFT_SPRING: Transition = { type: "spring", stiffness: 260, damping: 30 };

/** Fades and lifts content in as a page mounts, and out as it leaves. */
export function PageTransition({ children, ...rest }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE_OUT } }}
      exit={{ opacity: 0, y: -6, transition: { duration: 0.16, ease: "easeIn" } }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

const staggerParent: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } } };
const staggerChild: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT } },
};

/** Children wrapped in <StaggerItem> enter one after another. */
export function Stagger({ children, as = "div", ...rest }: HTMLMotionProps<"div"> & { as?: "div" | "ul" }) {
  const Tag = as === "ul" ? motion.ul : motion.div;
  return (
    <Tag variants={staggerParent} initial="hidden" animate="show" {...(rest as object)}>
      {children}
    </Tag>
  );
}

export function StaggerItem({ children, as = "div", ...rest }: HTMLMotionProps<"div"> & { as?: "div" | "li" }) {
  const Tag = as === "li" ? motion.li : motion.div;
  return (
    <Tag variants={staggerChild} {...(rest as object)}>
      {children}
    </Tag>
  );
}

/** Dimmed overlay for dialogs; render inside <AnimatePresence> so it fades out too. */
export function Backdrop({ children, onClick, className = "" }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <motion.div
      className={`fixed inset-0 z-40 bg-black/50 ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.2 } }}
      exit={{ opacity: 0, transition: { duration: 0.18, delay: 0.04 } }}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}

/** Dialog surface: "center" scales up from slightly below, "right" slides in from the edge. */
export function Panel({ from = "center", children, ...rest }: HTMLMotionProps<"div"> & { from?: "center" | "right" | "left" }) {
  const edge = from === "left" ? "-100%" : "100%";
  const motionProps =
    from !== "center"
      ? { initial: { x: edge }, animate: { x: 0, transition: SOFT_SPRING }, exit: { x: edge, transition: { duration: 0.22, ease: "easeIn" as const } } }
      : {
          initial: { opacity: 0, y: 16, scale: 0.97 },
          animate: { opacity: 1, y: 0, scale: 1, transition: SPRING },
          exit: { opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.15, ease: "easeIn" as const } },
        };
  return (
    <motion.div {...motionProps} onClick={(e) => e.stopPropagation()} {...rest}>
      {children}
    </motion.div>
  );
}

/** Small menus and popovers. */
export function Pop({ children, origin = "top right", ...rest }: HTMLMotionProps<"div"> & { origin?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.16, ease: EASE_OUT } }}
      exit={{ opacity: 0, scale: 0.96, y: -2, transition: { duration: 0.12 } }}
      style={{ transformOrigin: origin }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Height-animating container for show/hide content. Render inside <AnimatePresence initial={false}>. */
export function Collapse({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1, transition: { height: { duration: 0.28, ease: EASE_OUT }, opacity: { duration: 0.2, delay: 0.05 } } }}
      exit={{ height: 0, opacity: 0, transition: { height: { duration: 0.22, ease: "easeInOut" }, opacity: { duration: 0.12 } } }}
      className={`overflow-hidden ${className}`}
    >
      {children}
    </motion.div>
  );
}

/** Counts up to `value` when first visible and eases between later values. Non-numeric text is shown as is. */
export function AnimatedNumber({ value, format = (n) => String(Math.round(n)) }: { value: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView || !ref.current) return;
    const controls = animate(shown.current, value, {
      duration: 0.8,
      ease: EASE_OUT,
      onUpdate: (v) => {
        shown.current = v;
        if (ref.current) ref.current.textContent = format(v);
      },
    });
    return () => controls.stop();
  }, [value, inView, format]);
  return <span ref={ref}>{format(0)}</span>;
}

/** A progress bar whose fill eases to its value. */
export function ProgressBar({ value, className = "h-1.5", fill = "bg-accent-500" }: { value: number; className?: string; fill?: string }) {
  return (
    <div className={`overflow-hidden rounded-full bg-neutral-200 dark:bg-[#2e2e33] ${className}`}>
      <motion.div
        className={`h-full rounded-full ${fill}`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
      />
    </div>
  );
}
