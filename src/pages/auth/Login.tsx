import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { navigate } from "../../router";
import { AuthLayout, FormError } from "./AuthLayout";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setError(error.message === "Invalid login credentials" ? "Incorrect email or password." : error.message);
      return;
    }
    try {
      sessionStorage.setItem("welcome", "1");
    } catch {
      /* storage unavailable */
    }
    navigate("/dashboard", { replace: true });
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue learning">
      <form onSubmit={submit} className="space-y-5">
        <FormError message={error} />
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Email Address</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. name@company.com"
            className="field"
          />
        </label>
        <label className="block">
          <span className="mb-2 flex items-center justify-between text-sm font-semibold">
            Password
            <a
              href="/forgot-password"
              onClick={(e) => {
                e.preventDefault();
                navigate("/forgot-password");
              }}
              className="font-medium text-accent-500 hover:underline"
            >
              Forgot?
            </a>
          </span>
          <span className="relative block">
            <input
              type={show ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="field pr-11"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </span>
        </label>
        <button
          disabled={busy}
          className="btn-primary flex h-12 w-full items-center justify-center gap-2 rounded-[2px] font-medium disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Sign in {!busy && <ArrowRight className="size-4" />}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-neutral-500">
        Don't have an account?{" "}
        <a
          href="/register"
          onClick={(e) => {
            e.preventDefault();
            navigate("/register");
          }}
          className="font-semibold text-accent-500 hover:underline"
        >
          Create free account
        </a>
      </p>
    </AuthLayout>
  );
}
