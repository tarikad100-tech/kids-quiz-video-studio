import type { BankItem } from "./types";

/*
 * Math facts are made by code (so they cannot be wrong): the times tables,
 * addition and subtraction within 100 (a sample), and simple division.
 */

const items: BankItem[] = [];

function numberItem(id: string, en: string, answer: number, wrong: number[]): BankItem {
  return {
    id: `math:${id}`,
    cat: "math",
    q: { en, ar: en },
    answer: { en: String(answer), ar: String(answer) },
    wrong: wrong.map((value) => ({ en: String(value), ar: String(value) })),
  };
}

function near(answer: number, offsets: number[]): number[] {
  return offsets.map((o) => answer + o).filter((v) => v > 0 && v !== answer);
}

for (let a = 2; a <= 10; a++) {
  for (let b = 2; b <= 10; b++) {
    const answer = a * b;
    const wrong = [...new Set([...near(answer, [a, -a, b, -b, 1, -1, 10, -10]), (a + 1) * b, a * (b + 1)])].filter(
      (v) => v !== answer,
    );
    items.push(numberItem(`mul-${a}x${b}`, `${a} × ${b} = ?`, answer, wrong.slice(0, 4)));
  }
}

for (let a = 6; a <= 19; a++) {
  for (const b of [7, 8, 9, 14, 15, 16, 25, 36, 47]) {
    const answer = a + b;
    items.push(numberItem(`add-${a}+${b}`, `${a} + ${b} = ?`, answer, near(answer, [1, -1, 10, -10, 2, -2])));
  }
}

for (let a = 21; a <= 40; a += 2) {
  for (const b of [6, 8, 9, 13, 17]) {
    const answer = a - b;
    items.push(numberItem(`sub-${a}-${b}`, `${a} − ${b} = ?`, answer, near(answer, [1, -1, 10, -10, 2, -2])));
  }
}

for (let d = 2; d <= 10; d++) {
  for (let q = 2; q <= 10; q++) {
    items.push(numberItem(`div-${d * q}/${d}`, `${d * q} ÷ ${d} = ?`, q, near(q, [1, -1, 2, -2, 3])));
  }
}

export const MATH_ITEMS: BankItem[] = items;
