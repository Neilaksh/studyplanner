// Picks providers from secrets, retries transient failures, falls back, and validates JSON output.
import type { z } from "npm:zod@3.25.67";
import { anthropicProvider } from "./anthropic.ts";
import { geminiProvider } from "./gemini.ts";
import { openAICompatibleProvider } from "./openaiCompatible.ts";
import { type AIProvider, type GenerateRequest, type GenerateResult, ProviderError } from "./provider.ts";

export { ProviderError } from "./provider.ts";

const env = (k: string) => Deno.env.get(k)?.trim() || undefined;

function requireKey(name: string, secret: string): string {
  const key = env(secret);
  if (!key) throw new ProviderError(`AI provider "${name}" is selected but the ${secret} secret is not set.`, null, false);
  return key;
}

/** Comma-separated list from a secret, or the default. */
const listEnv = (k: string, fallback: string[]) => env(k)?.split(",").map((m) => m.trim()).filter(Boolean) ?? fallback;

// Free-tier Gemini models are often congested (503 "high demand", or no answer for minutes). A lighter model
// is tried next instead of retrying the busy one. Override the order with GEMINI_MODEL, e.g. "m1,m2".
const DEFAULT_GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];
// Groq production chat models (console.groq.com/docs/models, checked 2026-11-15).
const DEFAULT_GROQ_MODELS = ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "llama-3.1-8b-instant"];

/** Providers for one vendor, in the order to try them. Models can be overridden with secrets. */
export function providersByName(name: string): AIProvider[] {
  switch (name) {
    case "gemini": {
      const key = requireKey(name, "GEMINI_API_KEY");
      const opts = { thinkingLevel: env("GEMINI_THINKING_LEVEL") ?? "low", jsonMode: env("GEMINI_JSON_MODE") === "on" };
      return listEnv("GEMINI_MODEL", DEFAULT_GEMINI_MODELS).map((m) => geminiProvider(key, m, opts));
    }
    case "groq":
      // Free-tier Groq allows roughly 12-18k tokens per minute including output, so requests are kept small.
      // Keys can be restricted to some models; one the key cannot use fails fast (404) and the next is tried.
      const key = requireKey(name, "GROQ_API_KEY");
      const limits = { maxPromptChars: Number(env("GROQ_MAX_PROMPT_CHARS")) || 24_000, maxOutputTokens: 3000 };
      return listEnv("GROQ_MODEL", DEFAULT_GROQ_MODELS).map((m) =>
        openAICompatibleProvider("groq", "https://api.groq.com/openai/v1", key, m, limits),
      );
    case "openrouter":
      return [openAICompatibleProvider("openrouter", "https://openrouter.ai/api/v1", requireKey(name, "OPENROUTER_API_KEY"), env("OPENROUTER_MODEL") ?? "meta-llama/llama-3.3-70b-instruct:free")];
    case "mistral":
      return [openAICompatibleProvider("mistral", "https://api.mistral.ai/v1", requireKey(name, "MISTRAL_API_KEY"), env("MISTRAL_MODEL") ?? "mistral-small-latest")];
    case "anthropic":
      return [anthropicProvider(requireKey(name, "ANTHROPIC_API_KEY"), env("ANTHROPIC_MODEL") ?? "claude-haiku-5-5")];
    default:
      throw new ProviderError(`Unknown AI_PROVIDER "${name}". Use gemini, groq, openrouter, mistral or anthropic.`, null, false);
  }
}

export type CallRecord = {
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number;
  ok: boolean;
  error: string | null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Edge Functions are stopped (HTTP 546) past their wall-clock limit (150 s on the free plan). All AI work for
// one request must finish well inside it so the function can still save results and reply with a clear error.
const TOTAL_BUDGET_MS = 115_000;
// A model that is not the last in the chain gets a shorter slot, so the next one still has time to answer.
const EARLY_CALL_MS = 45_000;
const MIN_USEFUL_MS = 8_000;

const timedOut = () =>
  new ProviderError("The AI took too long to answer. Try a smaller section (one chapter) or try again.", null, false);

function isAbort(err: unknown) {
  return err instanceof DOMException ? err.name === "TimeoutError" || err.name === "AbortError" : false;
}

/**
 * Tries each provider in order within one deadline. An earlier provider gets one attempt and any failure
 * (busy, rate limited, timed out, model unavailable) moves on to the next; the last provider gets up to two
 * retries on transient errors. Every attempt is recorded.
 */
/** Returns the answer and the chain position that produced it, so a format retry can go straight back there. */
async function generate(
  req: GenerateRequest,
  record: (r: CallRecord) => void,
  deadline: number,
  startAt = 0,
): Promise<GenerateResult & { index: number }> {
  const fallback = env("AI_FALLBACK");
  const primaryName = env("AI_PROVIDER") ?? "gemini";
  const chain = [...providersByName(primaryName), ...(fallback && fallback !== primaryName ? providersByName(fallback) : [])];

  let lastError: unknown;
  let sawBusy = false; // any 503/429 means the provider is overloaded, which matters more than a later timeout
  for (let i = Math.min(startAt, chain.length - 1); i < chain.length; i++) {
    const provider = chain[i];
    const isLast = i === chain.length - 1;
    for (let attempt = 0; attempt < (isLast ? 3 : 1); attempt++) {
      const remaining = deadline - Date.now();
      if (remaining < MIN_USEFUL_MS) throw lastError ?? timedOut();
      const slot = isLast ? remaining : Math.min(EARLY_CALL_MS, remaining - MIN_USEFUL_MS);
      let sized = req;
      if (provider.maxPromptChars && req.system.length + req.prompt.length > provider.maxPromptChars) {
        if (!req.shrink) {
          lastError ??= new ProviderError(`The request is too large for ${provider.name}.`, 413, false);
          break; // skip this provider
        }
        sized = { ...req, prompt: req.shrink(provider.maxPromptChars - req.system.length) };
      }
      const started = Date.now();
      try {
        const out = await provider.generate({ ...sized, signal: AbortSignal.timeout(slot) });
        record({ provider: provider.name, model: provider.model, inputTokens: out.inputTokens, outputTokens: out.outputTokens, durationMs: Date.now() - started, ok: true, error: null });
        return { ...out, index: i };
      } catch (caught) {
        const err = isAbort(caught) ? timedOut() : caught;
        lastError = err;
        if (err instanceof ProviderError && (err.status === 503 || err.status === 429)) sawBusy = true;
        const message = err instanceof Error ? err.message : String(err);
        record({ provider: provider.name, model: provider.model, inputTokens: null, outputTokens: null, durationMs: Date.now() - started, ok: false, error: message.slice(0, 500) });
        if (!isLast) break; // move on to the next model or provider
        const retryable = err instanceof ProviderError ? err.retryable : true; // network errors are retryable
        if (!retryable) break;
        const wait = err instanceof ProviderError && err.retryAfterMs ? Math.min(err.retryAfterMs, 20_000) : 1500 * 2 ** attempt;
        if (Date.now() + wait > deadline - MIN_USEFUL_MS) break;
        await sleep(wait);
      }
    }
  }
  if (sawBusy) {
    const names = [...new Set(chain.map((p) => p.name))].join(" and ");
    throw new ProviderError(
      `${names === "gemini" ? "Gemini is" : `${names} are`} overloaded right now (free-tier capacity). Try again in a few minutes` +
        (fallback ? "." : ", or add a backup provider with the AI_FALLBACK secret."),
      429,
      true,
    );
  }
  throw lastError;
}

/**
 * Parses a JSON object from model text. Without JSON mode, models may wrap it in ``` fences or add a
 * sentence around it, so fall back to the outermost {...} span.
 */
function parseJsonText(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) throw err;
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

/**
 * Generates JSON and validates it against `schema`. If the output does not parse or validate,
 * asks once more with the validation error included.
 */
export async function generateJson<S extends z.ZodTypeAny>(
  req: Omit<GenerateRequest, "json">,
  schema: S,
  record: (r: CallRecord) => void,
): Promise<z.infer<S>> {
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let prompt = req.prompt;
  let shrink = req.shrink;
  let startAt = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await generate({ ...req, prompt, shrink, json: true }, record, deadline, startAt);
    startAt = out.index; // the format retry goes back to the provider that answered
    let problem: string;
    try {
      const parsed = schema.safeParse(parseJsonText(out.text));
      if (parsed.success) return parsed.data;
      problem = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    } catch (err) {
      problem = `invalid JSON (${err instanceof Error ? err.message : String(err)})`;
    }
    const note = `\n\nYour previous answer was rejected: ${problem}. Return only a JSON object that matches the required format exactly.`;
    prompt = req.prompt + note;
    shrink = req.shrink && ((max: number) => req.shrink!(max - note.length) + note);
  }
  throw new ProviderError("The AI returned output in the wrong format twice. Try again.", null, true);
}

/** Plain-text generation (no JSON), with the same retry and fallback behaviour. */
export async function generateText(req: Omit<GenerateRequest, "json">, record: (r: CallRecord) => void): Promise<string> {
  return (await generate({ ...req, json: false }, record, Date.now() + TOTAL_BUDGET_MS)).text.trim();
}
