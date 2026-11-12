// Usage: node tools/check-bank.mjs src/bank/animals.ts
// Bundles one bank file with esbuild, then checks every question.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const file = resolve(process.argv[2] ?? "");
const esbuild = "/opt/npm-tools/node_modules/.bin/esbuild";
const dir = mkdtempSync(join(tmpdir(), "bankcheck-"));
const out = join(dir, "bank.mjs");
execFileSync(esbuild, [file, "--bundle", "--format=esm", `--outfile=${out}`, "--log-level=error"]);
const mod = await import(pathToFileURL(out).href);
const items = Object.values(mod).flat().filter((x) => x && typeof x === "object" && "q" in x);

const problems = [];
const ids = new Set();
const texts = new Set();
const pools = new Map();
const arabic = /[؀-ۿ]/;
const latinOnlyAr = /^[A-Za-z]/;

for (const item of items) {
  const where = `${item.id} "${item.q?.en}"`;
  if (ids.has(item.id)) problems.push(`duplicate id: ${where}`);
  ids.add(item.id);
  if (texts.has(item.q.en)) problems.push(`duplicate question: ${where}`);
  texts.add(item.q.en);
  if (!item.q.en || !item.q.ar) problems.push(`missing question text: ${where}`);
  if (!item.answer.en || !item.answer.ar) problems.push(`missing answer: ${where}`);
  if (item.q.en.length > 110) problems.push(`English question too long (${item.q.en.length}): ${where}`);
  if (item.q.ar.length > 110) problems.push(`Arabic question too long (${item.q.ar.length}): ${where}`);
  if (item.answer.en.length > 38 || item.answer.ar.length > 38) problems.push(`answer too long: ${where}`);
  if (item.cat !== "math" && !arabic.test(item.q.ar)) problems.push(`Arabic question looks wrong: ${where}`);
  if (item.cat !== "math" && !/^[A-Za-z0-9 .\-]+$/.test(item.answer.ar) && !arabic.test(item.answer.ar)) problems.push(`Arabic answer has no Arabic letters: ${where}`);
  if (item.wrong) {
    if (item.wrong.length < 2) problems.push(`needs 2+ wrong answers: ${where}`);
    const all = [item.answer, ...item.wrong];
    if (new Set(all.map((a) => a.en.toLowerCase())).size !== all.length) problems.push(`repeated answers: ${where}`);
    if (new Set(all.map((a) => a.ar)).size !== all.length) problems.push(`repeated Arabic answers: ${where}`);
    if (all.some((a) => !a.en || !a.ar || a.en.length > 38 || a.ar.length > 38)) problems.push(`bad wrong answer: ${where}`);
  } else if (item.pool) {
    const set = pools.get(item.pool) ?? new Set();
    set.add(item.answer.en);
    pools.set(item.pool, set);
  } else {
    problems.push(`no wrong answers and no pool: ${where}`);
  }
}

for (const [pool, set] of pools) if (set.size < 6) problems.push(`pool "${pool}" has only ${set.size} distinct answers (need 6+)`);

console.log(`${items.length} questions checked, ${problems.length} problem(s).`);
for (const p of problems.slice(0, 60)) console.log(" -", p);
process.exit(problems.length ? 1 : 0);
