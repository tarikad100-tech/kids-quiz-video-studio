import type { Bilingual } from "../quiz/questions";
import { hashText } from "../voice/store";
import type { BankItem } from "./types";

type Pair = [en: string, ar: string];

const bi = ([en, ar]: Pair): Bilingual => ({ en, ar });

/**
 * Many questions that share one sentence. Wrong answers are other answers of
 * the same `pool`, so use one pool for answers of the same kind (e.g. "capital").
 * `template` holds "{s}" where the subject goes.
 * rows: [subjectEn, subjectAr, answerEn, answerAr]
 */
export function table(
  cat: string,
  pool: string,
  template: Bilingual,
  rows: [string, string, string, string][],
): BankItem[] {
  return rows.map(([sEn, sAr, aEn, aAr]) => ({
    id: `${cat}:${pool}:${hashText(sEn)}`,
    cat,
    pool,
    q: { en: template.en.replace("{s}", sEn), ar: template.ar.replace("{s}", sAr) },
    answer: { en: aEn, ar: aAr },
  }));
}

/**
 * Hand-written questions with their own wrong answers.
 * rows: [questionEn, questionAr, correct, wrong1, wrong2, wrong3?] where each answer is [en, ar].
 */
export function mcq(cat: string, rows: [string, string, Pair, Pair, Pair, Pair?][]): BankItem[] {
  return rows.map(([qEn, qAr, correct, w1, w2, w3]) => ({
    id: `${cat}:q:${hashText(qEn)}`,
    cat,
    q: { en: qEn, ar: qAr },
    answer: bi(correct),
    wrong: [bi(w1), bi(w2), ...(w3 ? [bi(w3)] : [])],
  }));
}
