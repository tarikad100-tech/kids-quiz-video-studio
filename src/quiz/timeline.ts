/*
 * One schedule for the whole video, shared by the preview, the sound and the
 * export. Per question: appear (the narrator reads it) -> countdown -> reveal
 * of the answer. The last question can instead ask the viewers to answer in the
 * comments, with no reveal.
 */

export const INTRO_MS = 2800;
export const REVEAL_MS = 2600;
export const OUTRO_MS = 4000;
export const MIN_APPEAR_MS = 3200;
export const MIN_COMMENT_MS = 4500;

export const MIN_SECONDS = 3;
export const MAX_SECONDS = 30;

export const VOICE_LEAD_MS = 450;
export const VOICE_GAP_MS = 350;
export const VOICE_TAIL_MS = 700;

export type SlotKind = "answer" | "comment";

export type QuizSlot = {
  start: number;
  countStart: number;
  /** Reveal of the answer, or the start of the comment screen. */
  revealStart: number;
  end: number;
  kind: SlotKind;
  seconds: number;
};

export type QuizTimeline = {
  /** Length of the opening title card; 0 = the questions start at once. */
  introMs: number;
  slots: QuizSlot[];
  outroStart: number;
  totalMs: number;
};

export type TimelineInput = {
  /** Time the question stays on screen before its countdown starts. */
  appearMs: number[];
  seconds: number[];
  /** Length of the comment screen. */
  commentMs: number;
  lastIsComment: boolean;
  introMs: number;
};

export function clampSeconds(value: number): number {
  return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.round(value)));
}

/** Time the narrator needs for clips played one after another. */
export function sequenceMs(durationsMs: number[]): number {
  if (durationsMs.length === 0) return 0;

  return durationsMs.reduce((sum, value) => sum + value, 0) + VOICE_GAP_MS * (durationsMs.length - 1);
}

export function appearFor(durationsMs: number[]): number {
  if (durationsMs.length === 0) return MIN_APPEAR_MS;

  return Math.max(MIN_APPEAR_MS, VOICE_LEAD_MS + sequenceMs(durationsMs) + VOICE_TAIL_MS);
}

/** Start time of each clip when a block starts at `startMs`. */
export function voiceStarts(startMs: number, durationsMs: number[]): number[] {
  const starts: number[] = [];
  let cursor = startMs + VOICE_LEAD_MS;

  for (const duration of durationsMs) {
    starts.push(cursor);
    cursor += duration + VOICE_GAP_MS;
  }

  return starts;
}

export function buildTimeline(input: TimelineInput): QuizTimeline {
  const count = input.appearMs.length;
  const slots: QuizSlot[] = [];
  let cursor = input.introMs;

  for (let i = 0; i < count; i++) {
    const seconds = clampSeconds(input.seconds[i] ?? MIN_SECONDS);
    const kind: SlotKind = input.lastIsComment && i === count - 1 ? "comment" : "answer";
    const countStart = cursor + input.appearMs[i];
    const revealStart = countStart + seconds * 1000;
    const end = revealStart + (kind === "comment" ? Math.max(MIN_COMMENT_MS, input.commentMs) : REVEAL_MS);

    slots.push({ start: cursor, countStart, revealStart, end, kind, seconds });
    cursor = end;
  }

  return { introMs: input.introMs, slots, outroStart: cursor, totalMs: cursor + OUTRO_MS };
}

export type Moment =
  | { phase: "intro"; t: number }
  | {
      phase: "question";
      index: number;
      kind: SlotKind;
      seconds: number;
      /** Milliseconds since the question started. */
      sinceStart: number;
      /** Seconds left, smooth (equals `seconds` before the countdown). */
      remaining: number;
      /** Milliseconds since the reveal (or comment screen) began; 0 before. */
      sinceReveal: number;
      revealed: boolean;
    }
  | { phase: "outro"; t: number };

export function locate(timeline: QuizTimeline, timeMs: number): Moment {
  const t = Math.min(Math.max(0, timeMs), timeline.totalMs);

  if (t < timeline.introMs || timeline.slots.length === 0) return { phase: "intro", t };
  if (t >= timeline.outroStart) return { phase: "outro", t: t - timeline.outroStart };

  let index = timeline.slots.findIndex((slot) => t < slot.end);
  if (index < 0) index = timeline.slots.length - 1;

  const slot = timeline.slots[index];

  return {
    phase: "question",
    index,
    kind: slot.kind,
    seconds: slot.seconds,
    sinceStart: t - slot.start,
    remaining: Math.min(slot.seconds, Math.max(0, (slot.revealStart - Math.max(t, slot.countStart)) / 1000)),
    sinceReveal: Math.max(0, t - slot.revealStart),
    revealed: t >= slot.revealStart,
  };
}
