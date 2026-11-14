import { useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div role="region" aria-label="Notifications" className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
      <div className="animate-toast-in pointer-events-auto relative flex w-full max-w-sm items-center gap-3 rounded-md border border-neutral-200 bg-white px-4 py-3.5 text-sm font-medium shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
        <button
          onClick={onClose}
          aria-label="Close toast"
          className="absolute -top-2 -left-2 grid size-5 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
        >
          <X className="size-3" />
        </button>
        <CheckCircle2 className="size-5 text-emerald-600" />
        {message}
      </div>
    </div>
  );
}
