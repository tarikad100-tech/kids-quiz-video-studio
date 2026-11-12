import type { Bilingual } from "../quiz/questions";

export type BankCategory = { id: string; en: string; ar: string };

/** One question of the bank. `wrong` = hand-written wrong answers; otherwise they are drawn from `pool`. */
export type BankItem = {
  id: string;
  cat: string;
  q: Bilingual;
  answer: Bilingual;
  wrong?: Bilingual[];
  pool?: string;
};

export const CATEGORIES: BankCategory[] = [
  { id: "capitals", en: "Capitals & countries", ar: "العواصم والدول" },
  { id: "geography", en: "Geography & landmarks", ar: "الجغرافيا والمعالم" },
  { id: "animals", en: "Animals", ar: "الحيوانات" },
  { id: "nature", en: "Nature, plants & weather", ar: "الطبيعة والنباتات والطقس" },
  { id: "space", en: "Space", ar: "الفضاء" },
  { id: "science", en: "Science", ar: "العلوم" },
  { id: "body", en: "Human body & health", ar: "جسم الإنسان والصحة" },
  { id: "food", en: "Food & fruits", ar: "الطعام والفواكه" },
  { id: "shapes", en: "Colors, shapes & numbers", ar: "الألوان والأشكال والأعداد" },
  { id: "time", en: "Time & calendar", ar: "الوقت والتقويم" },
  { id: "community", en: "Jobs, vehicles & community", ar: "المهن والمركبات والمجتمع" },
  { id: "history", en: "Inventions & history", ar: "اختراعات وتاريخ" },
  { id: "math", en: "Math", ar: "الرياضيات" },
];
