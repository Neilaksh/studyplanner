// The one interface every AI provider implements. Functions never talk to a vendor API directly.

export type GenerateRequest = {
  system: string;
  prompt: string;
  /** Ask the provider for a JSON object. The caller still validates the shape. */
  json: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  /** Aborts the HTTP request when the call runs out of time. */
  signal?: AbortSignal;
  /**
   * Rebuilds the prompt to fit within maxChars (e.g. by cutting source text at a page boundary). Used for
   * providers with small request limits; without it, such providers are skipped for oversized prompts.
   */
  shrink?: (maxChars: number) => string;
};

export type GenerateResult = {
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  /** Largest system + prompt size this provider accepts (free-tier token-per-minute limits). */
  readonly maxPromptChars?: number;
  generate(req: GenerateRequest): Promise<GenerateResult>;
}

/** A provider failure. `retryable` covers rate limits and transient server errors. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly retryable: boolean,
    readonly retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** Turns a non-OK vendor response into a ProviderError without leaking request details. */
export async function errorFromResponse(provider: string, res: Response): Promise<ProviderError> {
  let detail = "";
  try {
    const body = await res.text();
    const parsed = JSON.parse(body);
    detail = parsed?.error?.message ?? parsed?.message ?? body.slice(0, 300);
  } catch {
    /* body unavailable */
  }
  const retryAfter = Number(res.headers.get("retry-after"));
  const retryable = res.status === 429 || res.status >= 500;
  return new ProviderError(
    `${provider} returned ${res.status}${detail ? `: ${detail}` : ""}`,
    res.status,
    retryable,
    Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : null,
  );
}
