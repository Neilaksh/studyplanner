import { Logo } from "../../components/Logo";
import { BRAND } from "../../data";

const FEATURES = [
  { emoji: "🎯", title: "Smart Quizzes", body: "AI-generated from PDFs" },
  { emoji: "⚡", title: "Instant Summaries", body: "Key points extracted" },
  { emoji: "💡", title: "AI Explanations", body: "Understand anything" },
  { emoji: "📊", title: "Track Progress", body: "Monitor improvement" },
];

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main id="main-content" className="grid min-h-full bg-[#faf9f8] lg:grid-cols-2 dark:bg-[#232327]">
      <section className="hidden flex-col justify-center gap-10 border-r border-neutral-200 bg-white px-16 lg:flex dark:border-[#2e2e33] dark:bg-[#1c1c1f]">
        <Logo />
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Welcome back to {BRAND.name}</h1>
          <p className="mt-3 text-lg text-neutral-500">Continue your learning journey with AI-powered study tools</p>
        </div>
        <ul className="grid grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <li key={f.title} className="dot-card p-5">
              <span className="dots" />
              <span className="text-2xl" aria-hidden>
                {f.emoji}
              </span>
              <p className="mt-2 font-semibold">{f.title}</p>
              <p className="text-sm text-neutral-500">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <div className="dot-card p-8">
            <span className="dots" />
            <h2 className="text-2xl font-bold">{title}</h2>
            <p className="mt-1 text-neutral-500">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>
          <p className="mt-6 text-center text-sm text-neutral-500">🔒 Secure login · ⚡ Instant access</p>
        </div>
      </section>
    </main>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-[2px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
      {message}
    </p>
  );
}
