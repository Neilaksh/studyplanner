import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { motion } from "motion/react";
import { supabase } from "../../lib/supabase";
import { navigate } from "../../router";
import { AuthLayout, FormError } from "./AuthLayout";

const MIN_PASSWORD = 8;

export function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) return setError(`Password must be at least ${MIN_PASSWORD} characters long.`);
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    const address = email.trim();
    const { data, error } = await supabase.auth.signUp({
      email: address,
      password,
      options: {
        // Saved on the profile by the on_auth_user_created trigger.
        data: { full_name: name.trim() || undefined },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      // Email confirmation is off: the account is ready and signed in.
      try {
        sessionStorage.setItem("welcome", "1");
      } catch {
        /* storage unavailable */
      }
      navigate("/dashboard", { replace: true });
      return;
    }
    // Confirmation required. Supabase answers the same way for an address that already has an account,
    // so the message does not reveal which emails are registered.
    setSentTo(address);
  }

  const toLogin = (
    <p className="mt-6 text-center text-sm text-neutral-500">
      Already have an account?{" "}
      <a
        href="/login"
        onClick={(e) => {
          e.preventDefault();
          navigate("/login");
        }}
        className="font-semibold text-accent-500 hover:underline"
      >
        Sign in
      </a>
    </p>
  );

  if (sentTo) {
    return (
      <AuthLayout title="Check your email" subtitle="One last step to activate your account">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1, transition: { type: "spring", stiffness: 400, damping: 20, delay: 0.1 } }}
            className="mx-auto grid size-16 place-items-center rounded-full bg-green-50 text-green-600 dark:bg-green-500/15"
          >
            <MailCheck className="size-8" />
          </motion.span>
          <p className="mt-5" role="status">
            If <strong>{sentTo}</strong> can be used for a new account, we've sent a confirmation link to it. Open the link to finish signing up.
          </p>
          <p className="mt-3 text-sm text-neutral-500">Not there? Check your spam folder, or try again in a few minutes.</p>
        </motion.div>
        {toLogin}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account" subtitle="Start studying smarter in under a minute">
      <form onSubmit={submit} className="space-y-4">
        <FormError message={error} />
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Full Name</span>
          <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Your name" className="field" />
        </label>
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
          <span className="mb-2 block text-sm font-semibold">Password</span>
          <span className="relative block">
            <input
              type={show ? "text" : "password"}
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
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
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Confirm Password</span>
          <input
            type={show ? "text" : "password"}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat your password"
            className="field"
          />
        </label>
        <button disabled={busy} className="btn-primary flex h-12 w-full items-center justify-center gap-2 rounded-[2px] font-medium disabled:opacity-60">
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Create account {!busy && <ArrowRight className="size-4" />}
        </button>
      </form>
      {toLogin}
    </AuthLayout>
  );
}
