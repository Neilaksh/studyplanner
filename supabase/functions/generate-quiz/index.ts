// Generates a multiple-choice quiz from a chapter (or the start of the whole document) and saves it.
import { z } from "npm:zod@3.25.67";
import { generateJson } from "../_shared/ai/index.ts";
import { handle, must } from "../_shared/http.ts";
import { languageInstruction, loadChapter, loadDocument, loadPageText, logActivity, sourcePrompt } from "../_shared/study.ts";

const Body = z.object({
  document_id: z.string().uuid(),
  chapter_id: z.string().uuid().optional(),
  count: z.number().int().min(3).max(20).default(8),
});

const Question = z
  .object({
    prompt: z.string().trim().min(5).max(1000),
    choices: z.array(z.string().trim().min(1).max(400)).length(4),
    correct_index: z.number().int().min(0).max(3),
    explanation: z.string().trim().min(1).max(1500),
  })
  .refine((q) => new Set(q.choices.map((c) => c.toLowerCase())).size === 4, "choices must be distinct");

const MAX_SOURCE_CHARS = 60_000;

/** Models favour putting the answer first; shuffle so the correct position is uniform. */
function shuffleChoices(q: z.infer<typeof Question>) {
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { ...q, choices: order.map((i) => q.choices[i]), correct_index: order.indexOf(q.correct_index) };
}

handle("generate-quiz", Body, async ({ body, db, userId, record }) => {
  const doc = await loadDocument(db, body.document_id);
  const chapter = body.chapter_id ? await loadChapter(db, doc.id, body.chapter_id) : null;
  const from = chapter?.start_page ?? 1;
  const to = chapter?.end_page ?? doc.page_count ?? 100_000;
  const source = await loadPageText(db, doc.id, from, to, MAX_SOURCE_CHARS);
  const { instruction } = await languageInstruction(db, userId);

  const scope = chapter ? `the chapter "${chapter.title}"` : `"${doc.title}"`;
  const built = sourcePrompt(
    source,
    (text) =>
      `Write ${body.count} questions about ${scope}.\n\nSOURCE:\n${text}\n\n` +
      `Return JSON: {"title": string, "questions": [{"prompt": string, "choices": [4 strings], ` +
      `"correct_index": 0-3, "explanation": string}]}. The explanation says why the answer is right, citing the source.`,
  );
  const out = await generateJson(
    {
      system:
        "You write rigorous multiple-choice study questions. Test understanding, not trivia or page numbers. " +
        "Each question has exactly 4 plausible choices and exactly one correct answer, all grounded in the source text. " +
        instruction,
      prompt: built.prompt,
      shrink: built.shrink,
      temperature: 0.4,
    },
    z.object({ title: z.string().trim().min(1).max(200), questions: z.array(Question).min(1).max(body.count) }),
    record,
  );

  const quiz = must(
    await db
      .from("quizzes")
      .insert({ document_id: doc.id, chapter_id: chapter?.id ?? null, title: out.title })
      .select("id, title")
      .single(),
    "save the quiz",
  ) as { id: string; title: string };

  const questions = out.questions.map(shuffleChoices).map((q, i) => ({ quiz_id: quiz.id, position: i + 1, ...q }));
  const inserted = await db.from("quiz_questions").insert(questions);
  if (inserted.error) {
    await db.from("quizzes").delete().eq("id", quiz.id);
    must(inserted, "save the questions");
  }

  await logActivity(db, "quiz", doc.id);
  return { quiz_id: quiz.id, title: quiz.title, question_count: questions.length, source_truncated: built.coverage().truncated };
});
