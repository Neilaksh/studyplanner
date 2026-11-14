import type { LucideIcon } from "lucide-react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-neutral-500 dark:text-neutral-400">{subtitle}</p>
      </div>
      {actions}
    </div>
  );
}

export function PageBody({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[1440px] p-5 sm:p-8">{children}</div>;
}

export function IconTile({ icon: Icon, className = "" }: { icon: LucideIcon; className?: string }) {
  return (
    <span className={`grid size-16 place-items-center rounded-sm bg-neutral-100 dark:bg-[#2a2a2e] ${className}`}>
      <Icon className="size-7" />
    </span>
  );
}
