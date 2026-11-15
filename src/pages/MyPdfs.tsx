import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileText,
  FolderPlus,
  Inbox,
  LayoutGrid,
  List,
  Loader2,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { PageBody, PageHeader } from "../components/ui";
import { AnimatePresence, motion } from "motion/react";
import { StudyPanel } from "../components/StudyPanel";
import {
  uploadPdf,
  useDocuments,
  useFolders,
  useLibraryMutations,
  type DocStatus,
  type DocumentRow,
  type UploadProgress,
} from "../lib/library";

type Tab = "all" | DocStatus;
type Sort = "last-studied" | "name" | "created" | "size";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "not_started", label: "Not Started" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
];
const STATUS_LABEL: Record<DocStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};
const STAGE_LABEL: Record<UploadProgress["stage"], string> = {
  reading: "Reading text",
  uploading: "Uploading",
  saving: "Saving",
  done: "Uploaded",
  failed: "Failed",
};

type UploadItem = { key: string; name: string; progress: UploadProgress; error?: string; note?: string };

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

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

function DocActions({ doc }: { doc: DocumentRow }) {
  const { openDocument, updateDocument, deleteDocument } = useLibraryMutations();
  const { data: folders = [] } = useFolders();
  const [studying, setStudying] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <AnimatePresence>{studying && <StudyPanel key="panel" doc={doc} onClose={() => setStudying(false)} />}</AnimatePresence>
      <button
        onClick={() => setStudying(true)}
        className="btn-secondary flex items-center gap-1.5 rounded-[2px] px-3 py-1.5 text-sm font-medium"
      >
        <Sparkles className="size-3.5 text-accent-500" /> Study
      </button>
      <button
        onClick={() => openDocument.mutate(doc)}
        className="btn-primary flex items-center gap-1.5 rounded-[2px] px-3 py-1.5 text-sm font-medium"
      >
        <ExternalLink className="size-3.5" /> Open
      </button>
      <select
        aria-label={`Status of ${doc.title}`}
        value={doc.status}
        onChange={(e) => updateDocument.mutate({ id: doc.id, status: e.target.value as DocStatus })}
        className="surface rounded-[2px] border border-neutral-200 px-2 py-1.5 text-sm dark:border-[#2e2e33]"
      >
        {Object.entries(STATUS_LABEL).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      {folders.length > 0 && (
        <select
          aria-label={`Folder of ${doc.title}`}
          value={doc.folder_id ?? ""}
          onChange={(e) => updateDocument.mutate({ id: doc.id, folder_id: e.target.value || null })}
          className="surface max-w-36 rounded-[2px] border border-neutral-200 px-2 py-1.5 text-sm dark:border-[#2e2e33]"
        >
          <option value="">No folder</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      )}
      <button
        onClick={() => {
          if (window.confirm(`Delete "${doc.title}"? Its quizzes, summaries and notes are deleted too. This cannot be undone.`))
            deleteDocument.mutate(doc);
        }}
        disabled={deleteDocument.isPending}
        aria-label={`Delete ${doc.title}`}
        className="grid size-8 place-items-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-red-500 dark:hover:bg-neutral-800"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

export function MyPdfs() {
  const docsQuery = useDocuments();
  const foldersQuery = useFolders();
  const { createFolder, deleteFolder, refreshAll, openDocument, updateDocument, deleteDocument } = useLibraryMutations();
  const docs = useMemo(() => docsQuery.data ?? [], [docsQuery.data]);
  const folders = foldersQuery.data ?? [];

  const [folder, setFolder] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("last-studied");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const mutationError = [openDocument, updateDocument, deleteDocument, createFolder, deleteFolder].find((m) => m.error)?.error;

  const inFolder = useMemo(() => docs.filter((d) => folder === null || d.folder_id === folder), [docs, folder]);
  const countFor = (t: Tab) => (t === "all" ? inFolder.length : inFolder.filter((d) => d.status === t).length);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = inFolder.filter((d) => (tab === "all" || d.status === tab) && (!q || d.title.toLowerCase().includes(q)));
    const by: Record<Sort, (a: DocumentRow, b: DocumentRow) => number> = {
      "last-studied": (a, b) =>
        (b.last_studied_at ?? "").localeCompare(a.last_studied_at ?? "") || b.created_at.localeCompare(a.created_at),
      name: (a, b) => a.title.localeCompare(b.title),
      created: (a, b) => b.created_at.localeCompare(a.created_at),
      size: (a, b) => b.size_bytes - a.size_bytes,
    };
    return [...list].sort(by[sort]);
  }, [inFolder, tab, query, sort]);

  const patchUpload = (key: string, patch: Partial<UploadItem>) =>
    setUploads((u) => u.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const items = [...files].map((f) => ({ file: f, key: crypto.randomUUID() }));
    setUploads((u) => [...items.map(({ file, key }) => ({ key, name: file.name, progress: { stage: "reading" as const } })), ...u]);
    // One at a time keeps memory bounded for large PDFs.
    for (const { file, key } of items) {
      try {
        const res = await uploadPdf(file, folder, (progress) => patchUpload(key, { progress }));
        patchUpload(key, {
          progress: { stage: "done" },
          note: res.emptyText ? "No text found — this may be a scanned PDF, so AI features won't work on it." : undefined,
        });
      } catch (err) {
        patchUpload(key, { progress: { stage: "failed" }, error: err instanceof Error ? err.message : String(err) });
      }
      await refreshAll();
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  function newFolder() {
    const name = window.prompt("Folder name")?.trim();
    if (name) createFolder.mutate(name.slice(0, 100));
  }

  const busyUploading = uploads.some((u) => !["done", "failed"].includes(u.progress.stage));

  return (
    <PageBody>
      <div className="grid gap-6 lg:grid-cols-[256px_minmax(0,1fr)]">
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
                  <li key={f.id} className="group flex items-center">
                    <button
                      onClick={() => setFolder(f.id)}
                      className={`flex flex-1 items-center gap-2 truncate rounded-[2px] px-3 py-2 text-left text-sm ${
                        folder === f.id ? "bg-accent-50 text-accent-500 dark:bg-accent-500/15" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      }`}
                    >
                      <span className="flex-1 truncate">{f.name}</span>
                      <Count n={docs.filter((d) => d.folder_id === f.id).length} />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete folder "${f.name}"? Its PDFs stay in your library.`)) {
                          if (folder === f.id) setFolder(null);
                          deleteFolder.mutate(f.id);
                        }
                      }}
                      aria-label={`Delete folder ${f.name}`}
                      className="grid size-7 place-items-center rounded text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-red-500 focus:opacity-100"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className="min-w-0">
          <PageHeader
            title="My PDFs"
            subtitle="Upload and manage your study materials"
            actions={
              <div className="text-right">
                <input ref={fileInput} type="file" accept="application/pdf" multiple hidden onChange={(e) => void onFiles(e.target.files)} />
                <button
                  disabled={busyUploading}
                  onClick={() => fileInput.current?.click()}
                  className="btn-primary inline-flex h-12 items-center gap-2 rounded-[2px] px-4 text-sm font-medium disabled:opacity-60"
                >
                  {busyUploading ? <Loader2 className="size-5 animate-spin" /> : <UploadCloud className="size-5" />} Upload PDF
                </button>
                <p className="mt-1.5 text-xs font-medium text-neutral-500">
                  {docs.length} PDF{docs.length === 1 ? "" : "s"} uploaded
                </p>
              </div>
            }
          />

          {uploads.length > 0 && (
            <ul className="surface mt-6 divide-y divide-neutral-200 rounded-sm border border-neutral-200 dark:divide-[#2e2e33] dark:border-[#2e2e33]">
              {uploads.map((u) => (
                <motion.li key={u.key} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 px-4 py-3 text-sm">
                  {u.progress.stage === "done" ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
                  ) : u.progress.stage === "failed" ? (
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-500" />
                  ) : (
                    <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-neutral-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{u.name}</p>
                    {(u.error || u.note) && <p className={u.error ? "text-red-500" : "text-amber-600"}>{u.error ?? u.note}</p>}
                  </div>
                  <span className="shrink-0 text-neutral-500">
                    {STAGE_LABEL[u.progress.stage]}
                    {u.progress.detail ? ` · ${u.progress.detail}` : ""}
                  </span>
                </motion.li>
              ))}
              {!busyUploading && (
                <li className="px-4 py-2 text-right">
                  <button onClick={() => setUploads([])} className="text-xs font-medium text-neutral-500 hover:underline">
                    Clear
                  </button>
                </li>
              )}
            </ul>
          )}

          {mutationError && (
            <p role="alert" className="mt-4 text-sm text-red-500">
              {mutationError.message}
            </p>
          )}

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
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search library..." className="w-full bg-transparent py-2 text-sm outline-none" />
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

          {docsQuery.isPending ? (
            <div className="mt-4 grid h-56 place-items-center text-neutral-400">
              <Loader2 className="size-6 animate-spin" aria-label="Loading library" />
            </div>
          ) : docsQuery.isError ? (
            <div role="alert" className="mt-4 grid h-56 place-items-center rounded-sm border border-dashed border-red-300 text-center text-red-500">
              <div>
                <p>Could not load your library: {docsQuery.error.message}</p>
                <button onClick={() => void docsQuery.refetch()} className="mt-3 text-sm font-medium underline">
                  Try again
                </button>
              </div>
            </div>
          ) : shown.length === 0 ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void onFiles(e.dataTransfer.files);
              }}
              className="mt-4 grid h-56 place-items-center rounded-sm border border-dashed border-neutral-300 text-center text-lg text-neutral-500 dark:border-[#3a3a40]"
            >
              {docs.length === 0 ? (
                <div>
                  Your library is empty
                  <p className="mt-1 text-sm">Drop PDFs here or use Upload PDF</p>
                </div>
              ) : (
                "No PDFs match these filters"
              )}
            </div>
          ) : view === "grid" ? (
            <motion.ul layout className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence initial={false}>
              {shown.map((d, i) => (
                <motion.li
                  key={d.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: Math.min(i, 8) * 0.04 } }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
                  className="dot-card lift flex flex-col p-5"
                >
                  <span className="dots" />
                  <FileText className="size-8 text-accent-500" />
                  <p className="mt-3 truncate font-semibold" title={d.title}>
                    {d.title}
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">
                    {d.page_count ?? "?"} pages · {formatSize(d.size_bytes)}
                  </p>
                  <div className="mt-4">
                    <DocActions doc={d} />
                  </div>
                </motion.li>
              ))}
              </AnimatePresence>
            </motion.ul>
          ) : (
            <ul className="surface mt-4 divide-y divide-neutral-200 rounded-sm border border-neutral-200 dark:divide-[#2e2e33] dark:border-[#2e2e33]">
              <AnimatePresence initial={false}>
              {shown.map((d) => (
                <motion.li
                  key={d.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <FileText className="size-5 text-accent-500" />
                  <span className="min-w-0 flex-1 truncate font-medium" title={d.title}>
                    {d.title}
                  </span>
                  <span className="text-sm text-neutral-500 tabular-nums">
                    {d.page_count ?? "?"} pages · {formatSize(d.size_bytes)}
                  </span>
                  <DocActions doc={d} />
                </motion.li>
              ))}
              </AnimatePresence>
            </ul>
          )}
        </section>
      </div>
    </PageBody>
  );
}
