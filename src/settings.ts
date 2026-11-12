import { CATEGORIES } from "./bank/types";
import { isMusicTrackId, type MusicTrackId } from "./audio/music";
import { isBackgroundPreset, type BackgroundPreset } from "./quiz/background";
import { MAX_BADGE_NAME, isBadgePosition, type BadgePosition } from "./quiz/badge";
import {
  MAX_OPTIONS,
  MAX_OPTION_CHARS,
  MAX_QUESTIONS,
  MAX_QUESTION_CHARS,
  MIN_OPTIONS,
  MIN_QUESTIONS,
  SAMPLE_QUESTIONS,
  type QuizQuestion,
} from "./quiz/questions";
import { MAX_SECONDS, MIN_SECONDS } from "./quiz/timeline";
import type { ExportQuality } from "./video/exportVideo";

export type Settings = {
  /** One language per video: everything on screen and the narrator use it. */
  language: "English" | "Arabic";
  narrator: boolean;
  readOptions: boolean;
  seconds: number;
  lastIsComment: boolean;
  intro: boolean;
  /** Categories the random picker draws from. */
  bankCats: string[];
  pickCount: number;
  optionCount: number;
  vertical: boolean;
  quality: ExportQuality;
  background: BackgroundPreset;
  music: MusicTrackId | "none";
  musicVolume: number;
  effects: boolean;
  showMascot: boolean;
  showBadge: boolean;
  badgeName: string;
  badgePosition: BadgePosition;
  titleEn: string;
  titleAr: string;
  outroEn: string;
  outroAr: string;
  commentEn: string;
  commentAr: string;
  voiceEn: string;
  voiceAr: string;
};

export const DEFAULT_SETTINGS: Settings = {
  language: "English",
  narrator: true,
  readOptions: true,
  seconds: 8,
  lastIsComment: true,
  intro: false,
  bankCats: CATEGORIES.map((c) => c.id),
  pickCount: 5,
  optionCount: 3,
  vertical: true,
  quality: "720p",
  background: "meadow",
  music: "bouncy",
  musicVolume: 0.3,
  effects: true,
  showMascot: true,
  showBadge: true,
  badgeName: "Story & Info",
  badgePosition: "top-left",
  titleEn: "",
  titleAr: "",
  outroEn: "",
  outroAr: "",
  commentEn: "",
  commentAr: "",
  voiceEn: "",
  voiceAr: "",
};

function num(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function text(value: unknown, max: number, fallback: string): string {
  return typeof value === "string" ? value.slice(0, max) : fallback;
}

export function parseSettings(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  if (typeof raw !== "object" || raw === null) return d;

  const r = raw as Record<string, unknown>;

  return {
    language: r.language === "Arabic" || (r.language === undefined && r.show === "Arabic") ? "Arabic" : "English",
    narrator: typeof r.narrator === "boolean" ? r.narrator : r.voice !== "None",
    readOptions: bool(r.readOptions, d.readOptions),
    seconds: num(r.seconds, MIN_SECONDS, MAX_SECONDS, d.seconds),
    lastIsComment: bool(r.lastIsComment, d.lastIsComment),
    intro: bool(r.intro, d.intro),
    bankCats: Array.isArray(r.bankCats) ? r.bankCats.filter((c): c is string => CATEGORIES.some((k) => k.id === c)) : d.bankCats,
    pickCount: num(r.pickCount, MIN_QUESTIONS, MAX_QUESTIONS, d.pickCount),
    optionCount: r.optionCount === 4 ? 4 : 3,
    vertical: bool(r.vertical, d.vertical),
    quality: r.quality === "1080p" ? "1080p" : "720p",
    background: isBackgroundPreset(r.background) ? r.background : d.background,
    music: r.music === "none" || isMusicTrackId(r.music) ? r.music : d.music,
    musicVolume: typeof r.musicVolume === "number" ? Math.min(1, Math.max(0, r.musicVolume)) : d.musicVolume,
    effects: bool(r.effects, d.effects),
    showMascot: bool(r.showMascot, d.showMascot),
    showBadge: bool(r.showBadge, d.showBadge),
    badgeName: text(r.badgeName, MAX_BADGE_NAME, d.badgeName),
    badgePosition: isBadgePosition(r.badgePosition) ? r.badgePosition : d.badgePosition,
    titleEn: text(r.titleEn, 60, ""),
    titleAr: text(r.titleAr, 60, ""),
    outroEn: text(r.outroEn, 60, ""),
    outroAr: text(r.outroAr, 60, ""),
    commentEn: text(r.commentEn, 60, ""),
    commentAr: text(r.commentAr, 60, ""),
    voiceEn: text(r.voiceEn, 80, ""),
    voiceAr: text(r.voiceAr, 80, ""),
  };
}

function parseBilingual(raw: unknown, max: number): { en: string; ar: string } {
  const r = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};

  return { en: text(r.en, max, ""), ar: text(r.ar, max, "") };
}

export function parseQuestions(raw: unknown): QuizQuestion[] | null {
  if (!Array.isArray(raw)) return null;

  const list: QuizQuestion[] = [];
  const used = new Set<number>();

  for (const item of raw.slice(0, MAX_QUESTIONS)) {
    if (typeof item !== "object" || item === null) continue;

    const q = item as Record<string, unknown>;
    const options = Array.isArray(q.options)
      ? q.options.slice(0, MAX_OPTIONS).map((option) => parseBilingual(option, MAX_OPTION_CHARS))
      : [];
    if (options.length < MIN_OPTIONS) continue;

    let id = typeof q.id === "number" && Number.isInteger(q.id) && q.id > 0 ? q.id : list.length + 1;
    while (used.has(id)) id += 1;
    used.add(id);

    list.push({
      id,
      q: parseBilingual(q.q, MAX_QUESTION_CHARS),
      options,
      correct: num(q.correct, 0, options.length - 1, 0),
      seconds: q.seconds === null || q.seconds === undefined ? null : num(q.seconds, MIN_SECONDS, MAX_SECONDS, MIN_SECONDS),
    });
  }

  return list.length > 0 ? list : null;
}

export function sampleQuestions(): QuizQuestion[] {
  return SAMPLE_QUESTIONS.map((q) => ({ ...q, q: { ...q.q }, options: q.options.map((o) => ({ ...o })) }));
}
