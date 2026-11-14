import { BookOpen } from "lucide-react";
import { BRAND } from "../data";

// Placeholder brand mark. Swap for your own logo asset.
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
      <BookOpen className="size-7" strokeWidth={2.25} />
      {!compact && <span className="text-2xl font-semibold tracking-tight">{BRAND.name}</span>}
    </span>
  );
}
