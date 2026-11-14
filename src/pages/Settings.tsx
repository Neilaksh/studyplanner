import { useEffect, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Info,
  Loader2,
  Lock,
  Mail,
  Settings as SettingsIcon,
  User,
  type LucideIcon,
} from "lucide-react";
import { PageBody, PageHeader } from "../components/ui";
import { outputLanguages } from "../data";
import { displayName, useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

type Section = "profile" | "security" | "preferences";
const SECTIONS: { key: Section; label: string; icon: LucideIcon }[] = [
  { key: "profile", label: "Profile", icon: User },
  { key: "security", label: "Security", icon: Lock },
  { key: "preferences", label: "Preferences", icon: SettingsIcon },
];
const PDF_LANGUAGE = outputLanguages[0];

type Message = { ok: boolean; text: string } | null;

function Card({ id, children }: { id: Section; children: React.ReactNode }) {
  return (
    <section id={`settings-${id}`} className="dot-card scroll-mt-6">
      <span className="dots" />
      {children}
    </section>
  );
}

function CardHeader({ icon: Icon, title, subtitle, tint }: { icon: LucideIcon; title: string; subtitle: string; tint: string }) {
  return (
    <header className="flex items-center gap-4 border-b border-neutral-200 p-6 dark:border-[#2e2e33]">
      <span className={`grid size-10 place-items-center rounded-sm ${tint}`}>
        <Icon className="size-5" />
      </span>
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-neutral-500">{subtitle}</p>
      </div>
    </header>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-2 block font-semibold">{children}</span>;
}

function Status({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <p role="status" className={`text-sm ${message.ok ? "text-green-600" : "text-red-500"}`}>
      {message.text}
    </p>
  );
}

export function Settings() {
  const { user, profile, refreshProfile } = useAuth();
  const [active, setActive] = useState<Section>("profile");

  const savedName = profile?.full_name ?? "";
  const [name, setName] = useState(savedName);
  const [nameBusy, setNameBusy] = useState(false);
  const [nameMessage, setNameMessage] = useState<Message>(null);

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMessage, setPwMessage] = useState<Message>(null);

  const [language, setLanguage] = useState(profile?.output_language ?? PDF_LANGUAGE);
  const [langMessage, setLangMessage] = useState<Message>(null);
  const [howOpen, setHowOpen] = useState(false);

  // Profile loads after the page can mount; sync the form once it arrives.
  useEffect(() => {
    setName(profile?.full_name ?? "");
    setLanguage(profile?.output_language ?? PDF_LANGUAGE);
  }, [profile]);

  const shownName = displayName(profile, user);
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "";

  function jump(s: Section) {
    setActive(s);
    document.getElementById(`settings-${s}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setNameBusy(true);
    setNameMessage(null);
    const { error } = await supabase.from("profiles").update({ full_name: name.trim() || null }).eq("id", user.id);
    setNameBusy(false);
    if (error) return setNameMessage({ ok: false, text: error.message });
    await refreshProfile();
    setNameMessage({ ok: true, text: "Saved." });
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email) return;
    if (!pw.current) return setPwMessage({ ok: false, text: "Enter your current password." });
    if (pw.next.length < 8) return setPwMessage({ ok: false, text: "New password must be at least 8 characters long." });
    if (pw.next !== pw.confirm) return setPwMessage({ ok: false, text: "New passwords do not match." });
    setPwBusy(true);
    setPwMessage(null);
    // Supabase does not require the old password to change it, so confirm it first.
    const check = await supabase.auth.signInWithPassword({ email: user.email, password: pw.current });
    if (check.error) {
      setPwBusy(false);
      return setPwMessage({ ok: false, text: "Current password is incorrect." });
    }
    const { error } = await supabase.auth.updateUser({ password: pw.next });
    setPwBusy(false);
    if (error) return setPwMessage({ ok: false, text: error.message });
    setPw({ current: "", next: "", confirm: "" });
    setPwMessage({ ok: true, text: "Password updated." });
  }

  async function saveLanguage(next: string) {
    if (!user) return;
    setLanguage(next);
    setLangMessage(null);
    const { error } = await supabase
      .from("profiles")
      .update({ output_language: next === PDF_LANGUAGE ? null : next })
      .eq("id", user.id);
    if (error) return setLangMessage({ ok: false, text: error.message });
    await refreshProfile();
    setLangMessage({ ok: true, text: "Saved." });
  }

  return (
    <PageBody>
      <PageHeader title="Account Settings" subtitle="Manage your profile and security preferences" />

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <nav aria-label="Settings navigation" className="dot-card p-4 lg:sticky lg:top-6">
          <span className="dots" />
          <ul className="space-y-1">
            {SECTIONS.map(({ key, label, icon: Icon }) => (
              <li key={key}>
                <button
                  onClick={() => jump(key)}
                  className={`flex w-full items-center gap-3 rounded-[2px] px-4 py-3.5 text-lg font-medium ${
                    active === key
                      ? "bg-neutral-100 dark:bg-accent-500/15 dark:text-accent-500"
                      : "text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  }`}
                >
                  <Icon className="size-5" /> {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">
          <Card id="profile">
            <header className="flex flex-wrap items-center gap-5 border-b border-neutral-200 p-6 dark:border-[#2e2e33]">
              <span className="btn-primary grid size-24 place-items-center rounded-sm text-4xl font-bold" aria-label={`${shownName}'s avatar`}>
                {shownName.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-2xl font-bold">{shownName}</h2>
                <p className="mt-1 truncate text-neutral-500">{user?.email}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <span role="status" aria-label="Signed in with email" className="flex items-center gap-1.5 rounded-[2px] bg-neutral-100 px-2.5 py-1 dark:bg-[#2a2a2e]">
                    <Mail className="size-3.5" /> Email
                  </span>
                  {memberSince && (
                    <span role="status" aria-label={`Member since ${memberSince}`} className="flex items-center gap-1.5 rounded-[2px] bg-neutral-100 px-2.5 py-1 dark:bg-[#2a2a2e]">
                      <CalendarDays className="size-3.5" /> {memberSince}
                    </span>
                  )}
                </div>
              </div>
            </header>
            <form className="space-y-6 p-6" onSubmit={saveName}>
              <label className="block">
                <Label>Email Address</Label>
                <span className="relative block">
                  <input type="email" value={user?.email ?? ""} disabled className="field pr-11 text-neutral-500 disabled:bg-neutral-100 dark:disabled:bg-[#26262a]" />
                  <Lock className="absolute top-1/2 right-4 size-4 -translate-y-1/2 text-neutral-400" />
                </span>
                <span className="mt-2 flex items-center gap-1.5 text-sm text-neutral-500">
                  <Info className="size-3.5" /> Email cannot be changed for security reasons
                </span>
              </label>
              <label className="block">
                <Label>Full Name</Label>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Enter your full name" className="field" />
              </label>
              <div className="flex items-center justify-end gap-4">
                <Status message={nameMessage} />
                <button
                  disabled={nameBusy || name.trim() === savedName}
                  aria-label="Save profile changes"
                  className="btn-primary flex items-center gap-2 rounded-[2px] px-5 py-2.5 font-medium disabled:opacity-50"
                >
                  {nameBusy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save Changes
                </button>
              </div>
            </form>
          </Card>

          <Card id="security">
            <CardHeader icon={Lock} title="Security" subtitle="Change your password" tint="bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" />
            <form className="space-y-6 p-6" onSubmit={updatePassword}>
              <label className="block">
                <Label>Current Password</Label>
                <input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} placeholder="Enter your current password" className="field" />
              </label>
              <label className="block">
                <Label>New Password</Label>
                <input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} placeholder="Enter new password" className="field" />
                <span className="mt-2 block text-sm text-neutral-500">Must be at least 8 characters long</span>
              </label>
              <label className="block">
                <Label>Confirm New Password</Label>
                <input type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} placeholder="Confirm your new password" className="field" />
              </label>
              <div className="flex items-center justify-end gap-4">
                <Status message={pwMessage} />
                <button disabled={pwBusy} className="btn-primary flex items-center gap-2 rounded-[2px] px-5 py-2.5 font-medium disabled:opacity-50">
                  {pwBusy && <Loader2 className="size-4 animate-spin" />} Update Password
                </button>
              </div>
            </form>
          </Card>

          <Card id="preferences">
            <CardHeader icon={SettingsIcon} title="Preferences" subtitle="Customize your learning experience" tint="bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400" />
            <div className="space-y-4 p-6">
              <label className="block">
                <span className="mb-2 flex items-center justify-between font-semibold">
                  Output Language <Status message={langMessage} />
                </span>
                <select value={language} onChange={(e) => void saveLanguage(e.target.value)} className="field">
                  {outputLanguages.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
              <p className="text-sm text-neutral-500">
                Choose your preferred language for AI-generated content (quizzes, summaries, explanations, study cards). By default,
                content is generated in the same language as your PDF.
              </p>
              <div className="rounded-sm bg-neutral-50 p-4 dark:bg-[#232327]">
                <button onClick={() => setHowOpen((o) => !o)} aria-expanded={howOpen} className="flex w-full items-center justify-between text-sm font-semibold">
                  How does this work?
                  <ChevronDown className={`size-4 transition-transform ${howOpen ? "rotate-180" : ""}`} />
                </button>
                {howOpen && (
                  <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
                    <li>If you select a language, all AI-generated content will be in that language</li>
                    <li>If you choose "Use PDF language", content will match your document's language</li>
                    <li>This applies to quizzes, summaries, explanations, chapter names, and study cards</li>
                  </ul>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </PageBody>
  );
}
