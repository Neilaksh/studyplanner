import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, RotateCcw, Trophy, XCircle } from "lucide-react";
import { Markdown } from "../components/Markdown";
import { PageBody } from "../components/ui";
import { useQuiz, useSaveAttempt } from "../lib/quizzes";
import { navigate } from "../router";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function QuizPlayer({ quizId }: { quizId: string }) {
  const quiz = useQuiz(quizId);
  const save = useSaveAttempt();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [finished, setFinished] = useState(false);
  const startedAt = useRef(new Date());

  const questions = quiz.data?.questions ?? [];
  const q = questions[index];
  const chosen = answers[index] ?? null;
  const revealed = chosen !== null;
  const correctCount = questions.filter((qq, i) => answers[i] === qq.correct_index).length;
  const score = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;

  useEffect(() => {
    setAnswers(Array(questions.length).fill(null));
  }, [questions.length]);

  function finish() {
    setFinished(true);
    if (quiz.data) {
      save.mutate({ quizId, documentId: quiz.data.document_id, answers, score, startedAt: startedAt.current });
    }
  }

  function restart() {
    setAnswers(Array(questions.length).fill(null));
    setIndex(0);
    setFinished(false);
    save.reset();
    startedAt.current = new Date();
  }

  const back = (
    <button onClick={() => navigate("/quiz-history")} className="mb-6 flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
      <ArrowLeft className="size-4" /> Quiz History
    </button>
  );

  if (quiz.isPending) {
    return (
      <PageBody>
        <div className="grid h-64 place-items-center text-neutral-400">
          <Loader2 className="size-6 animate-spin" aria-label="Loading quiz" />
        </div>
      </PageBody>
    );
  }
  if (quiz.isError || questions.length === 0) {
    return (
      <PageBody>
        {back}
        <p role="alert" className="text-red-500">
          {quiz.isError ? quiz.error.message : "This quiz has no usable questions."}
        </p>
      </PageBody>
    );
  }

  const meta = [quiz.data.document_title, quiz.data.chapter_title].filter(Boolean).join(" · ");

  if (finished) {
    return (
      <PageBody>
        {back}
        <section className="dot-card mx-auto max-w-3xl p-8 text-center">
          <span className="dots" />
          <Trophy className={`mx-auto size-10 ${score >= 70 ? "text-amber-500" : "text-neutral-400"}`} />
          <h1 className="mt-4 text-2xl font-bold">{quiz.data.title}</h1>
          <p className={`mt-3 text-5xl font-bold ${score >= 70 ? "text-green-600" : score >= 50 ? "text-amber-500" : "text-red-500"}`}>{score}%</p>
          <p className="mt-2 text-neutral-500">
            {correctCount} of {questions.length} correct
          </p>
          <p className="mt-2 text-sm" role="status">
            {save.isPending ? "Saving your result…" : save.isError ? <span className="text-red-500">Couldn't save this attempt: {save.error.message}</span> : save.isSuccess ? "Saved to Quiz History." : null}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <button onClick={restart} className="btn-secondary flex items-center gap-2 rounded-[2px] px-4 py-2 text-sm font-medium">
              <RotateCcw className="size-4" /> Retake
            </button>
            <button onClick={() => navigate("/quiz-history")} className="btn-primary rounded-[2px] px-4 py-2 text-sm font-medium">
              Done
            </button>
          </div>
        </section>

        <h2 className="mx-auto mt-8 max-w-3xl text-lg font-bold">Review</h2>
        <ol className="mx-auto mt-3 max-w-3xl space-y-3">
          {questions.map((qq, i) => {
            const right = answers[i] === qq.correct_index;
            return (
              <li key={qq.id} className="dot-card p-5">
                <span className="dots" />
                <p className="flex gap-2 font-medium">
                  {right ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-600" /> : <XCircle className="mt-0.5 size-5 shrink-0 text-red-500" />}
                  {i + 1}. {qq.prompt}
                </p>
                <p className="mt-2 text-sm">
                  Correct: <strong>{qq.choices[qq.correct_index]}</strong>
                  {!right && answers[i] !== null && <span className="text-red-500"> · You chose: {qq.choices[answers[i]!]}</span>}
                </p>
                {qq.explanation && (
                  <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                    <Markdown text={qq.explanation} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </PageBody>
    );
  }

  const isLast = index === questions.length - 1;
  return (
    <PageBody>
      {back}
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold">{quiz.data.title}</h1>
        {meta && <p className="mt-1 text-neutral-500">{meta}</p>}
        {quiz.data.malformed > 0 && (
          <p className="mt-2 text-sm text-amber-600">{quiz.data.malformed} question(s) were stored in a broken format and are skipped.</p>
        )}

        <div className="mt-6 flex items-center gap-3 text-sm text-neutral-500">
          <span>
            Question {index + 1} of {questions.length}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-[#2e2e33]" aria-hidden>
            <div className="h-full bg-accent-500 transition-[width]" style={{ width: `${((index + (revealed ? 1 : 0)) / questions.length) * 100}%` }} />
          </div>
        </div>

        <section className="dot-card mt-4 p-6">
          <span className="dots" />
          <h2 className="text-lg font-semibold">{q.prompt}</h2>
          <ul className="mt-5 space-y-2" role="radiogroup" aria-label="Answers">
            {q.choices.map((choice, i) => {
              const isCorrect = i === q.correct_index;
              const isChosen = i === chosen;
              const state = !revealed
                ? "border-neutral-200 hover:border-neutral-400 dark:border-[#2e2e33] dark:hover:border-neutral-500"
                : isCorrect
                  ? "border-green-600 bg-green-50 dark:bg-green-950/30"
                  : isChosen
                    ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                    : "border-neutral-200 opacity-60 dark:border-[#2e2e33]";
              return (
                <li key={i}>
                  <button
                    role="radio"
                    aria-checked={isChosen}
                    disabled={revealed}
                    onClick={() => setAnswers((a) => a.map((v, j) => (j === index ? i : v)))}
                    className={`flex w-full items-start gap-3 rounded-[2px] border px-4 py-3 text-left transition-colors ${state}`}
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full border border-current text-xs font-semibold">{LETTERS[i]}</span>
                    <span className="flex-1">{choice}</span>
                    {revealed && isCorrect && <CheckCircle2 className="size-5 shrink-0 text-green-600" />}
                    {revealed && isChosen && !isCorrect && <XCircle className="size-5 shrink-0 text-red-500" />}
                  </button>
                </li>
              );
            })}
          </ul>

          {revealed && (
            <div className="mt-5 rounded-[2px] bg-neutral-50 p-4 text-sm dark:bg-[#26262a]">
              <p className={`font-semibold ${chosen === q.correct_index ? "text-green-600" : "text-red-500"}`}>
                {chosen === q.correct_index ? "Correct!" : "Not quite."}
              </p>
              {q.explanation && <Markdown text={q.explanation} />}
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <button
              disabled={index === 0}
              onClick={() => setIndex((i) => i - 1)}
              className="btn-secondary flex items-center gap-1.5 rounded-[2px] px-4 py-2 text-sm font-medium disabled:opacity-40"
            >
              <ArrowLeft className="size-4" /> Previous
            </button>
            <button
              disabled={!revealed}
              onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
              className="btn-primary flex items-center gap-1.5 rounded-[2px] px-4 py-2 text-sm font-medium disabled:opacity-40"
            >
              {isLast ? "See results" : "Next"} <ArrowRight className="size-4" />
            </button>
          </div>
        </section>
      </div>
    </PageBody>
  );
}
