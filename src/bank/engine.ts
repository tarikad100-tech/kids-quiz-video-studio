import type { Bilingual, QuizQuestion } from "../quiz/questions";
import { ALL_ITEMS } from "./index";
import type { BankItem } from "./types";

/*
 * Picks random questions from the bank without repeating: ids already used
 * (kept in `used`) are skipped until the chosen categories run out, and only
 * then does the history of those categories start again.
 */

const POOLS = (() => {
  const map = new Map<string, Bilingual[]>();

  for (const item of ALL_ITEMS) {
    if (!item.pool) continue;

    const list = map.get(item.pool) ?? [];
    if (!list.some((a) => a.en === item.answer.en)) list.push(item.answer);
    map.set(item.pool, list);
  }

  return map;
})();

export function countByCategory(): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const item of ALL_ITEMS) counts[item.cat] = (counts[item.cat] ?? 0) + 1;

  return counts;
}

function shuffle<T>(list: T[], rng: () => number): T[] {
  const copy = [...list];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function distractors(item: BankItem, needed: number, rng: () => number): Bilingual[] {
  const taken = new Set<string>([item.answer.en.toLowerCase()]);
  const result: Bilingual[] = [];
  const add = (candidate: Bilingual) => {
    const key = candidate.en.toLowerCase();

    if (result.length < needed && !taken.has(key) && candidate.ar !== item.answer.ar) {
      taken.add(key);
      result.push(candidate);
    }
  };

  shuffle(item.wrong ?? [], rng).forEach(add);

  if (result.length < needed && item.pool) {
    shuffle(POOLS.get(item.pool) ?? [], rng).forEach(add);
  }

  return result;
}

export function toQuestion(item: BankItem, id: number, optionCount: number, rng: () => number): QuizQuestion {
  const wrong = distractors(item, optionCount - 1, rng);
  const options = shuffle([item.answer, ...wrong], rng);

  return {
    id,
    q: { ...item.q },
    options: options.map((o) => ({ ...o })),
    correct: options.findIndex((o) => o.en === item.answer.en),
    seconds: null,
  };
}

export type PickResult = {
  questions: QuizQuestion[];
  /** Bank ids picked now. */
  picked: string[];
  /** True when the history of the chosen categories had to start again. */
  restarted: boolean;
  /** The history to keep after this pick. */
  nextUsed: Set<string>;
};

export function pickQuestions(options: {
  cats: string[];
  count: number;
  optionCount: number;
  used: ReadonlySet<string>;
  firstId: number;
  rng?: () => number;
}): PickResult {
  const rng = options.rng ?? Math.random;
  const chosen = new Set(options.cats);
  const pool = ALL_ITEMS.filter((item) => chosen.has(item.cat));
  const picked: BankItem[] = [];
  let restarted = false;
  let used = options.used;

  const draw = () => {
    const byCat = new Map<string, BankItem[]>();

    for (const item of shuffle(pool, rng)) {
      if (used.has(item.id) || picked.includes(item)) continue;
      byCat.set(item.cat, [...(byCat.get(item.cat) ?? []), item]);
    }

    // Take turns between categories so one video mixes topics.
    const order = shuffle([...byCat.keys()], rng);
    let progress = true;

    while (picked.length < options.count && progress) {
      progress = false;

      for (const cat of order) {
        const next = byCat.get(cat)?.shift();

        if (next) {
          picked.push(next);
          progress = true;
          if (picked.length >= options.count) break;
        }
      }
    }
  };

  draw();

  if (picked.length < options.count && pool.length > 0) {
    restarted = true;
    used = new Set([...used].filter((id) => !pool.some((item) => item.id === id)));
    draw();
  }

  const finalPick = shuffle(picked, rng);
  const nextUsed = new Set(used);
  finalPick.forEach((item) => nextUsed.add(item.id));

  return {
    questions: finalPick.map((item, index) => toQuestion(item, options.firstId + index, options.optionCount, rng)),
    picked: finalPick.map((item) => item.id),
    restarted,
    nextUsed,
  };
}
