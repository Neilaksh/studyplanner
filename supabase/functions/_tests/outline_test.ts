import { buildHeadingOutline } from "../_shared/outline.ts";

const body = "which can be used to satisfy our needs,\nprovided, it is technologically accessible,\nand economically feasible";
// Textbook layout: even pages carry the book name, odd pages the chapter name (same as the user's 376-page PDF).
function textbook() {
  const chapters = [["RESOURCES AND DEVELOPMENT", 3], ["WATER RESOURCES", 21], ["AGRICULTURE", 33]] as const;
  const pages = [];
  for (let n = 1; n <= 44; n++) {
    const ch = [...chapters].reverse().find(([, s]) => n >= s);
    const header = n === 1 || !ch ? "Everything available in our environment" : n % 2 === 0 ? `${n} CONTEMPORARY INDIA – II` : `${n} ${ch[0]}`;
    pages.push({ page_number: n, content: `${header}\n${body}` });
  }
  return pages;
}

Deno.test("textbook: one entry per running header's first page, not per page", () => {
  const { outline, entries } = buildHeadingOutline(textbook(), 16_000);
  for (const want of ["[Page 4] (page header) CONTEMPORARY INDIA – II", "[Page 3] (page header) RESOURCES AND DEVELOPMENT", "[Page 21] (page header) WATER RESOURCES", "[Page 33] (page header) AGRICULTURE"])
    if (!outline.includes(want)) throw new Error(`missing "${want}" in:\n${outline}`);
  if (entries > 6) throw new Error(`too many entries (${entries}):\n${outline}`);
  if (/Page 2[2-9]\]|Page 4\]/.test(outline.replace("[Page 21]", "").replace("[Page 4]", ""))) throw new Error("repeated headers leaked:\n" + outline);
});

Deno.test("no running headers: markers and title lines are used; body lines are not", () => {
  const pages = [
    { page_number: 1, content: "Introduction to Cells\n" + body },
    { page_number: 2, content: body },
    { page_number: 3, content: "CHAPTER 2\nThe Nucleus\n" + body },
    { page_number: 4, content: "the cell membrane controls what enters,\n" + body },
  ];
  const { outline } = buildHeadingOutline(pages, 16_000);
  if (!outline.includes("[Page 1] (title) Introduction to Cells")) throw new Error(outline);
  if (!outline.includes("[Page 3] (marker) CHAPTER 2 The Nucleus")) throw new Error(outline);
  if (/Page [24]\]/.test(outline)) throw new Error("body text leaked:\n" + outline);
});

Deno.test("over budget: drops titles first, then samples, and never exceeds the cap", () => {
  const name = (i: number) => String.fromCharCode(65 + (i % 26)) + String.fromCharCode(97 + (Math.floor(i / 26) % 26)) + "x";
  const pages = Array.from({ length: 400 }, (_, i) => ({ page_number: i + 1, content: `Topic ${name(i)} Heading
Chapter ${i + 1}
${body}` }));
  const { outline, sampled } = buildHeadingOutline(pages, 2_000);
  if (outline.length > 2_000 || !sampled) throw new Error(`len ${outline.length}, sampled ${sampled}`);
});
