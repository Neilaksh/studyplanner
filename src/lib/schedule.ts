// Builds a study schedule without AI: chapters are spread over the days before the exam, weighted by pages.
// Each chapter gets reading sessions, then a quiz and a summary review on its last day; a final review
// takes the day before the exam. Pure (no I/O, no clock) so it can be tested; dates are local YYYY-MM-DD.

export type ScheduleChapter = { id: string; title: string; pages: number; startPage?: number };

export const TIME_SLOTS = ["morning", "afternoon", "evening", "night"] as const;
export type TimeSlot = (typeof TIME_SLOTS)[number];
export type Activity = "read" | "quiz" | "summary" | "review";
export type Priority = "high" | "medium" | "low";

/** Start of each study window, as HH:MM. */
export const SLOT_START: Record<TimeSlot, string> = { morning: "09:00", afternoon: "14:30", evening: "19:30", night: "22:00" };

export type PlannedSession = {
  chapter_id: string | null;
  title: string;
  scheduled_for: string;
  duration_minutes: number;
  kind: "session";
  activity: Activity;
  priority: Priority;
  time_slot: TimeSlot | null;
  start_time: string | null;
  description: string;
  requirements: string[];
  tips: string[];
};

export type ScheduleResult = { ok: true; sessions: PlannedSession[]; reviewDay: string | null } | { ok: false; error: string };

const REVIEW_MIN_DAYS = 3;
const MIN_SESSION_MINUTES = 10;

const PRIORITY: Record<Activity, Priority> = { read: "high", quiz: "medium", summary: "high", review: "high" };
const REQUIREMENTS: Record<Activity, string[]> = {
  read: ["Read chapter content"],
  quiz: ["Take a quiz on this chapter"],
  summary: ["Review the chapter summary"],
  review: ["Revisit every chapter summary", "Retake quizzes you scored lowest on"],
};
/** Fallback tips; the plan-tips Edge Function replaces them with chapter-specific ones when it can. */
export const DEFAULT_TIPS: Record<Activity, string[]> = {
  read: ["Skim the headings first, then read in detail.", "Pause every 30 minutes and note the key ideas in your own words."],
  quiz: ["Answer without looking at the text first, then check.", "Re-read the explanation for every question you miss."],
  summary: ["Explain the chapter out loud in two minutes.", "List the terms you could not define and look them up."],
  review: ["Start with the chapters you found hardest.", "Finish with a short quiz to check you are exam-ready."],
};

function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** Calendar days from a to b (b - a). */
export function daysBetween(a: string, b: string) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** Splits `total` whole units across weights, every item getting at least `min`; largest-remainder rounding. */
function apportion(weights: number[], total: number, min: number) {
  const base = weights.map(() => min);
  let rest = total - min * weights.length;
  const sum = weights.reduce((s, w) => s + w, 0) || 1;
  const quotas = weights.map((w) => (w / sum) * rest);
  quotas.forEach((q, i) => (base[i] += Math.floor(q)));
  rest -= quotas.reduce((s, q) => s + Math.floor(q), 0);
  const order = quotas.map((q, i) => [q - Math.floor(q), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; k < rest; k++) base[order[k % order.length][1]]++;
  return base;
}

function addMinutes(hhmm: string, minutes: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** A chapter's study time on one day; `last` marks its final day, which also gets the quiz and summary. */
type Block = { chapter: number; day: string; minutes: number; part: number; parts: number; last: boolean };

function blocksFor(chapters: ScheduleChapter[], pages: number[], today: string, studyDays: number, minutesPerDay: number): Block[] {
  const blocks: Block[] = [];
  if (studyDays >= chapters.length) {
    // At least one day per chapter; extra days go to longer chapters.
    const daysPer = apportion(pages, studyDays, 1);
    let day = 0;
    chapters.forEach((_, i) => {
      for (let part = 1; part <= daysPer[i]; part++) {
        blocks.push({ chapter: i, day: addDays(today, day++), minutes: minutesPerDay, part, parts: daysPer[i], last: part === daysPer[i] });
      }
    });
    return blocks;
  }
  // More chapters than days: consecutive chapters share a day, balancing pages per day.
  const total = pages.reduce((s, p) => s + p, 0);
  const target = total / studyDays;
  let day = 0;
  let dayPages = 0;
  const byDay: number[][] = [[]];
  chapters.forEach((_, i) => {
    const remainingChapters = chapters.length - i;
    const remainingDays = studyDays - day;
    if (byDay[day].length > 0 && (dayPages + pages[i] / 2 > target || remainingChapters <= remainingDays - 1) && day < studyDays - 1) {
      day++;
      byDay[day] = [];
      dayPages = 0;
    }
    byDay[day].push(i);
    dayPages += pages[i];
  });
  byDay.forEach((idxs, d) => {
    const dayTotal = idxs.reduce((s, i) => s + pages[i], 0);
    for (const i of idxs) {
      blocks.push({
        chapter: i,
        day: addDays(today, d),
        minutes: Math.max(MIN_SESSION_MINUTES * 3, Math.round((minutesPerDay * pages[i]) / dayTotal)),
        part: 1,
        parts: 1,
        last: true,
      });
    }
  });
  return blocks;
}

export function buildSchedule(input: {
  chapters: ScheduleChapter[];
  today: string;
  examDate: string;
  minutesPerDay: number;
  /** Preferred study windows; sessions on a day take successive windows, rotating day to day. */
  slots?: TimeSlot[];
}): ScheduleResult {
  const { chapters, today, examDate, minutesPerDay } = input;
  const slots = TIME_SLOTS.filter((t) => input.slots?.includes(t));
  if (chapters.length === 0) return { ok: false, error: "Pick at least one chapter." };
  const available = daysBetween(today, examDate); // days before the exam, starting today
  if (available < 1) return { ok: false, error: "The exam date must be after today." };

  const reviewDay = available >= REVIEW_MIN_DAYS ? addDays(examDate, -1) : null;
  const studyDays = reviewDay ? available - 1 : available;
  const pages = chapters.map((c) => Math.max(1, c.pages));
  const blocks = blocksFor(chapters, pages, today, studyDays, minutesPerDay);

  const sessions: PlannedSession[] = [];
  const make = (activity: Activity, s: Omit<PlannedSession, "kind" | "activity" | "priority" | "time_slot" | "start_time" | "requirements" | "tips">): PlannedSession => ({
    ...s,
    kind: "session",
    activity,
    priority: PRIORITY[activity],
    time_slot: null,
    start_time: null,
    requirements: REQUIREMENTS[activity],
    tips: DEFAULT_TIPS[activity],
  });

  for (const b of blocks) {
    const c = chapters[b.chapter];
    const label = `Ch${b.chapter + 1}`;
    // Pages covered by this part of the chapter's reading.
    const first = c.startPage ?? 1;
    const from = first + Math.floor(((b.part - 1) * pages[b.chapter]) / b.parts);
    const to = first + Math.floor((b.part * pages[b.chapter]) / b.parts) - 1;
    const pageText = c.startPage ? `pages ${from}–${Math.max(from, to)} of` : "";
    const readMinutes = b.last ? Math.max(MIN_SESSION_MINUTES, Math.round(b.minutes * 0.5)) : b.minutes;
    sessions.push(
      make("read", {
        chapter_id: c.id,
        title: `${label}: Comprehensive Reading${b.parts > 1 ? ` (part ${b.part} of ${b.parts})` : ""}`,
        scheduled_for: b.day,
        duration_minutes: readMinutes,
        description: `Read ${pageText} "${c.title}" carefully.`.replace("Read  ", "Read "),
      }),
    );
    if (b.last) {
      const quizMinutes = Math.max(MIN_SESSION_MINUTES, Math.round(b.minutes * 0.25));
      sessions.push(
        make("quiz", {
          chapter_id: c.id,
          title: `${label}: Concept Quiz`,
          scheduled_for: b.day,
          duration_minutes: quizMinutes,
          description: `Practice the key questions from "${c.title}" and check your understanding with a quiz.`,
        }),
        make("summary", {
          chapter_id: c.id,
          title: `${label}: Summary Review`,
          scheduled_for: b.day,
          duration_minutes: Math.max(MIN_SESSION_MINUTES, b.minutes - readMinutes - quizMinutes),
          description: `Review the key points of "${c.title}" and summarise them in your own words.`,
        }),
      );
    }
  }

  if (reviewDay) {
    sessions.push(
      make("review", {
        chapter_id: null,
        title: "Final Review: All Chapters",
        scheduled_for: reviewDay,
        duration_minutes: minutesPerDay,
        description: "Revise every chapter in this plan before the exam.",
      }),
    );
  }

  // Time windows: a day's sessions take successive windows (rotating the first one day to day);
  // sessions sharing a window start one after another.
  if (slots.length) {
    let rotate = 0;
    const days = [...new Set(sessions.map((s) => s.scheduled_for))];
    for (const day of days) {
      const todays = sessions.filter((s) => s.scheduled_for === day);
      const used = new Map<TimeSlot, number>();
      todays.forEach((s, k) => {
        const slot = slots[(rotate + Math.min(k, slots.length - 1)) % slots.length];
        const offset = used.get(slot) ?? 0;
        s.time_slot = slot;
        s.start_time = addMinutes(SLOT_START[slot], offset);
        used.set(slot, offset + Math.ceil(s.duration_minutes / 15) * 15);
      });
      rotate++;
    }
  }
  return { ok: true, sessions, reviewDay };
}
