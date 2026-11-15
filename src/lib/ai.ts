// Client side of the AI Edge Functions: one typed caller per function plus chapter/summary queries.
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Database } from "./database.types";

export type ChapterRow = Database["public"]["Tables"]["document_chapters"]["Row"];
export type SummaryRow = Database["public"]["Tables"]["summaries"]["Row"];

/** Calls an Edge Function and turns its `{ error }` body into a readable Error. */
export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  // Send the user's access token explicitly, refreshing it first if it is about to expire.
  let { data: auth } = await supabase.auth.getSession();
  const expiresSoon = !!auth.session?.expires_at && auth.session.expires_at * 1000 < Date.now() + 60_000;
  if (expiresSoon) auth = (await supabase.auth.refreshSession()).data;
  const token = auth.session?.access_token;
  if (!token) throw new Error("You are signed out. Sign in again to use AI features.");

  const { data, error } = await supabase.functions.invoke<T>(name, {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      throw new Error(payload?.error ?? `The ${name} function failed (${error.context.status}).`);
    }
    throw new Error(
      error.message.includes("Failed to send")
        ? `Could not reach the ${name} function. Is it deployed?`
        : error.message,
    );
  }
  return data as T;
}

/** One query definition per document, shared by single- and multi-document views so caches line up. */
const chaptersQuery = (documentId: string) => ({
  queryKey: ["chapters", documentId],
  enabled: !!documentId,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("document_chapters")
      .select("*")
      .eq("document_id", documentId)
      .order("position");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
});

export function useChapters(documentId: string) {
  return useQuery(chaptersQuery(documentId));
}

/** Chapters for several documents, keyed by document id; `pending` is true until all have loaded. */
export function useChaptersFor(documentIds: string[]) {
  return useQueries({
    queries: documentIds.map(chaptersQuery),
    combine: (results) => ({
      byDocument: Object.fromEntries(documentIds.map((id, i) => [id, results[i]?.data ?? []])) as Record<string, ChapterRow[]>,
      pending: results.some((r) => r.isPending),
    }),
  });
}

/** Saved summaries for a document, newest first (one per chapter/language; null chapter = whole document). */
export function useSummaries(documentId: string) {
  return useQuery({
    queryKey: ["summaries", documentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("summaries")
        .select("*")
        .eq("document_id", documentId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export type QuizListItem = {
  id: string;
  title: string;
  chapter_id: string | null;
  created_at: string;
  question_count: number;
};

/** Saved quizzes for a document with their question counts, newest first. */
export function useQuizzes(documentId: string) {
  return useQuery({
    queryKey: ["quizzes", documentId],
    queryFn: async (): Promise<QuizListItem[]> => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, title, chapter_id, created_at, quiz_questions(count)")
        .eq("document_id", documentId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map(({ quiz_questions, ...q }) => ({
        ...q,
        question_count: (quiz_questions as unknown as { count: number }[])[0]?.count ?? 0,
      }));
    },
  });
}

export function useDeleteQuiz(documentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (quizId: string) => {
      const { error } = await supabase.from("quizzes").delete().eq("id", quizId);
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["quizzes", documentId] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useAiActions(documentId: string) {
  const qc = useQueryClient();
  const refreshStats = () => qc.invalidateQueries({ queryKey: ["dashboard"] });

  const extractChapters = useMutation({
    mutationFn: (force: boolean) =>
      callFunction<{ chapters: ChapterRow[]; cached: boolean }>("extract-chapters", { document_id: documentId, force }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chapters", documentId] }),
  });

  const summarize = useMutation({
    mutationFn: (v: { chapterId?: string; force?: boolean }) =>
      callFunction<{ summary: SummaryRow; cached: boolean }>("summarize", {
        document_id: documentId,
        chapter_id: v.chapterId,
        force: v.force,
      }),
    onSuccess: () => {
      void refreshStats();
      void qc.invalidateQueries({ queryKey: ["summaries", documentId] });
    },
  });

  const generateQuiz = useMutation({
    mutationFn: (v: { chapterId?: string; count?: number }) =>
      callFunction<{ quiz_id: string; title: string; question_count: number; source_truncated: boolean }>("generate-quiz", {
        document_id: documentId,
        chapter_id: v.chapterId,
        count: v.count ?? 8,
      }),
    onSuccess: () => {
      void refreshStats();
      void qc.invalidateQueries({ queryKey: ["quizzes", documentId] });
    },
  });

  const explain = useMutation({
    mutationFn: (v: { text: string; page?: number }) =>
      callFunction<{ explanation: string }>("explain", { document_id: documentId, text: v.text, page: v.page }),
    onSuccess: refreshStats,
  });

  return { extractChapters, summarize, generateQuiz, explain };
}
