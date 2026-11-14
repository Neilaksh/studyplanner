// Remaining mock data for pages not yet backed by Supabase (Study Planner, Quiz History), plus app constants.

export const BRAND = { name: "Lumen" };

export type StudyPlan = { id: string; title: string; exam: string };
export const studyPlans: StudyPlan[] = [];

export type DocStatus = "not-started" | "in-progress" | "completed";
export type Doc = {
  id: string;
  name: string;
  pages: number;
  sizeKb: number;
  uploaded: string; // ISO date
  lastStudied: string | null; // ISO date
  status: DocStatus;
  folderId: string | null;
};
export const documents: Doc[] = [];

export type QuizAttempt = { id: string; pdf: string; chapter: string; score: number; date: string };
export const quizAttempts: QuizAttempt[] = [];

export const outputLanguages = [
  "Use PDF language (default)",
  "English",
  "Spanish",
  "French",
  "German",
  "Hindi",
  "Portuguese",
  "Japanese",
];

