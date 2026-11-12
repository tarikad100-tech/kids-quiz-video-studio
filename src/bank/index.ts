import { MAX_OPTION_CHARS, MAX_QUESTION_CHARS } from "../quiz/questions";
import { ANIMALS_ITEMS } from "./animals";
import { BODY_ITEMS } from "./body";
import { CAPITALS_ITEMS } from "./capitals";
import { COMMUNITY_ITEMS } from "./community";
import { FOOD_ITEMS } from "./food";
import { GEOGRAPHY_ITEMS } from "./geography";
import { HISTORY_ITEMS } from "./history";
import { MATH_ITEMS } from "./math";
import { NATURE_ITEMS } from "./nature";
import { SCIENCE_ITEMS } from "./science";
import { SHAPES_ITEMS } from "./shapes";
import { SPACE_ITEMS } from "./space";
import { TIME_ITEMS } from "./time";
import type { BankItem } from "./types";

const RAW: BankItem[] = [
  ...CAPITALS_ITEMS,
  ...GEOGRAPHY_ITEMS,
  ...ANIMALS_ITEMS,
  ...NATURE_ITEMS,
  ...SPACE_ITEMS,
  ...SCIENCE_ITEMS,
  ...BODY_ITEMS,
  ...FOOD_ITEMS,
  ...SHAPES_ITEMS,
  ...TIME_ITEMS,
  ...COMMUNITY_ITEMS,
  ...HISTORY_ITEMS,
  ...MATH_ITEMS,
];

function sound(item: BankItem): boolean {
  const answers = [item.answer, ...(item.wrong ?? [])];

  if (item.q.en.length > MAX_QUESTION_CHARS || item.q.ar.length > MAX_QUESTION_CHARS) return false;
  if (answers.some((a) => !a.en || !a.ar || a.en.length > MAX_OPTION_CHARS || a.ar.length > MAX_OPTION_CHARS)) return false;
  if (new Set(answers.map((a) => a.en.toLowerCase())).size !== answers.length) return false;

  return item.wrong ? item.wrong.length >= 2 : item.pool !== undefined;
}

/** The usable bank: the first copy of every question, and nothing that would not fit the screen. */
export const ALL_ITEMS: BankItem[] = (() => {
  const ids = new Set<string>();
  const texts = new Set<string>();
  const kept: BankItem[] = [];

  for (const item of RAW) {
    const text = item.q.en.trim().toLowerCase();
    if (ids.has(item.id) || texts.has(text) || !sound(item)) continue;

    ids.add(item.id);
    texts.add(text);
    kept.push(item);
  }

  return kept;
})();

export const DROPPED_COUNT = RAW.length - ALL_ITEMS.length;
