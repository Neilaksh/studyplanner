// Writes chapter-specific descriptions and study tips for a plan's sessions with one AI call.
// The schedule itself is built without AI; this only enriches text. Sessions keep their template text
// for any key the model leaves out or answers badly.
import { z } from "npm:zod@3.25.67";
import { generateJson } from "../_shared/ai/index.ts";
import { handle, HttpError, must, mustList } from "../_shared/http.ts";
import { languageInstruction } from "../_shared/study.ts";

const Body = z.object({ plan_id: z.string().uuid() });
const Output = z.object({
  items: z
    .array(
      z.object({
        key: z.string(),
        description: z.string().trim().min(10).max(300),
        tips: z.array(z.string().trim().min(5).max(200)).min(1).max(3),
      }),
    )
    .max(200),
});

const HEAD_CHARS = 500;
const MAX_KEYS = 120;

type Session = { id: string; chapter_id: string | null; activity: string };

handle("plan-tips", Body, async ({ body, db, userId, record }) => {
  const plan = must(await db.from("study_plans").select("id, title").eq("id", body.plan_id).maybeSingle(), "load the plan");
  if (!plan) throw new HttpError(404, "Plan not found.");

  const sessions = mustList<Session>(
    await db.from("study_sessions").select("id, chapter_id, activity").eq("plan_id", plan.id),
    "load sessions",
  );
  const chapterIds = [...new Set(sessions.map((s) => s.chapter_id).filter((x): x is string => !!x))];
  const chapters = chapterIds.length
    ? mustList<{ id: string; title: string; document_id: string; start_page: number }>(
        await db.from("document_chapters").select("id, title, document_id, start_page").in("id", chapterIds),
        "load chapters",
      )
    : [];

  // A little of each chapter's opening text grounds the tips in its actual content.
  const heads = new Map<string, string>();
  for (const c of chapters) {
    const page = must(
      await db.from("document_pages").select("content").eq("document_id", c.document_id).eq("page_number", c.start_page).maybeSingle(),
      "load chapter text",
    ) as { content: string } | null;
    heads.set(c.id, (page?.content ?? "").replace(/\s+/g, " ").slice(0, HEAD_CHARS));
  }

  // One entry per (chapter, activity) pair; reading parts of the same chapter share tips.
  const keys = [...new Set(sessions.map((s) => `${s.chapter_id ?? "all"}:${s.activity}`))].slice(0, MAX_KEYS);
  const chapterLines = chapters.map((c) => `- ${c.id}: "${c.title}" — ${heads.get(c.id) || "(no text)"}`).join("\n");
  const { instruction } = await languageInstruction(db, userId);

  const out = await generateJson(
    {
      system:
        "You are a study coach writing short, specific guidance for scheduled study sessions. " +
        "Activities: read = reading the chapter, quiz = self-testing, summary = summarising key points, review = final revision of all chapters. " +
        "Each description is one sentence; each tip is one practical sentence tied to the chapter's actual topic. " +
        instruction,
      prompt:
        `Plan: "${plan.title}".\nChapters (id: title — opening text):\n${chapterLines || "(none)"}\n\n` +
        `Write guidance for each of these keys (format chapterId:activity, "all" = every chapter):\n${keys.join("\n")}\n\n` +
        `Return JSON: {"items": [{"key": string, "description": string, "tips": [2 strings]}]} with one item per key.`,
      temperature: 0.5,
      maxOutputTokens: 6000,
    },
    Output,
    record,
  );

  const valid = new Set(keys);
  let updated = 0;
  for (const item of out.items) {
    if (!valid.has(item.key)) continue;
    valid.delete(item.key);
    const [chapterKey, activity] = item.key.split(":");
    // Reading descriptions carry page ranges from the schedule; only their tips are replaced.
    const patch = activity === "read" ? { tips: item.tips.slice(0, 2) } : { tips: item.tips.slice(0, 2), description: item.description };
    let q = db.from("study_sessions").update(patch).eq("plan_id", plan.id).eq("activity", activity);
    q = chapterKey === "all" ? q.is("chapter_id", null) : q.eq("chapter_id", chapterKey);
    const { error } = await q;
    if (error) console.error("tips update failed", item.key, error.message);
    else updated++;
  }
  return { updated, total: keys.length };
});
