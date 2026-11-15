// Summarises a chapter or document. Results are cached per (document, chapter, language).
import { z } from "npm:zod@3.25.67";
import { generateJson } from "../_shared/ai/index.ts";
import { handle, must, mustList } from "../_shared/http.ts";
import { languageInstruction, loadChapter, loadDocument, loadPageText, logActivity, sourcePrompt } from "../_shared/study.ts";

const Body = z.object({
  document_id: z.string().uuid(),
  chapter_id: z.string().uuid().optional(),
  force: z.boolean().optional(),
});

const Output = z.object({
  key_points: z.array(z.string().trim().min(1).max(500)).min(3).max(12),
  summary: z.string().trim().min(50).max(8000),
});

const MAX_SOURCE_CHARS = 80_000;

handle("summarize", Body, async ({ body, db, userId, record }) => {
  const doc = await loadDocument(db, body.document_id);
  const chapter = body.chapter_id ? await loadChapter(db, doc.id, body.chapter_id) : null;
  const { language, instruction } = await languageInstruction(db, userId);

  let cachedQuery = db.from("summaries").select("*").eq("document_id", doc.id);
  cachedQuery = chapter ? cachedQuery.eq("chapter_id", chapter.id) : cachedQuery.is("chapter_id", null);
  cachedQuery = language ? cachedQuery.eq("language", language) : cachedQuery.is("language", null);
  const cached = mustList(await cachedQuery.order("created_at", { ascending: false }).limit(1), "load the summary");
  if (cached.length > 0 && !body.force) return { summary: cached[0], cached: true };

  const from = chapter?.start_page ?? 1;
  const to = chapter?.end_page ?? doc.page_count ?? 100_000;
  const source = await loadPageText(db, doc.id, from, to, MAX_SOURCE_CHARS);

  const built = sourcePrompt(
    source,
    (text) =>
      `Summarise ${chapter ? `the chapter "${chapter.title}"` : `"${doc.title}"`}.\n\nSOURCE:\n${text}\n\n` +
      `Return JSON: {"key_points": [3-12 short bullet strings], "summary": string of 2-5 paragraphs in Markdown}.`,
  );
  const out = await generateJson(
    {
      system:
        "You summarise study material for a student revising for an exam. Be accurate and specific; keep definitions, " +
        "formulas and named concepts. Do not add facts that are not in the source. " +
        instruction,
      prompt: built.prompt,
      shrink: built.shrink,
      temperature: 0.2,
    },
    Output,
    record,
  );

  const covered = built.coverage();
  const note = covered.truncated ? `\n\n_Covers pages ${from}–${covered.lastPage}; the rest was too long to include._` : "";
  const content = `## Key points\n\n${out.key_points.map((p) => `- ${p}`).join("\n")}\n\n## Summary\n\n${out.summary}${note}`;

  if (cached.length > 0) must(await db.from("summaries").delete().eq("id", cached[0].id), "replace the old summary");
  const summary = must(
    await db
      .from("summaries")
      .insert({ document_id: doc.id, chapter_id: chapter?.id ?? null, language, content })
      .select("*")
      .single(),
    "save the summary",
  );
  await logActivity(db, "summary", doc.id);
  return { summary, cached: false };
});
