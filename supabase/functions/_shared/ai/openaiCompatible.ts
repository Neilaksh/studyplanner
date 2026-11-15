// Any OpenAI-style chat completions API: Groq, OpenRouter, Mistral, etc.
import { type AIProvider, errorFromResponse, type GenerateRequest, type GenerateResult, ProviderError } from "./provider.ts";

export function openAICompatibleProvider(
  name: string,
  baseUrl: string,
  apiKey: string,
  model: string,
  limits: { maxPromptChars?: number; maxOutputTokens?: number } = {},
): AIProvider {
  return {
    name,
    model,
    maxPromptChars: limits.maxPromptChars,
    async generate(req: GenerateRequest): Promise<GenerateResult> {
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        signal: req.signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: req.temperature ?? 0.3,
          max_tokens: Math.min(req.maxOutputTokens ?? 8192, limits.maxOutputTokens ?? Infinity),
          ...(req.json ? { response_format: { type: "json_object" } } : {}),
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.prompt },
          ],
        }),
      });
      if (!res.ok) throw await errorFromResponse(name, res);
      const body = await res.json();
      const text: string = body?.choices?.[0]?.message?.content ?? "";
      if (!text) throw new ProviderError(`${name} returned no text`, null, false);
      return {
        text,
        inputTokens: body?.usage?.prompt_tokens ?? null,
        outputTokens: body?.usage?.completion_tokens ?? null,
      };
    },
  };
}
