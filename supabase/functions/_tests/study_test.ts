import { cutAtPage, sourcePrompt } from "../_shared/study.ts";
const text = [1, 2, 3, 4].map((n) => `[Page ${n}]\n${"a".repeat(100)}`).join("\n\n");
Deno.test("cutAtPage keeps whole pages and reports the last one", () => {
  const r = cutAtPage(text, 250);
  if (r.lastPage !== 2 || r.text.includes("[Page 3]") || r.text.length > 250) throw new Error(JSON.stringify({ lp: r.lastPage, len: r.text.length }));
  if (cutAtPage(text, 10_000).lastPage !== null) throw new Error("cut when it fit");
});
Deno.test("sourcePrompt coverage follows the shrink", () => {
  const b = sourcePrompt({ text, lastPage: 4, truncated: false }, (t) => `HEAD\n${t}\nTAIL`);
  if (b.coverage().truncated) throw new Error("truncated before shrink");
  const p = b.shrink(260);
  if (p.length > 260 || !p.startsWith("HEAD") || !p.endsWith("TAIL") || b.coverage().lastPage !== 2 || !b.coverage().truncated) throw new Error(JSON.stringify(b.coverage()) + p.length);
});
