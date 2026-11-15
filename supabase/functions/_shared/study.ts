// Loading study material for prompts: documents, chapters, page text and the output language.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.50.0";
import { HttpError, must } from "./http.ts";

export type Doc = { id: string; title: string; page_count: number | null };
export type Chapter = { id: string; title: string; start_page: number; end_page: number; position: number };

export async function loadDocument(db: SupabaseClient, documentId: string): Promise<Doc> {
  const doc = must(
    await db.from("documents").select("id, title, page_count").eq("id", documentId).maybeSingle(),
    "load the document",
  );
  if (!doc) throw new HttpError(404, "Document not found.");
  return doc as Doc;
}

export async function loadChapter(db: SupabaseClient, documentId: string, chapterId: string): Promise<Chapter> {
  const ch = must(
    await db
      .from("document_chapters")
      .select("id, title, start_page, end_page, position")
      .eq("id", chapterId)
      .eq("document_id", documentId)
      .maybeSingle(),
    "load the chapter",
  );
  if (!ch) throw new HttpError(404, "Chapter not found in this document.");
  return ch as Chapter;
}

/**
 * Text of pages [from, to] as "[Page n]\n..." blocks, capped at maxChars.
 * Returns how many pages fit so callers can say when material was cut short.
 */
export async function loadPageText(db: SupabaseClient, documentId: string, from: number, to: number, maxChars: number) {
  const rows = must(
    await db
      .from("document_pages")
      .select("page_number, content")
      .eq("document_id", documentId)
      .gte("page_number", from)
      .lte("page_number", to)
      .order("page_number"),
    "load page text",
  ) as { page_number: number; content: string }[];

  let text = "";
  let lastPage = from - 1;
  for (const r of rows) {
    const block = `[Page ${r.page_number}]\n${r.content}\n\n`;
    if (text.length + block.length > maxChars) {
      if (text.length === 0) text = block.slice(0, maxChars); // one huge page: keep its start
      break;
    }
    text += block;
    lastPage = r.page_number;
  }
  if (!text.replace(/\[Page \d+\]/g, "").trim()) {
    throw new HttpError(422, "This PDF has no readable text (it may be a scanned image), so AI features can't use it.");
  }
  return { text: text.trim(), lastPage, truncated: lastPage < to };
}

/** Cuts "[Page n]" source text to at most maxChars at a page boundary; returns the last whole page kept. */
export function cutAtPage(text: string, maxChars: number): { text: string; lastPage: number | null } {
  if (text.length <= maxChars) return { text, lastPage: null };
  const boundary = text.lastIndexOf("\n\n[Page ", maxChars);
  const cut = boundary > 0 ? text.slice(0, boundary) : text.slice(0, Math.max(0, maxChars));
  const pages = [...cut.matchAll(/\[Page (\d+)\]/g)];
  return { text: cut, lastPage: pages.length ? Number(pages[pages.length - 1][1]) : null };
}

/**
 * Prompt built around source text, with a `shrink` that providers with small request limits use to cut the
 * source at a page boundary. `coverage()` reports which pages the answer that was used could see.
 */
export function sourcePrompt(source: { text: string; lastPage: number; truncated: boolean }, make: (text: string) => string) {
  let lastPage = source.lastPage;
  let truncated = source.truncated;
  return {
    prompt: make(source.text),
    shrink: (maxChars: number) => {
      const cut = cutAtPage(source.text, maxChars - make("").length);
      if (cut.lastPage !== null) {
        lastPage = cut.lastPage;
        truncated = true;
      }
      return make(cut.text);
    },
    coverage: () => ({ lastPage, truncated }),
  };
}

/** Instruction for the output language from the user's profile preference. */
export async function languageInstruction(db: SupabaseClient, userId: string): Promise<{ language: string | null; instruction: string }> {
  const profile = must(
    await db.from("profiles").select("output_language").eq("id", userId).maybeSingle(),
    "load your preferences",
  ) as { output_language: string | null } | null;
  const language = profile?.output_language ?? null;
  return {
    language,
    instruction: language
      ? `Write all output in ${language}.`
      : "Write all output in the same language as the source material.",
  };
}

/** Logs a study activity event; failures are reported but never fail the request. */
export async function logActivity(db: SupabaseClient, kind: string, documentId: string | null) {
  const { error } = await db.from("activity_events").insert({ kind, document_id: documentId });
  if (error) console.error("activity insert failed", error.message);
}
