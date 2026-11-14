import { useMemo, useRef, useState } from "react";
import { FileText, FolderPlus, Inbox, LayoutGrid, List, Search, UploadCloud } from "lucide-react";
import { PageBody, PageHeader } from "../components/ui";
import { documents as seedDocs, folders as seedFolders, type Doc, type DocStatus, type Folder } from "../data";

type Tab = "all" | DocStatus;
type Sort = "last-studied" | "name" | "created" | "size";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "not-started", label: "Not Started" },
  { key: "in-progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
];

const STATUS_LABEL: Record<DocStatus, string> = {
  "not-started": "Not Started",
  "in-progress": "In Progress",
  completed: "Completed",
};

function Count({ n, active }: { n: number; active?: boolean }) {
  return (
    <span
      className={`grid min-w-5 place-items-center rounded-[2px] px-1 text-xs tabular-nums ${
        active ? "bg-white/25 text-white" : "bg-neutral-100 text-neutral-600 dark:bg-[#2a2a2e] dark:text-neutral-300"
      }`}
    >
      {n}
    </span>
  );
}

export function MyPdfs() {
  const [docs, setDocs] = useState<Doc[]>(seedDocs);
  const [folders, setFolders] = useState<Folder[]>(seedFolders);
  const [folder, setFolder] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("last-studied");
  const [view, setView] = useState<"grid" | "list">("grid");
  const fileInput = useRef<HTMLInputElement>(null);

  const inFolder = useMemo(() => docs.filter((d) => folder === null || d.folderId === folder), [docs, folder]);
  const countFor = (t: Tab) => (t === "all" ? inFolder.length : inFolder.filter((d) => d.status === t).length);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = inFolder.filter((d) => (tab === "all" || d.status === tab) && (!q || d.name.toLowerCase().includes(q)));
    const by: Record<Sort, (a: Doc, b: Doc) => number> = {
      "last-studied": (a, b) => (b.lastStudied ?? "").localeCompare(a.lastStudied ?? ""),
      name: (a, b) => a.name.localeCompare(b.name),
      created: (a, b) => b.uploaded.localeCompare(a.uploaded),
      size: (a, b) => b.sizeKb - a.sizeKb,
    };
    return [...list].sort(by[sort]);
  }, [inFolder, tab, query, sort]);

  function onFiles(files: FileList | null) {
    if (!files) return;
    const added = [...files]
      .filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"))
      .map<Doc>((f) => ({
        id: crypto.randomUUID(),
        name: f.name.replace(/\.pdf$/i, ""),
        pages: 0,
        sizeKb: Math.round(f.size / 1024),
        uploaded: new Date().toISOString(),
        lastStudied: null,
        status: "not-started",
        folderId: folder,
      }));
    setDocs((d) => [...added, ...d]);
  }

  function newFolder() {
    const name = window.prompt("Folder name");
    if (name?.trim()) setFolders((f) => [...f, { id: crypto.randomUUID(), name: name.trim() }]);
  }

  return (
    <PageBody>
      <div className="grid gap-6 lg:grid-cols-[256px_minmax(0,1fr)]">
        {/* Library panel */}
        <aside className="surface h-fit rounded-sm border border-neutral-200 p-4 dark:border-[#2e2e33]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-wide text-neutral-500 uppercase">My Library</h3>
            <button onClick={newFolder} aria-label="New folder" className="grid size-8 place-items-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <FolderPlus className="size-4" />
            </button>
          </div>
          <button
            onClick={() => setFolder(null)}
            className={`mt-3 flex w-full items-center gap-2 rounded-[2px] px-3 py-2.5 text-[15px] ${
              folder === null ? "bg-accent-50 font-medium text-accent-500 dark:bg-accent-500/15" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            <Inbox className="size-4" />
            <span className="flex-1 text-left">All Library</span>
            <Count n={docs.length} />
          </button>
          <div className="mt-2 border-t border-neutral-200 pt-3 dark:border-[#2e2e33]">
            <div className="flex items-center justify-between px-3 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              Folders <Count n={folders.length} />
            </div>
            {folders.length === 0 ? (
              <p className="px-3 pt-3 text-sm text-neutral-400 italic">No folders created</p>
            ) : (
              <ul className="mt-2 space-y-0.5">
                {folders.map((f) => (
                  <li key={f.id}>
                    <button
                      onClick={() => setFolder(f.id)}
                      className={`w-full rounded-[2px] px-3 py-2 text-left text-sm ${
                        folder === f.id ? "bg-accent-50 text-accent-500 dark:bg-accent-500/15" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {f.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Documents */}
        <section className="min-w-0">
          <PageHeader
            title="My PDFs"
            subtitle="Upload and manage your study materials"
            actions={
              <div className="text-right">
                <input ref={fileInput} type="file" accept="application/pdf" multiple hidden onChange={(e) => onFiles(e.target.files)} />
                <button
                  onClick={() => fileInput.current?.click()}
                  className="btn-primary inline-flex h-12 items-center gap-2 rounded-[2px] px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <UploadCloud className="size-5" /> Upload PDF
                </button>
                <p className="mt-1.5 text-xs font-medium text-neutral-500">
                  {docs.length} PDF{docs.length === 1 ? "" : "s"} uploaded
                </p>
              </div>
            }
          />

          <div className="mt-8 flex flex-wrap gap-3">
            <div className="surface flex flex-1 flex-wrap gap-1 rounded-[2px] border border-neutral-200 p-1 dark:border-[#2e2e33]">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 rounded-[2px] px-3 py-1.5 text-sm font-medium ${
                    tab === t.key ? "btn-primary" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  {t.label} <Count n={countFor(t.key)} active={tab === t.key} />
                </button>
              ))}
            </div>
            <label className="surface flex w-full items-center gap-2 rounded-[2px] border border-neutral-200 px-3 sm:w-56 dark:border-[#2e2e33]">
              <Search className="size-4 text-neutral-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search library..."
                className="w-full bg-transparent py-2 text-sm outline-none"
              />
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label="Sort by"
              className="surface rounded-[2px] border border-neutral-200 px-3 text-sm font-medium dark:border-[#2e2e33]"
            >
              <option value="last-studied">Last Studied</option>
              <option value="name">Name</option>
              <option value="created">Date Created</option>
              <option value="size">File Size</option>
            </select>
            <div className="surface flex gap-1 rounded-[2px] border border-neutral-200 p-1 dark:border-[#2e2e33]">
              {(["grid", "list"] as const).map((v) => {
                const Icon = v === "grid" ? LayoutGrid : List;
                return (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    aria-label={`${v} view`}
                    aria-pressed={view === v}
                    className={`grid size-8 place-items-center rounded-[2px] ${view === v ? "btn-primary" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
                  >
                    <Icon className="size-4" />
                  </button>
                );
              })}
            </div>
          </div>

          {shown.length === 0 ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onFiles(e.dataTransfer.files);
              }}
              className="mt-4 grid h-56 place-items-center rounded-sm border border-dashed border-neutral-300 text-lg text-neutral-500 dark:border-[#3a3a40]"
            >
              {docs.length === 0 ? "Your library is empty" : "No PDFs match these filters"}
            </div>
          ) : view === "grid" ? (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((d) => (
                <li key={d.id} className="dot-card p-5">
                  <span className="dots" />
                  <FileText className="size-8 text-accent-500" />
                  <p className="mt-3 truncate font-semibold">{d.name}</p>
                  <p className="mt-1 text-sm text-neutral-500">
                    {STATUS_LABEL[d.status]} · {d.sizeKb} KB
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="surface mt-4 divide-y divide-neutral-200 rounded-sm border border-neutral-200 dark:divide-[#2e2e33] dark:border-[#2e2e33]">
              {shown.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <FileText className="size-5 text-accent-500" />
                  <span className="flex-1 truncate font-medium">{d.name}</span>
                  <span className="text-sm text-neutral-500">{STATUS_LABEL[d.status]}</span>
                  <span className="w-20 text-right text-sm text-neutral-500 tabular-nums">{d.sizeKb} KB</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageBody>
  );
}
