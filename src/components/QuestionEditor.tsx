import {
  MAX_OPTIONS,
  MAX_OPTION_CHARS,
  MAX_QUESTIONS,
  MAX_QUESTION_CHARS,
  MIN_OPTIONS,
  letterFor,
  type Lang,
  type QuizQuestion,
} from "../quiz/questions";
import { MAX_SECONDS, MIN_SECONDS } from "../quiz/timeline";

type Props = {
  questions: QuizQuestion[];
  lastIsComment: boolean;
  defaultSeconds: number;
  onChange: (next: QuizQuestion[]) => void;
  onAdd: () => void;
  onReset: () => void;
};

const LANG_LABEL: Record<Lang, string> = { en: "English", ar: "العربية" };

export default function QuestionEditor({ questions, lastIsComment, defaultSeconds, onChange, onAdd, onReset }: Props) {
  function patch(index: number, change: Partial<QuizQuestion>) {
    onChange(questions.map((q, i) => (i === index ? { ...q, ...change } : q)));
  }

  function setOption(qi: number, oi: number, lang: Lang, value: string) {
    const q = questions[qi];
    patch(qi, {
      options: q.options.map((option, i) => (i === oi ? { ...option, [lang]: value.slice(0, MAX_OPTION_CHARS) } : option)),
    });
  }

  function removeOption(qi: number, oi: number) {
    const q = questions[qi];
    if (q.options.length <= MIN_OPTIONS) return;

    const correct = q.correct === oi ? 0 : q.correct > oi ? q.correct - 1 : q.correct;
    patch(qi, { options: q.options.filter((_, i) => i !== oi), correct });
  }

  function addOption(qi: number) {
    const q = questions[qi];
    if (q.options.length >= MAX_OPTIONS) return;
    patch(qi, { options: [...q.options, { en: "", ar: "" }] });
  }

  return (
    <div className="questions">
      {questions.map((q, qi) => {
        const isComment = lastIsComment && qi === questions.length - 1;

        return (
          <fieldset key={q.id} className="qcard">
            <legend>
              Question {qi + 1}
              {isComment ? " — viewers answer in the comments" : ""}
            </legend>

            {(["en", "ar"] as const).map((lang) => (
              <div key={lang}>
                <label htmlFor={`q-${q.id}-${lang}`}>{LANG_LABEL[lang]}</label>
                <input
                  id={`q-${q.id}-${lang}`}
                  dir={lang === "ar" ? "rtl" : "ltr"}
                  maxLength={MAX_QUESTION_CHARS}
                  value={q.q[lang]}
                  onChange={(event) => patch(qi, { q: { ...q.q, [lang]: event.target.value } })}
                />
              </div>
            ))}

            <p className="hint">
              Options{isComment ? "" : " (choose the right one with the round button)"}
            </p>
            {q.options.map((option, oi) => (
              <div key={oi} className="optrow">
                <input
                  type="radio"
                  name={`correct-${q.id}`}
                  aria-label={`Option ${letterFor("en", oi)} is correct`}
                  checked={q.correct === oi}
                  disabled={isComment}
                  onChange={() => patch(qi, { correct: oi })}
                />
                <span className="letter">{letterFor("en", oi)}</span>
                <input
                  aria-label={`Option ${letterFor("en", oi)} in English`}
                  maxLength={MAX_OPTION_CHARS}
                  value={option.en}
                  onChange={(event) => setOption(qi, oi, "en", event.target.value)}
                />
                <input
                  aria-label={`Option ${letterFor("en", oi)} in Arabic`}
                  dir="rtl"
                  maxLength={MAX_OPTION_CHARS}
                  value={option.ar}
                  onChange={(event) => setOption(qi, oi, "ar", event.target.value)}
                />
                <button
                  type="button"
                  className="icon"
                  aria-label={`Delete option ${letterFor("en", oi)}`}
                  disabled={q.options.length <= MIN_OPTIONS}
                  onClick={() => removeOption(qi, oi)}
                >
                  ✕
                </button>
              </div>
            ))}

            <div className="qfoot">
              <button type="button" className="ghost small" disabled={q.options.length >= MAX_OPTIONS} onClick={() => addOption(qi)}>
                + Option
              </button>
              <label className="inline-label" htmlFor={`s-${q.id}`}>
                Countdown (s)
              </label>
              <input
                id={`s-${q.id}`}
                className="seconds"
                type="number"
                min={MIN_SECONDS}
                max={MAX_SECONDS}
                placeholder={String(defaultSeconds)}
                value={q.seconds ?? ""}
                onChange={(event) => {
                  const raw = event.target.value;
                  patch(qi, {
                    seconds: raw === "" ? null : Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Number(raw) || MIN_SECONDS)),
                  });
                }}
              />
              <button
                type="button"
                className="icon"
                aria-label={`Delete question ${qi + 1}`}
                disabled={questions.length <= 1}
                onClick={() => onChange(questions.filter((_, i) => i !== qi))}
              >
                Delete question
              </button>
            </div>
          </fieldset>
        );
      })}

      <div className="actions">
        <button type="button" className="ghost" disabled={questions.length >= MAX_QUESTIONS} onClick={onAdd}>
          + Add a question
        </button>
        <button type="button" className="ghost" onClick={onReset}>
          Restore the 5 sample questions
        </button>
      </div>
    </div>
  );
}
