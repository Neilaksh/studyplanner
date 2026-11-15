// Explains a passage or concept, optionally using the surrounding pages of a document as context.
import { z } from "npm:zod@3.25.67";
import { generateText } from "../_shared/ai/index.ts";
import { handle } from "../_shared/http.ts";
import { languageInstruction, loadDocument, loadPageText, logActivity } from "../_shared/study.ts";

const Body = z.object({
  text: z.string().trim().min(1).max(4000),
  document_id: z.string().uuid().optional(),
  page: z.number().int().min(1).optional(),
});

const CONTEXT_CHARS = 12_000;

handle("explain", Body, async ({ body, db, userId, record }) => {
  const { instruction } = await languageInstruction(db, userId);

  let context = "";
  if (body.document_id) {
    const doc = await loadDocument(db, body.document_id);
    if (body.page) {
      const from = Math.max(1, body.page - 1);
      const to = Math.min(doc.page_count ?? body.page + 1, body.page + 1);
      try {
        context = (await loadPageText(db, doc.id, from, to, CONTEXT_CHARS)).text;
      } catch {
        context = ""; // explain without context if those pages have no text
      }
    }
    await logActivity(db, "explanation", doc.id);
  } else {
    await logActivity(db, "explanation", null);
  }

  const explanation = await generateText(
    {
      system:
        "You are a patient tutor. Explain clearly for a student: start with a one-sentence answer, then build up the idea " +
        "step by step, with a short example if it helps. Use Markdown. Stay consistent with the provided context. " +
        instruction,
      prompt: `${context ? `CONTEXT FROM THE STUDENT'S DOCUMENT:\n${context}\n\n` : ""}EXPLAIN THIS:\n${body.text}`,
      temperature: 0.4,
      maxOutputTokens: 2048,
    },
    record,
  );
  return { explanation };
});
