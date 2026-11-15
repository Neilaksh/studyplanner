import { z } from "npm:zod@3.25.67";
import { generateJson, generateText, type CallRecord } from "../_shared/ai/index.ts";

type Reply = { status: number; body: unknown; headers?: Record<string, string> };
let replies: Reply[] = [];
const seen: { url: string; body: any }[] = [];
const scriptedFetch = (async (input: string | URL | Request, init?: RequestInit) => {
  seen.push({ url: String(input), body: JSON.parse(String(init?.body ?? "{}")) });
  const r = replies.shift();
  if (!r) throw new Error("no scripted reply");
  return new Response(JSON.stringify(r.body), { status: r.status, headers: r.headers });
}) as typeof fetch;
globalThis.fetch = scriptedFetch;

const gem = (text: string) => ({ status: 200, body: { candidates: [{ content: { parts: [{ text }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } } });
const groq = (text: string) => ({ status: 200, body: { choices: [{ message: { content: text } }], usage: { prompt_tokens: 7, completion_tokens: 3 } } });
const rate = { status: 429, body: { error: { message: "quota" } }, headers: { "retry-after": "0.01" } };
const Schema = z.object({ n: z.number() });
const reset = (env: Record<string, string>) => {
  replies = []; seen.length = 0;
  for (const k of ["AI_PROVIDER", "AI_FALLBACK", "GEMINI_API_KEY", "GROQ_API_KEY", "GEMINI_MODEL"]) Deno.env.delete(k);
  for (const [k, v] of Object.entries(env)) Deno.env.set(k, v);
};

Deno.test("gemini 3 default: low thinking, no temperature, JSON via instructions, key in header", async () => {
  reset({ GEMINI_API_KEY: "k-gem" });
  replies = [gem('{"n": 1}')];
  const recs: CallRecord[] = [];
  const out = await generateJson({ system: "s", prompt: "p" }, Schema, (r) => recs.push(r));
  if (out.n !== 1) throw new Error("bad output");
  if (seen[0].url.includes("k-gem")) throw new Error("API key leaked into URL");
  const gc = seen[0].body.generationConfig;
  if (gc.thinkingConfig?.thinkingLevel !== "low") throw new Error("thinking level not low: " + JSON.stringify(gc));
  if ("temperature" in gc || "responseMimeType" in gc) throw new Error("sent temperature/JSON mode to Gemini 3: " + JSON.stringify(gc));
  if (!seen[0].body.systemInstruction.parts[0].text.includes("single JSON object")) throw new Error("JSON instruction missing");
  if (recs.length !== 1 || !recs[0].ok || recs[0].inputTokens !== 10) throw new Error("bad record " + JSON.stringify(recs));
});

Deno.test("strips code fences", async () => {
  reset({ GEMINI_API_KEY: "k" });
  replies = [gem('```json\n{"n": 2}\n```')];
  const out = await generateJson({ system: "s", prompt: "p" }, Schema, () => {});
  if (out.n !== 2) throw new Error("fence not stripped");
});

Deno.test("invalid shape: asks again with the validation error", async () => {
  reset({ GEMINI_API_KEY: "k" });
  replies = [gem('{"n": "three"}'), gem('{"n": 3}')];
  const out = await generateJson({ system: "s", prompt: "p" }, Schema, () => {});
  if (out.n !== 3) throw new Error("no repair");
  if (!seen[1].body.contents[0].parts[0].text.includes("previous answer was rejected")) throw new Error("repair prompt missing");
});

Deno.test("rate limit: retries then succeeds, records each attempt", async () => {
  reset({ GEMINI_API_KEY: "k" });
  replies = [rate, gem('{"n": 4}')];
  const recs: CallRecord[] = [];
  const out = await generateJson({ system: "s", prompt: "p" }, Schema, (r) => recs.push(r));
  if (out.n !== 4 || recs.length !== 2 || recs[0].ok || !recs[1].ok) throw new Error("retry wrong " + JSON.stringify(recs));
});

Deno.test("primary exhausted: falls back to groq", async () => {
  reset({ GEMINI_API_KEY: "k", GROQ_API_KEY: "g", AI_FALLBACK: "groq" });
  replies = [rate, rate, rate, groq('{"n": 5}')];
  const recs: CallRecord[] = [];
  const out = await generateJson({ system: "s", prompt: "p" }, Schema, (r) => recs.push(r));
  if (out.n !== 5) throw new Error("no fallback");
  if (!seen[3].url.includes("api.groq.com") || seen[3].body.response_format?.type !== "json_object") throw new Error("groq call wrong");
  if (recs.at(-1)?.provider !== "groq") throw new Error("fallback not recorded");
});

Deno.test("single model: non-retryable 400 fails immediately without retries", async () => {
  reset({ GEMINI_API_KEY: "k", GEMINI_MODEL: "gemini-3.8-flash" });
  replies = [{ status: 400, body: { error: { message: "bad model" } } }];
  let msg = "";
  try { await generateText({ system: "s", prompt: "p" }, () => {}); } catch (e) { msg = (e as Error).message; }
  if (!msg.includes("400") || !msg.includes("bad model") || seen.length !== 1) throw new Error("unexpected: " + msg + " calls=" + seen.length);
});

Deno.test("missing key: clear error naming the secret", async () => {
  reset({});
  let msg = "";
  try { await generateText({ system: "s", prompt: "p" }, () => {}); } catch (e) { msg = (e as Error).message; }
  if (!msg.includes("GEMINI_API_KEY")) throw new Error("unclear: " + msg);
});

Deno.test("slow provider: aborted by the per-call timeout, not left hanging", async () => {
  reset({ GEMINI_API_KEY: "k" });
  const realTimeout = AbortSignal.timeout;
  AbortSignal.timeout = () => realTimeout.call(AbortSignal, 50); // shrink the 70 s budget for the test
  globalThis.fetch = ((_: unknown, init?: RequestInit) =>
    new Promise((_r, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)))) as typeof fetch;
  let msg = "";
  const started = Date.now();
  try { await generateText({ system: "s", prompt: "p" }, () => {}); } catch (e) { msg = (e as Error).message; }
  AbortSignal.timeout = realTimeout;
  globalThis.fetch = scriptedFetch;
  if (!msg.includes("took too long")) throw new Error("unexpected: " + msg);
  if (Date.now() - started > 2000) throw new Error("timeout did not abort promptly");
});

Deno.test("gemini 2.x keeps temperature and JSON mode", async () => {
  reset({ GEMINI_API_KEY: "k", GEMINI_MODEL: "gemini-2.0-flash" });
  replies = [gem('{"n": 6}')];
  await generateJson({ system: "s", prompt: "p" }, Schema, () => {});
  const gc = seen[0].body.generationConfig;
  if (gc.responseMimeType !== "application/json" || typeof gc.temperature !== "number" || gc.thinkingConfig) throw new Error(JSON.stringify(gc));
});

Deno.test("JSON wrapped in prose is still parsed; thought parts are ignored", async () => {
  reset({ GEMINI_API_KEY: "k" });
  replies = [{ status: 200, body: { candidates: [{ content: { parts: [{ text: "thinking...", thought: true }, { text: 'Here you go: {"n": 7} Hope this helps.' }] } }] } }];
  const out = await generateJson({ system: "s", prompt: "p" }, Schema, () => {});
  if (out.n !== 7) throw new Error("not parsed");
});

Deno.test("503 high demand on the first model moves to the next model, recorded per model", async () => {
  reset({ GEMINI_API_KEY: "k" });
  replies = [{ status: 503, body: { error: { message: "This model is currently experiencing high demand." } } }, gem('{"n": 8}')];
  const recs: CallRecord[] = [];
  const out = await generateJson({ system: "s", prompt: "p" }, Schema, (r) => recs.push(r));
  if (out.n !== 8) throw new Error("no model fallback");
  if (!seen[0].url.includes("gemini-3.8-flash") || !seen[1].url.includes("gemini-3.5-flash-lite")) throw new Error(seen.map((x) => x.url).join(" "));
  if (recs.map((r) => r.model + ":" + r.ok).join() !== "gemini-3.8-flash:false,gemini-3.5-flash-lite:true") throw new Error(JSON.stringify(recs));
});

Deno.test("GEMINI_MODEL accepts a comma-separated order", async () => {
  reset({ GEMINI_API_KEY: "k", GEMINI_MODEL: "m-a, m-b" });
  replies = [{ status: 404, body: { error: { message: "not found" } } }, gem('{"n": 9}')];
  const out = await generateJson({ system: "s", prompt: "p" }, Schema, () => {});
  if (out.n !== 9 || !seen[0].url.includes("/m-a:") || !seen[1].url.includes("/m-b:")) throw new Error(seen.map((x) => x.url).join(" "));
});

Deno.test("every model overloaded: says overloaded and suggests AI_FALLBACK, not 'too long'", async () => {
  reset({ GEMINI_API_KEY: "k" });
  const busy = { status: 503, body: { error: { message: "high demand" } } };
  replies = [busy, busy, busy, busy];
  let err: any;
  try { await generateText({ system: "s", prompt: "p" }, () => {}); } catch (e) { err = e; }
  if (!/Gemini is overloaded/.test(err?.message) || !/AI_FALLBACK/.test(err?.message) || err?.status !== 429) throw new Error(String(err?.message));
});

Deno.test("Gemini overloaded -> Groq gets a prompt shrunk under its limit, with the repair note kept", async () => {
  reset({ GEMINI_API_KEY: "k", GROQ_API_KEY: "g", AI_FALLBACK: "groq" });
  const busy = { status: 503, body: { error: { message: "high demand" } } };
  replies = [busy, busy, groq('{"n": "bad"}'), groq('{"n": 10}')];
  const big = "SOURCE:\n" + Array.from({ length: 60 }, (_, i) => `[Page ${i + 1}]\n${"word ".repeat(200)}\n\n`).join("");
  let shrunkTo = 0;
  const out = await generateJson({ system: "s", prompt: big, shrink: (max) => { shrunkTo = max; return big.slice(0, max); } }, Schema, () => {});
  if (out.n !== 10) throw new Error("no groq answer");
  const groqCalls = seen.filter((c) => c.url.includes("groq"));
  for (const c of groqCalls) {
    const size = c.body.messages.reduce((n: number, m: any) => n + m.content.length, 0);
    if (size > 24_000) throw new Error(`groq prompt too big: ${size}`);
    if (c.body.max_tokens > 3000) throw new Error("groq max_tokens not capped");
  }
  if (!groqCalls[1].body.messages[1].content.includes("previous answer was rejected")) throw new Error("repair note lost when shrinking");
  if (seen.some((c) => c.url.includes("gemini") && c.body.contents[0].parts[0].text.length !== big.length)) throw new Error("gemini prompt was shrunk");
});

Deno.test("oversized prompt without shrink skips the size-limited provider", async () => {
  reset({ GEMINI_API_KEY: "k", GEMINI_MODEL: "only-model", GROQ_API_KEY: "g", AI_FALLBACK: "groq" });
  replies = [{ status: 503, body: { error: { message: "high demand" } } }];
  let msg = "";
  try { await generateText({ system: "s", prompt: "x".repeat(30_000) }, () => {}); } catch (e) { msg = (e as Error).message; }
  if (seen.some((c) => c.url.includes("groq"))) throw new Error("called groq with an oversized prompt");
  if (!/overloaded/.test(msg)) throw new Error(msg);
});

Deno.test("Groq model the key cannot use (404) is skipped for the next Groq model", async () => {
  reset({ GEMINI_API_KEY: "k", GEMINI_MODEL: "g1", GROQ_API_KEY: "g", AI_FALLBACK: "groq" });
  replies = [
    { status: 503, body: { error: { message: "high demand" } } },
    { status: 404, body: { error: { message: "The model `llama-3.3-70b-versatile` does not exist or you do not have access to it." } } },
    groq('{"n": 11}'),
  ];
  const out = await generateJson({ system: "s", prompt: "p" }, Schema, () => {});
  if (out.n !== 11 || seen[2].body.model !== "openai/gpt-oss-120b") throw new Error(JSON.stringify(seen.map((c) => c.body.model ?? c.url)));
});
