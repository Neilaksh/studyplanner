// Run with: deno test src/lib/schedule.test.ts
import { buildSchedule, daysBetween, type ScheduleChapter } from "./schedule.ts";

const ch = (n: number, pages: number, startPage?: number): ScheduleChapter => ({ id: `c${n}`, title: `Chapter ${n}`, pages, startPage });
const expect = (cond: boolean, msg: string) => {
  if (!cond) throw new Error(msg);
};

Deno.test("each chapter: reading on its days, then quiz + summary on its last day; final review day", () => {
  const r = buildSchedule({ chapters: [ch(1, 10), ch(2, 30), ch(3, 10)], today: "2026-11-15", examDate: "2026-11-25", minutesPerDay: 60 });
  if (!r.ok) throw new Error(r.error);
  const reads = r.sessions.filter((s) => s.activity === "read");
  expect(new Set(reads.map((s) => s.scheduled_for)).size === 9, `expected 9 reading days, got ${reads.length}`);
  const per = (id: string) => reads.filter((s) => s.chapter_id === id).length;
  expect(per("c2") > per("c1") && per("c1") >= 1 && per("c3") >= 1, `bad split ${per("c1")}/${per("c2")}/${per("c3")}`);
  for (const id of ["c1", "c2", "c3"]) {
    const lastRead = reads.filter((s) => s.chapter_id === id).at(-1)!;
    const quiz = r.sessions.find((s) => s.chapter_id === id && s.activity === "quiz")!;
    const summary = r.sessions.find((s) => s.chapter_id === id && s.activity === "summary")!;
    expect(quiz.scheduled_for === lastRead.scheduled_for && summary.scheduled_for === lastRead.scheduled_for, `${id} quiz/summary not on last reading day`);
    const day = r.sessions.filter((s) => s.scheduled_for === lastRead.scheduled_for).reduce((n, s) => n + s.duration_minutes, 0);
    expect(day === 60, `${id} last day has ${day} minutes`);
  }
  const review = r.sessions.at(-1)!;
  expect(review.activity === "review" && review.scheduled_for === "2026-11-24" && r.reviewDay === "2026-11-24", "review day wrong");
  expect(r.sessions.every((s) => s.scheduled_for >= "2026-11-15" && s.scheduled_for < "2026-11-25"), "dates outside range");
  expect(r.sessions.map((s) => s.scheduled_for).join() === r.sessions.map((s) => s.scheduled_for).sort().join(), "out of order");
});

Deno.test("priorities, requirements, tips and descriptions are filled", () => {
  const r = buildSchedule({ chapters: [ch(1, 24, 101)], today: "2026-11-15", examDate: "2026-11-18", minutesPerDay: 120 });
  if (!r.ok) throw new Error(r.error);
  const by = (a: string) => r.sessions.find((s) => s.activity === a)!;
  expect(by("read").priority === "high" && by("quiz").priority === "medium" && by("summary").priority === "high", "priorities");
  expect(r.sessions.every((s) => s.requirements.length > 0 && s.tips.length === 2 && s.description.length > 10), "details missing");
  // 3 days → 2 study days + review, so the 24-page chapter is read in two parts.
  const reads = r.sessions.filter((s) => s.activity === "read").map((s) => s.description);
  expect(reads.length === 2 && reads[0].includes("pages 101–112") && reads[1].includes("pages 113–124"), reads.join(" | "));
});

Deno.test("fewer days than chapters: chapters share days, every chapter keeps quiz + summary", () => {
  const chapters = Array.from({ length: 7 }, (_, i) => ch(i + 1, 10 + i * 5));
  const r = buildSchedule({ chapters, today: "2026-11-15", examDate: "2026-11-18", minutesPerDay: 90 });
  if (!r.ok) throw new Error(r.error);
  const studyDays = [...new Set(r.sessions.filter((s) => s.activity !== "review").map((s) => s.scheduled_for))];
  expect(studyDays.join() === "2026-11-15,2026-11-16", `study days ${studyDays}`);
  for (const c of chapters) {
    const kinds = r.sessions.filter((s) => s.chapter_id === c.id).map((s) => s.activity).join();
    expect(kinds === "read,quiz,summary", `${c.id}: ${kinds}`);
  }
});

Deno.test("exam tomorrow: everything today, no review day", () => {
  const r = buildSchedule({ chapters: [ch(1, 5), ch(2, 5)], today: "2026-11-15", examDate: "2026-11-16", minutesPerDay: 60 });
  if (!r.ok) throw new Error(r.error);
  expect(r.reviewDay === null && r.sessions.every((s) => s.scheduled_for === "2026-11-15"), JSON.stringify(r.sessions));
});

Deno.test("rejects exam today/past and no chapters", () => {
  expect(!buildSchedule({ chapters: [ch(1, 5)], today: "2026-11-15", examDate: "2026-11-15", minutesPerDay: 60 }).ok, "allowed exam today");
  expect(!buildSchedule({ chapters: [], today: "2026-11-15", examDate: "2026-12-01", minutesPerDay: 60 }).ok, "allowed no chapters");
});

Deno.test("month and DST boundaries count calendar days", () => {
  expect(daysBetween("2026-10-30", "2026-11-02") === 3, "month boundary");
  expect(daysBetween("2026-03-28", "2026-03-30") === 2, "DST boundary");
  const r = buildSchedule({ chapters: [ch(1, 5)], today: "2026-12-30", examDate: "2027-01-03", minutesPerDay: 30 });
  if (!r.ok) throw new Error(r.error);
  const days = [...new Set(r.sessions.map((s) => s.scheduled_for))].join();
  expect(days === "2026-12-30,2026-12-31,2027-01-01,2027-01-02", days);
});

Deno.test("time slots and start times: a day's sessions take successive windows; shared windows stack", () => {
  const r = buildSchedule({ chapters: [ch(1, 10)], today: "2026-11-15", examDate: "2026-11-16", minutesPerDay: 120, slots: ["evening", "afternoon"] });
  if (!r.ok) throw new Error(r.error);
  // read 60 min, quiz 30, summary 30 on one day with two windows (afternoon first: day order, not pick order).
  const got = r.sessions.map((s) => `${s.activity}@${s.time_slot}@${s.start_time}`).join();
  expect(got === "read@afternoon@14:30,quiz@evening@19:30,summary@evening@20:00", got);
  const none = buildSchedule({ chapters: [ch(1, 10)], today: "2026-11-15", examDate: "2026-11-17", minutesPerDay: 60 });
  expect(none.ok && none.sessions.every((s) => s.time_slot === null && s.start_time === null), "times set without preference");
});
