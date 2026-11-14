import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { navigate } from "../../router";
import { AuthLayout, FormError } from "./AuthLayout";

const backToLogin = (
  <a
    href="/login"
    onClick={(e) => {
      e.preventDefault();
      navigate("/login");
    }}
    className="mt-6 flex items-center justify-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
  >
    <ArrowLeft className="size-4" /> Back to sign in
  </a>
);

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a link to choose a new one">
      {sent ? (
        <p role="status" className="rounded-[2px] bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950/40 dark:text-green-300">
          If an account exists for {email.trim()}, a reset link is on its way. Open it on this device.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <FormError message={error} />
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Email Address</span>
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. name@company.com" className="field" />
          </label>
          <button disabled={busy} className="btn-primary flex h-12 w-full items-center justify-center gap-2 rounded-[2px] font-medium disabled:opacity-60">
            {busy && <Loader2 className="size-4 animate-spin" />} Send reset link
          </button>
        </form>
      )}
      {backToLogin}
    </AuthLayout>
  );
}

export function ResetPassword() {
  const { session, recovering, finishRecovery } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Password must be at least 8 characters long.");
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    finishRecovery();
    navigate("/dashboard", { replace: true });
  }

  if (!session && !recovering) {
    return (
      <AuthLayout title="Link expired" subtitle="This reset link is invalid or has already been used">
        <button onClick={() => navigate("/forgot-password")} className="btn-primary h-12 w-full rounded-[2px] font-medium">
          Request a new link
        </button>
        {backToLogin}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="Must be at least 8 characters long">
      <form onSubmit={submit} className="space-y-5">
        <FormError message={error} />
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">New Password</span>
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter new password" className="field" />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Confirm New Password</span>
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm your new password" className="field" />
        </label>
        <button disabled={busy} className="btn-primary flex h-12 w-full items-center justify-center gap-2 rounded-[2px] font-medium disabled:opacity-60">
          {busy && <Loader2 className="size-4 animate-spin" />} Update password
        </button>
      </form>
    </AuthLayout>
  );
}
