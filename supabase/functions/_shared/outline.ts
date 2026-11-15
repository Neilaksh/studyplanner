// Builds a compact outline of a document for chapter detection. Only lines that signal a chapter start are kept:
//  1. the first page on which each running header appears (textbooks print the chapter name at the top of its
//     pages, so a header's first appearance marks where that chapter begins);
//  2. explicit markers such as "Chapter 3" or "Unit IV";
//  3. title-style lines (Title Case or ALL CAPS, short, no sentence punctuation) near the top of a page.
// pdf.js splits body text into short lines, so length alone does not identify headings.

export type PageText = { page_number: number; content: string };

const TOP_LINES = 6;
const RECURRING_MIN_PAGES = 3;
const MARKER = /^(chapter|unit|lesson|part|module|section)\s*([0-9]+|[ivxlc]+)\b/i;
const SMALL_WORDS = new Set(["a", "an", "and", "the", "of", "in", "on", "for", "to", "with", "at", "by", "or", "&", "–", "-"]);

const letterKey = (line: string) => line.toLowerCase().replace(/[^\p{L}]/gu, "");
/** Drops leading/trailing page numbers ("51 Minerals and Energy Resources", "Political Parties 49"). */
const stripPageNumbers = (line: string) => line.replace(/^\d+\s+/, "").replace(/\s+\d+$/, "").trim();

function looksLikeTitle(line: string) {
  if (line.length < 4 || line.length > 60) return false;
  if (/[.,;:?!]$/.test(line) || /^[\d•\-–(]/.test(line)) return false;
  const words = line.split(" ").filter(Boolean);
  if (line === line.toUpperCase()) return /\p{Lu}/u.test(line);
  return words.every((w) => /^\p{Lu}/u.test(w) || SMALL_WORDS.has(w.toLowerCase()));
}

type Entry = { page: number; text: string; kind: "header" | "marker" | "title" };

export function buildHeadingOutline(pages: PageText[], maxChars: number) {
  const tops = pages.map((p) => ({
    page: p.page_number,
    lines: p.content
      .split("\n")
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter((l) => l.length >= 3 && /\p{L}/u.test(l))
      .slice(0, TOP_LINES),
  }));

  const firstLineCount = new Map<string, number>();
  for (const t of tops) {
    if (!t.lines[0]) continue;
    const k = letterKey(t.lines[0]);
    firstLineCount.set(k, (firstLineCount.get(k) ?? 0) + 1);
  }
  const isRecurring = (line: string) => (firstLineCount.get(letterKey(line)) ?? 0) >= RECURRING_MIN_PAGES;

  const entries: Entry[] = [];
  const headersSeen = new Set<string>();
  for (const t of tops) {
    const [first] = t.lines;
    const hasHeader = !!first && isRecurring(first);
    if (hasHeader && !headersSeen.has(letterKey(first))) {
      headersSeen.add(letterKey(first));
      entries.push({ page: t.page, text: stripPageNumbers(first), kind: "header" });
    }
    t.lines.forEach((line, i) => {
      if (MARKER.test(line)) {
        const next = t.lines[i + 1] && !MARKER.test(t.lines[i + 1]) ? ` ${t.lines[i + 1]}` : "";
        entries.push({ page: t.page, text: `${line}${next}`, kind: "marker" });
      }
    });
    // Title lines: skip a recurring header line itself; look at the first lines below it.
    for (const line of t.lines.slice(hasHeader ? 1 : 0, hasHeader ? 3 : 2)) {
      if (!isRecurring(line) && !MARKER.test(line) && looksLikeTitle(line)) entries.push({ page: t.page, text: line, kind: "title" });
    }
  }

  // Over budget: drop title lines first (weakest signal), then sample what is left evenly.
  const size = (es: Entry[]) => es.reduce((n, e) => n + e.text.length + 14, 0);
  let kept = entries;
  if (size(kept) > maxChars) kept = entries.filter((e) => e.kind !== "title");
  const step = Math.max(1, Math.ceil(size(kept) / maxChars));
  const chosen = kept.filter((_, i) => i % step === 0);

  const label = { header: "page header", marker: "marker", title: "title" } as const;
  const outline = chosen.map((e) => `[Page ${e.page}] (${label[e.kind]}) ${e.text}`).join("\n").slice(0, maxChars);
  return { outline, entries: chosen.length, sampled: step > 1 || kept.length < entries.length };
}
