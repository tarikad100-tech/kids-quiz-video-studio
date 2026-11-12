/*
 * Quiz data. Every question has an English and an Arabic version, so the same
 * video can show and read either language (or both).
 */

export type Lang = "en" | "ar";
export type Bilingual = { en: string; ar: string };

export type QuizQuestion = {
  id: number;
  q: Bilingual;
  options: Bilingual[];
  /** Index of the right option. */
  correct: number;
  /** Own countdown for this question; null = use the video's default. */
  seconds: number | null;
};

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 4;
export const MIN_QUESTIONS = 1;
export const MAX_QUESTIONS = 10;
export const MAX_QUESTION_CHARS = 120;
export const MAX_OPTION_CHARS = 40;

export type ShowLang = "English" | "Arabic" | "Both";
export const SHOW_LANGS: readonly ShowLang[] = ["English", "Arabic", "Both"];

export type VoiceLang = "None" | "English" | "Arabic" | "Both";
export const VOICE_LANGS: readonly VoiceLang[] = ["None", "English", "Arabic", "Both"];

export function isShowLang(value: unknown): value is ShowLang {
  return SHOW_LANGS.some((item) => item === value);
}

export function isVoiceLang(value: unknown): value is VoiceLang {
  return VOICE_LANGS.some((item) => item === value);
}

/** Languages drawn on the screen, in reading order (English first). */
export function showLangs(show: ShowLang): Lang[] {
  return show === "Both" ? ["en", "ar"] : show === "English" ? ["en"] : ["ar"];
}

export function voiceLangs(voice: VoiceLang): Lang[] {
  return voice === "None" ? [] : voice === "Both" ? ["en", "ar"] : voice === "English" ? ["en"] : ["ar"];
}

/** Options are numbered 1, 2, 3 (4) in both languages. */
export function letterFor(_lang: Lang, index: number): string {
  return String(index + 1);
}

/** The text the narrator reads: the question, then (optionally) the options. */
export function voiceScript(question: QuizQuestion, lang: Lang, readOptions: boolean): string {
  const parts = [question.q[lang].trim()];

  if (readOptions) {
    question.options.forEach((option, index) => {
      parts.push(`${letterFor(lang, index)}: ${option[lang].trim()}.`);
    });
  }

  return parts.filter(Boolean).join(" ");
}

export const SAMPLE_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    q: { en: "Which planet is closest to the Sun?", ar: "أي كوكب هو الأقرب إلى الشمس؟" },
    options: [
      { en: "Venus", ar: "الزهرة" },
      { en: "Mercury", ar: "عطارد" },
      { en: "Mars", ar: "المريخ" },
    ],
    correct: 1,
    seconds: null,
  },
  {
    id: 2,
    q: { en: "How many legs does a spider have?", ar: "كم عدد أرجل العنكبوت؟" },
    options: [
      { en: "6", ar: "٦" },
      { en: "8", ar: "٨" },
      { en: "10", ar: "١٠" },
    ],
    correct: 1,
    seconds: null,
  },
  {
    id: 3,
    q: { en: "What is the largest animal on Earth?", ar: "ما هو أكبر حيوان على الأرض؟" },
    options: [
      { en: "Elephant", ar: "الفيل" },
      { en: "Blue whale", ar: "الحوت الأزرق" },
      { en: "Giraffe", ar: "الزرافة" },
    ],
    correct: 1,
    seconds: null,
  },
  {
    id: 4,
    q: {
      en: "Which color do you get by mixing blue and yellow?",
      ar: "ما اللون الناتج عن خلط الأزرق والأصفر؟",
    },
    options: [
      { en: "Green", ar: "الأخضر" },
      { en: "Purple", ar: "البنفسجي" },
      { en: "Orange", ar: "البرتقالي" },
    ],
    correct: 0,
    seconds: null,
  },
  {
    id: 5,
    q: {
      en: "Which animal is called the King of the Jungle?",
      ar: "أي حيوان يُلقَّب بملك الغابة؟",
    },
    options: [
      { en: "Lion", ar: "الأسد" },
      { en: "Tiger", ar: "النمر" },
      { en: "Elephant", ar: "الفيل" },
    ],
    correct: 0,
    seconds: null,
  },
];

export function blankQuestion(id: number): QuizQuestion {
  return {
    id,
    q: { en: "", ar: "" },
    options: [
      { en: "", ar: "" },
      { en: "", ar: "" },
      { en: "", ar: "" },
    ],
    correct: 0,
    seconds: null,
  };
}
