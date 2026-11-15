import { type AIProvider, errorFromResponse, type GenerateRequest, type GenerateResult, ProviderError } from "./provider.ts";

const API = "https://generativelanguage.googleapis.com/v1beta/models";

export type GeminiOptions = {
  /** Gemini 3+ only: low | medium | high (some models also accept minimal). Lower is faster. */
  thinkingLevel: string;
  /** Use responseMimeType JSON on Gemini 3+. Off by default: combined with thinking it has been seen to hang. */
  jsonMode: boolean;
};

/** Gemini 3 and later use thinking levels and drop sampling parameters such as temperature. */
const isGemini3Plus = (model: string) => /^gemini-([3-9]|\d{2,})/.test(model);

export function geminiProvider(apiKey: string, model: string, opts: GeminiOptions): AIProvider {
  const modern = isGemini3Plus(model);
  return {
    name: "gemini",
    model,
    async generate(req: GenerateRequest): Promise<GenerateResult> {
      const useJsonMode = req.json && (!modern || opts.jsonMode);
      const system =
        req.json && !useJsonMode ? `${req.system}\n\nRespond with a single JSON object and nothing else.` : req.system;
      const generationConfig: Record<string, unknown> = {
        maxOutputTokens: req.maxOutputTokens ?? 8192,
        ...(useJsonMode ? { responseMimeType: "application/json" } : {}),
        ...(modern
          ? { thinkingConfig: { thinkingLevel: opts.thinkingLevel } }
          : { temperature: req.temperature ?? 0.3 }),
      };

      const res = await fetch(`${API}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        signal: req.signal,
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: req.prompt }] }],
          generationConfig,
        }),
      });
      if (!res.ok) {
        const err = await errorFromResponse("Gemini", res);
        if (res.status === 404) {
          throw new ProviderError(`${err.message} (model "${model}"; set the GEMINI_MODEL secret to a model your key can use)`, 404, false);
        }
        throw err;
      }
      const body = await res.json();
      const candidate = body?.candidates?.[0];
      // Skip thought-summary parts; only the answer text is returned.
      const text: string = (candidate?.content?.parts ?? [])
        .filter((p: { thought?: boolean }) => !p.thought)
        .map((p: { text?: string }) => p.text ?? "")
        .join("");
      if (!text) {
        const reason = candidate?.finishReason ?? body?.promptFeedback?.blockReason ?? "no content";
        throw new ProviderError(`Gemini returned no text (${reason})`, null, reason === "MAX_TOKENS");
      }
      return {
        text,
        inputTokens: body?.usageMetadata?.promptTokenCount ?? null,
        outputTokens: body?.usageMetadata?.candidatesTokenCount ?? null,
      };
    },
  };
}
