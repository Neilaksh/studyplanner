// Mock data standing in for the original app's backend. Replace these with real API calls.

export const BRAND = { name: "Lumen" };

export const stats = {
  documents: 0,
  quizzes: 0,
  questions: 0,
  avgScore: null as number | null,
  studyMinutes: 0,
};

// ISO dates (YYYY-MM-DD) with a count of study events on that day.
export const activity: Record<string, number> = {
  "2026-11-08": 3,
  "2026-11-14": 2,
};

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
export const recentDocuments = documents.slice(0, 5);

export type Folder = { id: string; name: string };
export const folders: Folder[] = [];

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

export type Session = { id: string; title: string; date: string; kind: "session" | "exam" };
export const sessions: Session[] = [];
