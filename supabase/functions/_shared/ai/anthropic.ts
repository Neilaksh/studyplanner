import { type AIProvider, errorFromResponse, type GenerateRequest, type GenerateResult, ProviderError } from "./provider.ts";

export function anthropicProvider(apiKey: string, model: string): AIProvider {
  return {
    name: "anthropic",
    model,
    async generate(req: GenerateRequest): Promise<GenerateResult> {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: req.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: req.maxOutputTokens ?? 8192,
          temperature: req.temperature ?? 0.3,
          system: req.json ? `${req.system}\n\nRespond with a single JSON object and nothing else.` : req.system,
          messages: [{ role: "user", content: req.prompt }],
        }),
      });
      if (!res.ok) throw await errorFromResponse("Anthropic", res);
      const body = await res.json();
      const text: string = (body?.content ?? [])
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("");
      if (!text) throw new ProviderError(`Anthropic returned no text (${body?.stop_reason ?? "no content"})`, null, false);
      return {
        text,
        inputTokens: body?.usage?.input_tokens ?? null,
        outputTokens: body?.usage?.output_tokens ?? null,
      };
    },
  };
}
