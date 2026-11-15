// Request handling shared by every function: CORS, auth, body validation, errors, AI call logging.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.50.0";
import { z } from "npm:zod@3.25.67";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.10.0";
import { type CallRecord, ProviderError } from "./ai/index.ts";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
}

export type Context<B> = {
  body: B;
  userId: string;
  /** Client acting as the caller: every query is limited by row-level security. */
  db: SupabaseClient;
  /** Records AI calls in ai_calls (written with the service role; users can only read their own). */
  record: (r: CallRecord) => void;
  /** Resolves once all recorded AI calls are saved. */
  flushRecords: () => Promise<void>;
};

// The project signs access tokens with asymmetric keys published at this public JWKS endpoint, so the
// signature is checked locally (keys are cached by jose) instead of calling the Auth server per request.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

async function verifyUserToken(supabaseUrl: string, token: string): Promise<string> {
  jwks ??= createRemoteJWKSet(new URL(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`));
  const { payload } = await jwtVerify(token, jwks, { audience: "authenticated" });
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("token has no subject");
  return payload.sub;
}

const env = (k: string) => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`Missing environment variable ${k}`);
  return v;
};

/** Wraps a handler with CORS, sign-in check, body validation and consistent error responses. */
export function handle<S extends z.ZodTypeAny>(feature: string, schema: S, fn: (ctx: Context<z.infer<S>>) => Promise<unknown>) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    if (req.method !== "POST") return json({ error: "Use POST." }, 405);

    const authorization = req.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Sign in required." }, 401);

    const url = env("SUPABASE_URL");
    const db = createClient(url, env("SUPABASE_ANON_KEY"), {
      global: { headers: { authorization } },
      auth: { persistSession: false },
    });
    const token = authorization.slice(7).trim();
    if (token.split(".").length !== 3) {
      // Not a user access token (for example the publishable key sent because the app had no session).
      return json({ error: "Sign in required: the request did not carry a user session token." }, 401);
    }
    let userId: string;
    try {
      userId = await verifyUserToken(url, token);
    } catch (err) {
      console.error("token verification failed", err instanceof Error ? err.message : err);
      return json({ error: "Your session could not be verified. Sign out and back in." }, 401);
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return json({ error: "Request body must be JSON." }, 400);
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
      return json({ error: `Invalid request: ${msg}` }, 400);
    }

    const admin = createClient(url, env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
    const pending: Promise<unknown>[] = [];
    const record = (r: CallRecord) => {
      pending.push(
        Promise.resolve(
          admin.from("ai_calls").insert({
            user_id: userId,
            feature,
            provider: r.provider,
            model: r.model,
            input_tokens: r.inputTokens,
            output_tokens: r.outputTokens,
            duration_ms: r.durationMs,
            ok: r.ok,
            error: r.error,
          }),
        ).then(({ error }) => error && console.error("ai_calls insert failed", error.message)),
      );
    };
    const flushRecords = async () => {
      await Promise.allSettled(pending);
    };

    try {
      const result = await fn({ body: parsed.data, userId, db, record, flushRecords });
      await flushRecords();
      return json(result);
    } catch (err) {
      await flushRecords();
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      if (err instanceof ProviderError) {
        console.error(feature, "provider error", err.message);
        const busy = err.status === 429;
        return json({ error: busy ? err.message : `AI request failed: ${err.message}` }, busy ? 429 : 502);
      }
      console.error(feature, "unexpected error", err);
      return json({ error: "Something went wrong. Try again." }, 500);
    }
  });
}

/** Throws HttpError for a failed Supabase query; returns the data otherwise. */
export function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new HttpError(500, `Could not ${what}: ${res.error.message}`);
  return res.data;
}

/** Like `must` for list queries: a missing result becomes an empty list. */
export function mustList<T>(res: { data: T[] | null; error: { message: string } | null }, what: string): T[] {
  return must(res, what) ?? [];
}
