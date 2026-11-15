// Detects a document's chapters from the opening lines of each page.
// The model only proposes titles and start pages; end pages are derived so ranges never overlap or leave gaps.
import { z } from "npm:zod@3.25.67";
import { generateJson } from "../_shared/ai/index.ts";
import { handle, HttpError, must, mustList } from "../_shared/http.ts";
import { loadDocument } from "../_shared/study.ts";
import { buildHeadingOutline } from "../_shared/outline.ts";

const Body = z.object({ document_id: z.string().uuid(), force: z.boolean().optional() });
const Output = z.object({
  chapters: z
    .array(z.object({ title: z.string().trim().min(1).max(200), start_page: z.number().int().min(1) }))
    .min(1)
    .max(80),
});

// Free-tier Gemini latency grows with input size (~35 s for 1.2k tokens observed), so keep the outline small.
const MAX_PROMPT_CHARS = 16_000;

handle("extract-chapters", Body, async ({ body, db, record }) => {
  const doc = await loadDocument(db, body.document_id);

  const existing = mustList(
    await db.from("document_chapters").select("*").eq("document_id", doc.id).order("position"),
    "load chapters",
  );
  if (existing.length > 0 && !body.force) return { chapters: existing, cached: true };

  const pages = must(
    await db.from("document_pages").select("page_number, content").eq("document_id", doc.id).order("page_number"),
    "load page text",
  ) as { page_number: number; content: string }[];
  const pageCount = doc.page_count ?? pages.length;
  if (pageCount === 0 || pages.every((p) => !p.content.trim())) {
    throw new HttpError(422, "This PDF has no readable text (it may be a scanned image), so chapters can't be detected.");
  }

  const { outline, sampled } = buildHeadingOutline(pages, MAX_PROMPT_CHARS);
  if (!outline) throw new HttpError(422, "Couldn't find any headings in this PDF's text to detect chapters from.");

  const out = await generateJson(
    {
      system:
        "You identify the chapter structure of study material. Use the document's own chapter or section headings. " +
        "If there are no explicit chapters, group the pages into sensible topic sections of similar size.",
      prompt:
        `Document: "${doc.title}" (${pageCount} pages). ` +
        `Below are the chapter-start signals found in its text${sampled ? " (a sample)" : ""}: the first page where each running page header appears ` +
        `(textbooks print the chapter name in the header), explicit chapter markers, and title-style lines. ` +
        `Some headers repeat the book's name rather than a chapter's; a merged file may contain several books. ` +
        `Text may be garbled by the PDF (e.g. "S S S ECTORS" = "Sectors"); write titles cleanly.\n\n${outline}\n\n` +
        `Return JSON: {"chapters": [{"title": string, "start_page": number}]} in reading order. ` +
        `Use between 1 and 40 chapters. The first chapter should start at page 1. Keep titles short and use the document's wording.`,
      temperature: 0.1,
      maxOutputTokens: 4096,
    },
    Output,
    record,
  );

  // Normalise: clamp to the document, sort, drop duplicate starts, force the first to page 1.
  const starts = new Map<number, string>();
  for (const c of out.chapters) {
    const start = Math.min(Math.max(1, c.start_page), pageCount);
    if (!starts.has(start)) starts.set(start, c.title);
  }
  const sorted = [...starts.entries()].sort((a, b) => a[0] - b[0]);
  sorted[0][0] = 1;
  const rows = sorted.map(([start, title], i) => ({
    document_id: doc.id,
    position: i + 1,
    title,
    start_page: start,
    end_page: i + 1 < sorted.length ? sorted[i + 1][0] - 1 : pageCount,
  }));

  if (existing.length > 0) must(await db.from("document_chapters").delete().eq("document_id", doc.id), "replace old chapters");
  const chapters = must(await db.from("document_chapters").insert(rows).select("*").order("position"), "save chapters");
  return { chapters, cached: false };
});
