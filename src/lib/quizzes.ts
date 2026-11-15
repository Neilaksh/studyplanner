// Quizzes and attempts: the owner of how quiz rows, questions and attempts are read and written.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type { Database } from "./database.types";

export type QuestionRow = Database["public"]["Tables"]["quiz_questions"]["Row"];

/** A question with its choices parsed from the jsonb column. Malformed rows are reported, not guessed. */
export type Question = Omit<QuestionRow, "choices"> & { choices: string[] };

export type QuizWithQuestions = {
  id: string;
  title: string;
  document_id: string;
  document_title: string | null;
  chapter_title: string | null;
  questions: Question[];
  /** Questions dropped because their stored choices were not a list of strings. */
  malformed: number;
};

export type AttemptRow = {
  id: string;
  quiz_id: string;
  score: number | null;
  completed_at: string | null;
  started_at: string;
  quiz_title: string;
  document_id: string | null;
  document_title: string | null;
  chapter_title: string | null;
};

function unwrap<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

function parseChoices(raw: unknown): string[] | null {
  return Array.isArray(raw) && raw.length >= 2 && raw.every((c) => typeof c === "string") ? (raw as string[]) : null;
}

export function useQuiz(quizId: string) {
  return useQuery({
    queryKey: ["quiz", quizId],
    queryFn: async (): Promise<QuizWithQuestions> => {
      const quiz = unwrap(
        await supabase
          .from("quizzes")
          .select("id, title, document_id, documents(title), document_chapters(title)")
          .eq("id", quizId)
          .maybeSingle(),
      );
      if (!quiz) throw new Error("This quiz no longer exists.");
      const rows = unwrap(await supabase.from("quiz_questions").select("*").eq("quiz_id", quizId).order("position")) ?? [];
      const questions: Question[] = [];
      for (const r of rows) {
        const choices = parseChoices(r.choices);
        if (choices && r.correct_index >= 0 && r.correct_index < choices.length) questions.push({ ...r, choices });
      }
      const doc = quiz.documents as unknown as { title: string } | null;
      const chapter = quiz.document_chapters as unknown as { title: string } | null;
      return {
        id: quiz.id,
        title: quiz.title,
        document_id: quiz.document_id,
        document_title: doc?.title ?? null,
        chapter_title: chapter?.title ?? null,
        questions,
        malformed: rows.length - questions.length,
      };
    },
  });
}

/** Completed attempts, newest first, with the quiz, document and chapter they belong to. */
export function useAttempts() {
  return useQuery({
    queryKey: ["attempts"],
    queryFn: async (): Promise<AttemptRow[]> => {
      const rows =
        unwrap(
          await supabase
            .from("quiz_attempts")
            .select("id, quiz_id, score, started_at, completed_at, quizzes(title, document_id, documents(title), document_chapters(title))")
            .not("completed_at", "is", null)
            .order("completed_at", { ascending: false }),
        ) ?? [];
      return rows.map((r) => {
        const q = r.quizzes as unknown as {
          title: string;
          document_id: string;
          documents: { title: string } | null;
          document_chapters: { title: string } | null;
        } | null;
        return {
          id: r.id,
          quiz_id: r.quiz_id,
          score: r.score,
          started_at: r.started_at,
          completed_at: r.completed_at,
          quiz_title: q?.title ?? "Deleted quiz",
          document_id: q?.document_id ?? null,
          document_title: q?.documents?.title ?? null,
          chapter_title: q?.document_chapters?.title ?? null,
        };
      });
    },
  });
}

export type QuizSummary = { id: string; title: string; document_title: string | null; question_count: number; created_at: string };

/** Every saved quiz with its question count, newest first. */
export function useAllQuizzes() {
  return useQuery({
    queryKey: ["quizzes", "all"],
    queryFn: async (): Promise<QuizSummary[]> => {
      const rows =
        unwrap(
          await supabase
            .from("quizzes")
            .select("id, title, created_at, documents(title), quiz_questions(count)")
            .order("created_at", { ascending: false }),
        ) ?? [];
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        created_at: r.created_at,
        document_title: (r.documents as unknown as { title: string } | null)?.title ?? null,
        question_count: (r.quiz_questions as unknown as { count: number }[])[0]?.count ?? 0,
      }));
    },
  });
}

/** Saves a finished attempt and logs the study time as activity. */
export function useSaveAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: { quizId: string; documentId: string; answers: (number | null)[]; score: number; startedAt: Date }) => {
      const completedAt = new Date();
      unwrap(
        await supabase.from("quiz_attempts").insert({
          quiz_id: a.quizId,
          answers: a.answers,
          score: a.score,
          started_at: a.startedAt.toISOString(),
          completed_at: completedAt.toISOString(),
        }),
      );
      const minutes = Math.max(1, Math.round((completedAt.getTime() - a.startedAt.getTime()) / 60_000));
      unwrap(await supabase.from("activity_events").insert({ kind: "quiz", document_id: a.documentId, minutes }));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["attempts"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
