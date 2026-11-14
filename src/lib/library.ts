// Documents and folders: the single owner of how library rows and PDF files are read and written.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type { Database } from "./database.types";
import { extractPdfText } from "./pdfText";

export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
export type FolderRow = Database["public"]["Tables"]["folders"]["Row"];
export type DocStatus = Database["public"]["Enums"]["doc_status"];

export const MAX_PDF_BYTES = 50 * 1024 * 1024; // matches the pdfs bucket limit
const BUCKET = "pdfs";
const PAGE_BATCH = 50;

export const libraryKeys = {
  documents: ["documents"] as const,
  folders: ["folders"] as const,
};

/** Every query and mutation result goes through this so Supabase errors surface as thrown Errors. */
function unwrap<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export function useDocuments() {
  return useQuery({
    queryKey: libraryKeys.documents,
    queryFn: async () =>
      unwrap(await supabase.from("documents").select("*").order("created_at", { ascending: false })) ?? [],
  });
}

export function useFolders() {
  return useQuery({
    queryKey: libraryKeys.folders,
    queryFn: async () => unwrap(await supabase.from("folders").select("*").order("name")) ?? [],
  });
}

export type UploadStage = "reading" | "uploading" | "saving" | "done" | "failed";
export type UploadProgress = { stage: UploadStage; detail?: string };

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("You are signed out. Sign in again to upload.");
  return data.user.id;
}

/**
 * Upload one PDF: read its text first (no side effects if the file is unreadable), then store the file,
 * then the row and page text. If any later step fails, the file and row created so far are removed.
 */
export async function uploadPdf(file: File, folderId: string | null, onProgress: (p: UploadProgress) => void) {
  if (file.size > MAX_PDF_BYTES) throw new Error("File is larger than 50 MB.");
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) throw new Error("Only PDF files can be uploaded.");

  onProgress({ stage: "reading" });
  const { pageCount, pages } = await extractPdfText(file, (done, total) =>
    onProgress({ stage: "reading", detail: `page ${done} of ${total}` }),
  );

  const userId = await currentUserId();
  const id = crypto.randomUUID();
  const storagePath = `${userId}/${id}.pdf`;
  const title = file.name.replace(/\.pdf$/i, "").trim().slice(0, 300) || "Untitled";

  onProgress({ stage: "uploading" });
  unwrap(await supabase.storage.from(BUCKET).upload(storagePath, file, { contentType: "application/pdf" }));

  try {
    onProgress({ stage: "saving" });
    unwrap(
      await supabase.from("documents").insert({
        id,
        title,
        storage_path: storagePath,
        size_bytes: file.size,
        page_count: pageCount,
        folder_id: folderId,
      }),
    );
    for (let i = 0; i < pages.length; i += PAGE_BATCH) {
      const batch = pages.slice(i, i + PAGE_BATCH).map((content, j) => ({
        document_id: id,
        page_number: i + j + 1,
        content,
      }));
      unwrap(await supabase.from("document_pages").insert(batch));
    }
    unwrap(await supabase.from("activity_events").insert({ kind: "upload", document_id: id }));
  } catch (err) {
    // Roll back: the row delete cascades to its pages.
    await supabase.from("documents").delete().eq("id", id);
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw err;
  }
  onProgress({ stage: "done" });
  return { id, title, pageCount, emptyText: pages.every((p) => p.length === 0) };
}

export function useLibraryMutations() {
  const qc = useQueryClient();
  const refreshDocs = () => qc.invalidateQueries({ queryKey: libraryKeys.documents });
  const refreshAll = () => qc.invalidateQueries();

  const deleteDocument = useMutation({
    mutationFn: async (doc: DocumentRow) => {
      unwrap(await supabase.from("documents").delete().eq("id", doc.id));
      const res = await supabase.storage.from(BUCKET).remove([doc.storage_path]);
      if (res.error) console.warn("PDF row deleted but its file could not be removed", res.error);
    },
    onSettled: refreshAll,
  });

  const updateDocument = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; status?: DocStatus; folder_id?: string | null; title?: string }) =>
      unwrap(await supabase.from("documents").update(patch).eq("id", id)),
    onSettled: refreshDocs,
  });

  /** Opens the PDF in a new tab via a short-lived signed URL and records the study session start. */
  const openDocument = useMutation({
    mutationFn: async (doc: DocumentRow) => {
      // Open the tab synchronously so pop-up blockers allow it, then point it at the signed URL.
      const tab = window.open("about:blank", "_blank");
      const signed = await supabase.storage.from(BUCKET).createSignedUrl(doc.storage_path, 60 * 60);
      if (signed.error || !signed.data) {
        tab?.close();
        throw new Error(signed.error?.message ?? "Could not open the PDF.");
      }
      if (tab) tab.location.href = signed.data.signedUrl;
      else window.location.href = signed.data.signedUrl;
      unwrap(
        await supabase
          .from("documents")
          .update({
            last_studied_at: new Date().toISOString(),
            ...(doc.status === "not_started" ? { status: "in_progress" as const } : {}),
          })
          .eq("id", doc.id),
      );
      unwrap(await supabase.from("activity_events").insert({ kind: "study", document_id: doc.id }));
    },
    onSettled: refreshAll,
  });

  const createFolder = useMutation({
    mutationFn: async (name: string) => unwrap(await supabase.from("folders").insert({ name }).select().single()),
    onSettled: () => qc.invalidateQueries({ queryKey: libraryKeys.folders }),
  });

  const deleteFolder = useMutation({
    // Documents in the folder are kept; folder_id is set to null by the foreign key.
    mutationFn: async (id: string) => unwrap(await supabase.from("folders").delete().eq("id", id)),
    onSettled: refreshAll,
  });

  return { deleteDocument, updateDocument, openDocument, createFolder, deleteFolder, refreshAll };
}
