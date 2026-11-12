import { createBackground, type BackgroundPreset, type Rect } from "./background";
import type { Badge } from "./badge";
import { createCaption, type Caption } from "./captions";
import { TEXTS } from "./i18n";
import { drawMascot, type Mood } from "./mascot";
import { letterFor, showLangs, type Bilingual, type Lang, type QuizQuestion, type ShowLang } from "./questions";
import { locate, type QuizTimeline } from "./timeline";

/*
 * One renderer for the preview and the export: drawFrame(ctx, timeMs) paints
 * the exact picture for that moment. Static parts (background, title cards,
 * badge) are made once.
 */

const FONT = '"Trebuchet MS", "Segoe UI", system-ui, -apple-system, sans-serif';

export type QuizRendererOptions = {
  width: number;
  height: number;
  questions: QuizQuestion[];
  timeline: QuizTimeline;
  show: ShowLang;
  background: BackgroundPreset;
  badge: Badge | null;
  title: Bilingual;
  outro: Bilingual;
  comment: Bilingual;
  showMascot: boolean;
};

export type QuizRenderer = {
  width: number;
  height: number;
  timeline: QuizTimeline;
  drawFrame: (ctx: CanvasRenderingContext2D, timeMs: number) => void;
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

function ringColor(fraction: number): string {
  if (fraction > 0.5) return "#2fb26a";
  if (fraction > 0.25) return "#f2b01e";
  return "#e5484d";
}

function wrapWords(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;

    if (line && ctx.measureText(candidate).width > maxW) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) lines.push(line);

  return lines;
}

/** Draws `text` centered in `rect`, shrinking the font until it fits. */
function drawFitted(
  ctx: CanvasRenderingContext2D,
  text: string,
  rect: Rect,
  startSize: number,
  color: string,
  lang: Lang,
) {
  if (!text.trim()) return;

  let size = startSize;
  let lines: string[] = [];

  for (let i = 0; i < 30; i++) {
    ctx.font = `800 ${size}px ${FONT}`;
    lines = wrapWords(ctx, text, rect.w);
    if (lines.length * size * 1.2 <= rect.h || size <= startSize * 0.35) break;
    size *= 0.92;
  }

  ctx.save();
  ctx.direction = lang === "ar" ? "rtl" : "ltr";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.font = `800 ${size}px ${FONT}`;

  const lineHeight = size * 1.2;
  const top = rect.y + rect.h / 2 - (lines.length * lineHeight) / 2 + lineHeight / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, rect.x + rect.w / 2, top + index * lineHeight, rect.w);
  });
  ctx.restore();
}

/** One text block per shown language, stacked (English on top). */
function drawStack(
  ctx: CanvasRenderingContext2D,
  value: Bilingual,
  langs: Lang[],
  rect: Rect,
  startSize: number,
  color: string,
  secondaryColor = color,
) {
  if (langs.length === 1) {
    drawFitted(ctx, value[langs[0]], rect, startSize, color, langs[0]);
    return;
  }

  const topH = rect.h * 0.55;
  drawFitted(ctx, value.en, { ...rect, h: topH }, startSize, color, "en");
  drawFitted(ctx, value.ar, { ...rect, y: rect.y + topH, h: rect.h - topH }, startSize * 0.88, secondaryColor, "ar");
}

function scallop(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, points: number) {
  ctx.beginPath();
  const steps = points * 2;

  for (let i = 0; i < steps; i++) {
    const radius = i % 2 === 0 ? r : r * 0.86;
    const angle = (Math.PI * 2 * i) / steps - Math.PI / 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }

  ctx.closePath();
}

export function createQuizRenderer(options: QuizRendererOptions): QuizRenderer {
  const { width, height, questions, timeline, badge, showMascot } = options;
  const langs = showLangs(options.show);
  const base = Math.min(width, height);
  const portrait = height > width;
  const { canvas: backdrop, sheet: card } = createBackground(width, height, options.background);
  const cx = card.x + card.w / 2;

  // ---- Layout ----
  const numberPos = portrait
    ? { x: cx, y: card.y + card.h * 0.065, r: Math.min(card.w * 0.07, card.h * 0.04) }
    : { x: card.x + card.w * 0.27, y: card.y + card.h * 0.12, r: card.h * 0.065 };
  const questionBox: Rect = portrait
    ? { x: card.x + card.w * 0.05, y: card.y + card.h * 0.115, w: card.w * 0.9, h: card.h * 0.235 }
    : { x: card.x + card.w * 0.04, y: card.y + card.h * 0.19, w: card.w * 0.46, h: card.h * 0.44 };
  const optionsArea: Rect = portrait
    ? { x: card.x + card.w * 0.05, y: card.y + card.h * 0.375, w: card.w * 0.9, h: card.h * 0.365 }
    : { x: card.x + card.w * 0.54, y: card.y + card.h * 0.1, w: card.w * 0.42, h: card.h * 0.8 };
  const ring = portrait
    ? { x: card.x + card.w * 0.34, y: card.y + card.h * 0.855, r: Math.min(card.w * 0.12, card.h * 0.07) }
    : { x: card.x + card.w * 0.33, y: card.y + card.h * 0.78, r: Math.min(card.w * 0.06, card.h * 0.11) };
  const mascot = portrait
    ? { x: card.x + card.w * 0.8, y: card.y + card.h * 0.975, size: Math.min(card.w * 0.24, card.h * 0.15) }
    : { x: card.x + card.w * 0.14, y: card.y + card.h * 0.955, size: Math.min(card.w * 0.1, card.h * 0.2) };
  const banner: Rect = portrait
    ? { x: card.x + card.w * 0.05, y: card.y + card.h * 0.765, w: card.w * 0.62, h: card.h * 0.135 }
    : { x: card.x + card.w * 0.04, y: card.y + card.h * 0.66, w: card.w * 0.46, h: card.h * 0.17 };

  // ---- Title and ending cards (pre-rendered) ----
  function captions(value: Bilingual, color: string): Caption[] {
    const list: Caption[] = [];
    langs.forEach((lang, index) => {
      const item = createCaption(
        value[lang],
        cx,
        card.y + card.h * (0.27 + index * 0.15),
        card.w * 0.86,
        base,
        portrait ? 0.056 : 0.064,
        color,
      );
      if (item) list.push(item);
    });

    return list;
  }

  const titleCaptions = captions(options.title, "#ff8c42");
  const outroCaptions = captions(options.outro, "#2fb26a");

  function drawCard(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.shadowColor = "rgba(40, 30, 10, 0.25)";
    ctx.shadowBlur = base * 0.03;
    ctx.shadowOffsetY = base * 0.01;
    ctx.fillStyle = "#fffaf0";
    ctx.beginPath();
    ctx.roundRect(card.x, card.y, card.w, card.h, base * 0.04);
    ctx.fill();
    ctx.restore();
  }

  function drawNumber(ctx: CanvasRenderingContext2D, index: number, scale: number) {
    ctx.save();
    ctx.translate(numberPos.x, numberPos.y);
    ctx.scale(scale, scale);
    scallop(ctx, 0, 0, numberPos.r, 14);
    ctx.fillStyle = "#ffcf3f";
    ctx.fill();
    ctx.lineWidth = Math.max(3, numberPos.r * 0.1);
    ctx.strokeStyle = "#c9672a";
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.fillStyle = "#3a2418";
    ctx.font = `900 ${numberPos.r * 1.15}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.direction = "ltr";
    ctx.fillText(String(index + 1), 0, numberPos.r * 0.06);
    ctx.restore();
  }

  function drawQuestionBox(ctx: CanvasRenderingContext2D, question: QuizQuestion, dy: number) {
    ctx.save();
    ctx.translate(0, dy);
    ctx.shadowColor = "rgba(40, 30, 10, 0.2)";
    ctx.shadowBlur = base * 0.015;
    ctx.shadowOffsetY = base * 0.006;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(questionBox.x, questionBox.y, questionBox.w, questionBox.h, base * 0.035);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.lineWidth = Math.max(4, base * 0.007);
    ctx.strokeStyle = "#ff8c42";
    ctx.stroke();

    const pad = questionBox.w * 0.05;
    const inner: Rect = {
      x: questionBox.x + pad,
      y: questionBox.y + pad * 0.8,
      w: questionBox.w - pad * 2,
      h: questionBox.h - pad * 1.6,
    };
    drawStack(ctx, question.q, langs, inner, base * (portrait ? 0.062 : 0.066), "#2d3a4a", "#4a5d73");
    ctx.restore();
  }

  function optionRects(count: number): Rect[] {
    const gap = optionsArea.h * 0.05;
    const each = Math.min(optionsArea.h * 0.3, (optionsArea.h - gap * (count - 1)) / count);
    const total = each * count + gap * (count - 1);
    const top = optionsArea.y + (optionsArea.h - total) / 2;

    return Array.from({ length: count }, (_, i) => ({
      x: optionsArea.x,
      y: top + i * (each + gap),
      w: optionsArea.w,
      h: each,
    }));
  }

  type OptionState = "neutral" | "correct" | "wrong";

  function drawOption(
    ctx: CanvasRenderingContext2D,
    question: QuizQuestion,
    index: number,
    rect: Rect,
    appear: number,
    state: OptionState,
    pop: number,
  ) {
    if (appear <= 0) return;

    const option = question.options[index];
    const slide = (1 - easeOutCubic(appear)) * rect.w * 0.35;
    const scale = state === "correct" ? 1 + 0.05 * Math.sin(Math.min(1, pop) * Math.PI) : 1;

    ctx.save();
    ctx.globalAlpha = clamp01(appear * 1.6) * (state === "wrong" ? 0.35 : 1);
    ctx.translate(rect.x + rect.w / 2 + slide, rect.y + rect.h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-rect.w / 2, -rect.h / 2);

    const r = rect.h / 2;
    ctx.shadowColor = "rgba(40, 30, 10, 0.18)";
    ctx.shadowBlur = base * 0.012;
    ctx.shadowOffsetY = base * 0.005;
    ctx.fillStyle = state === "correct" ? "#2fb26a" : "#ffffff";
    ctx.beginPath();
    ctx.roundRect(0, 0, rect.w, rect.h, r);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.lineWidth = Math.max(3, base * 0.0055);
    ctx.strokeStyle = state === "correct" ? "#1b7a47" : "#c9672a";
    ctx.stroke();

    // Letter circle.
    const lr = r * 0.78;
    ctx.beginPath();
    ctx.arc(r, r, lr, 0, Math.PI * 2);
    ctx.fillStyle = state === "correct" ? "#ffffff" : "#ffcf3f";
    ctx.fill();
    ctx.strokeStyle = state === "correct" ? "#1b7a47" : "#c9672a";
    ctx.stroke();
    ctx.fillStyle = "#3a2418";
    ctx.font = `900 ${lr * 1.05}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.direction = "ltr";
    ctx.fillText(letterFor(langs[0], index), r, r + lr * 0.05);

    // Text.
    const textRect: Rect = { x: r * 2.05, y: rect.h * 0.08, w: rect.w - r * 4.1, h: rect.h * 0.84 };
    drawStack(
      ctx,
      option,
      langs,
      textRect,
      rect.h * (langs.length === 2 ? 0.4 : 0.46),
      state === "correct" ? "#ffffff" : "#2d3a4a",
      state === "correct" ? "#eafff2" : "#4a5d73",
    );

    // Check mark on the right answer.
    if (state === "correct") {
      const kx = rect.w - r * 1.05;
      ctx.beginPath();
      ctx.moveTo(kx - r * 0.38, r * 1.02);
      ctx.lineTo(kx - r * 0.08, r * 1.3);
      ctx.lineTo(kx + r * 0.42, r * 0.72);
      ctx.lineWidth = r * 0.22;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawRing(ctx: CanvasRenderingContext2D, remaining: number, seconds: number, revealed: boolean, pop: number) {
    const { x, y, r } = ring;
    const line = r * 0.22;
    const fraction = clamp01(remaining / seconds);

    ctx.save();
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = line;
    ctx.strokeStyle = "#efe6d2";
    ctx.stroke();

    if (revealed) {
      const s = 0.7 + 0.3 * easeOutBack(pop);
      ctx.translate(x, y);
      ctx.scale(s, s);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = "#2fb26a";
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-r * 0.42, r * 0.02);
      ctx.lineTo(-r * 0.1, r * 0.34);
      ctx.lineTo(r * 0.46, -r * 0.3);
      ctx.lineWidth = r * 0.24;
      ctx.strokeStyle = "#ffffff";
      ctx.lineJoin = "round";
      ctx.stroke();
    } else {
      if (fraction > 0.001) {
        ctx.beginPath();
        ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fraction);
        ctx.strokeStyle = ringColor(fraction);
        ctx.stroke();
      }

      const whole = Math.ceil(remaining - 1e-6);
      const phase = remaining - Math.floor(remaining - 1e-6) - 1;
      const bump = remaining > 0 && remaining < seconds ? 1 + 0.18 * clamp01(1 + phase * 4) : 1;
      ctx.translate(x, y);
      ctx.scale(bump, bump);
      ctx.fillStyle = ringColor(fraction);
      ctx.font = `900 ${r}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.direction = "ltr";
      ctx.fillText(String(Math.max(0, whole)), 0, r * 0.05);
    }

    ctx.restore();
  }

  function drawConfetti(ctx: CanvasRenderingContext2D, since: number, ox: number, oy: number) {
    if (since <= 0 || since > 2400) return;

    const colors = ["#ff8c42", "#ffd23f", "#2fb26a", "#4aa8ff", "#ff6b9a", "#9b6bff"];
    const t = since / 1000;
    ctx.save();
    ctx.globalAlpha = clamp01((2.4 - t) / 0.8);

    for (let i = 0; i < 46; i++) {
      const a = ((i * 137.5) % 360) * (Math.PI / 180);
      const speed = base * (0.3 + ((i * 53) % 40) / 100);
      const px = ox + Math.cos(a) * speed * t * 0.9;
      const py = oy - Math.abs(Math.sin(a)) * speed * t * 1.0 + base * 0.7 * t * t;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a + t * (3 + (i % 5)));
      ctx.fillStyle = colors[i % colors.length];
      const s = base * 0.013 * (1 + (i % 3) * 0.4);
      ctx.fillRect(-s, -s * 0.5, s * 2, s);
      ctx.restore();
    }

    ctx.restore();
  }

  function drawBanner(ctx: CanvasRenderingContext2D, since: number) {
    const enter = easeOutBack(clamp01(since / 500));
    const glow = 0.5 + 0.5 * Math.sin(since / 220);

    ctx.save();
    ctx.globalAlpha = clamp01(since / 250);
    ctx.translate(banner.x + banner.w / 2, banner.y + banner.h / 2);
    ctx.scale(0.85 + 0.15 * enter, 0.85 + 0.15 * enter);
    ctx.translate(-banner.w / 2, -banner.h / 2);
    ctx.shadowColor = "rgba(40, 30, 10, 0.25)";
    ctx.shadowBlur = base * 0.02;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(0, 0, banner.w, banner.h, base * 0.03);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.lineWidth = base * (0.006 + 0.003 * glow);
    ctx.strokeStyle = "#2fb26a";
    ctx.stroke();
    drawStack(
      ctx,
      options.comment,
      langs,
      { x: banner.w * 0.04, y: banner.h * 0.08, w: banner.w * 0.92, h: banner.h * 0.84 },
      base * 0.05,
      "#1b7a47",
      "#2f8f5d",
    );
    ctx.restore();
  }

  function centeredLines(
    ctx: CanvasRenderingContext2D,
    value: Bilingual,
    y: number,
    size: number,
    alpha: number,
  ) {
    ctx.save();
    ctx.globalAlpha = alpha;
    langs.forEach((lang, index) => {
      drawFitted(
        ctx,
        value[lang],
        { x: card.x + card.w * 0.06, y: y + index * size * 1.5, w: card.w * 0.88, h: size * 1.4 },
        size,
        "#6b5a3c",
        lang,
      );
    });
    ctx.restore();
  }

  function drawTitleScreen(
    ctx: CanvasRenderingContext2D,
    list: Caption[],
    sub: Bilingual,
    t: number,
    timeMs: number,
  ) {
    const alpha = clamp01(t / 400);
    const slide = (1 - easeOutBack(clamp01(t / 700))) * base * 0.08;

    for (const caption of list) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(caption.canvas, caption.x, caption.y + slide);
      ctx.restore();
    }

    centeredLines(ctx, sub, card.y + card.h * (0.27 + (langs.length - 1) * 0.15 + 0.13), base * 0.036, clamp01((t - 300) / 500));

    if (showMascot) {
      const size = Math.min(card.w * 0.34, card.h * (portrait ? 0.19 : 0.2));
      drawMascot(ctx, cx, card.y + card.h * 0.95, size, "cheer", timeMs);
    }
  }

  function drawFrame(ctx: CanvasRenderingContext2D, timeMs: number) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(backdrop, 0, 0);
    drawCard(ctx);

    const moment = locate(timeline, timeMs);

    if (moment.phase === "intro") {
      drawTitleScreen(
        ctx,
        titleCaptions,
        { en: TEXTS.en.subtitle, ar: TEXTS.ar.subtitle },
        moment.t,
        timeMs,
      );
    } else if (moment.phase === "outro") {
      drawTitleScreen(
        ctx,
        outroCaptions,
        { en: TEXTS.en.outroSub, ar: TEXTS.ar.outroSub },
        moment.t,
        timeMs,
      );
    } else {
      const question = questions[moment.index];
      const slot = timeline.slots[moment.index];
      const since = moment.sinceStart;
      const fade = clamp01((slot.end - timeMs) / 300);
      const isComment = moment.kind === "comment";
      const answerShown = moment.revealed && !isComment;
      const pop = clamp01(moment.sinceReveal / 500);

      ctx.save();
      ctx.globalAlpha = fade;

      const enter = easeOutBack(clamp01(since / 500));
      drawNumber(ctx, moment.index, enter);
      ctx.save();
      ctx.globalAlpha = fade * clamp01(since / 300);
      drawQuestionBox(ctx, question, (1 - enter) * base * 0.05);
      ctx.restore();

      const rects = optionRects(question.options.length);
      rects.forEach((rect, i) => {
        const appear = clamp01((since - 500 - i * 450) / 450);
        const state: OptionState = !answerShown ? "neutral" : i === question.correct ? "correct" : "wrong";
        drawOption(ctx, question, i, rect, appear, state, pop);
      });

      if (isComment && moment.revealed) {
        drawBanner(ctx, moment.sinceReveal);
      } else if (since > 500) {
        drawRing(ctx, moment.remaining, moment.seconds, answerShown, pop);
      }

      ctx.restore();

      if (answerShown) {
        const correct = rects[question.correct];
        drawConfetti(ctx, moment.sinceReveal, correct.x + correct.w / 2, correct.y + correct.h / 2);
      }

      if (showMascot) {
        const mood: Mood = isComment && moment.revealed
          ? "cheer"
          : answerShown
            ? moment.sinceReveal < 1800
              ? "cheer"
              : "happy"
            : since < 900
              ? "idle"
              : "think";
        drawMascot(ctx, mascot.x, mascot.y, mascot.size, mood, timeMs);
      }
    }

    if (badge) ctx.drawImage(badge.canvas, badge.x, badge.y);
    ctx.restore();
  }

  return { width, height, timeline, drawFrame };
}
