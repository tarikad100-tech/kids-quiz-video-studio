import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GENERATED_TRACKS, isMusicTrackId } from "./audio/music";
import { buildSoundtrack, type VoiceItem } from "./audio/soundtrack";
import VoicePanel, { type ClipEntry, type ClipItem } from "./components/VoicePanel";
import BankPanel from "./components/BankPanel";
import QuestionEditor from "./components/QuestionEditor";
import { countByCategory, pickQuestions } from "./bank/engine";
import { ALL_ITEMS } from "./bank/index";
import { DEFAULT_PROFILE_PICTURE } from "./branding/defaultProfile";
import { useImageUrl } from "./hooks/useLoadedImage";
import { useMusicBuffer } from "./hooks/useMusicBuffer";
import { BACKGROUND_OPTIONS, isBackgroundPreset } from "./quiz/background";
import { BADGE_POSITIONS, MAX_BADGE_NAME, createBadge, isBadgePosition } from "./quiz/badge";
import { createQuizRenderer } from "./quiz/frame";
import { TEXTS } from "./quiz/i18n";
import {
  MAX_QUESTIONS,
  blankQuestion,
  voiceLangs,
  voiceScript,
  type Lang,
  type QuizQuestion,
  type VoiceLang,
} from "./quiz/questions";
import {
  INTRO_MS,
  MAX_SECONDS,
  MIN_SECONDS,
  VOICE_LEAD_MS,
  VOICE_TAIL_MS,
  appearFor,
  buildTimeline,
  sequenceMs,
  voiceStarts,
} from "./quiz/timeline";
import { DEFAULT_SETTINGS, parseQuestions, parseSettings, sampleQuestions, type Settings } from "./settings";
import { exportSupported, exportVideo } from "./video/exportVideo";
import { MAX_CLIP_FILE_BYTES, MAX_CLIP_SECONDS, decodeAudio, speakPreview, startRecording, stopPreviewSpeech, type Recording } from "./voice/audio";
import { listVoices, synthesize, type VoiceInfo } from "./voice/elevenlabs";
import { deleteStored, loadStored, saveStored } from "./voice/store";
import "./App.css";

const STORAGE_KEY = "quizzy-studio-v1";
const PROFILE_KEY = "quizzy-studio-profile-v1";
const API_KEY_KEY = "quizzy-elevenlabs-key";
const USED_KEY = "quizzy-used-v1";
const NEXT_ID_KEY = "quizzy-next-id";
const PREVIEW_SHORT = 540;
const BANK_TOTALS = countByCategory();

const clipKeyQ = (id: number, lang: Lang) => `q${id}-${lang}`;
const clipKeyC = (lang: Lang) => `comment-${lang}`;
const estimateMs = (script: string) => Math.max(1500, script.length * 75);

function loadSaved(): { settings: Settings; questions: QuizQuestion[] } {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");

    if (typeof parsed === "object" && parsed !== null) {
      const p = parsed as Record<string, unknown>;

      return {
        settings: parseSettings(p.settings),
        questions: parseQuestions(p.questions) ?? sampleQuestions(),
      };
    }
  } catch {
    // Start fresh.
  }

  return { settings: DEFAULT_SETTINGS, questions: sampleQuestions() };
}

function readStored(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function readUsed(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(USED_KEY) ?? "[]");

    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function readProfile(): string {
  const saved = readStored(PROFILE_KEY);

  return saved.startsWith("data:image/") ? saved : DEFAULT_PROFILE_PICTURE;
}

function squareThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");

      if (!ctx || side === 0) {
        reject(new Error("The picture could not be read."));
        return;
      }

      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
      resolve(canvas.toDataURL("image/png"));
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The picture could not be read."));
    };

    image.src = url;
  });
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);

  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function errorText(failure: unknown, fallback: string): string {
  return failure instanceof Error ? failure.message : fallback;
}

export default function App() {
  const [initial] = useState(loadSaved);
  const [settings, setSettings] = useState<Settings>(initial.settings);
  const [questions, setQuestions] = useState<QuizQuestion[]>(initial.questions);
  const [used, setUsed] = useState<Set<string>>(readUsed);
  const [bankMessage, setBankMessage] = useState("");
  const nextIdRef = useRef(Math.max(Number(readStored(NEXT_ID_KEY)) || 0, ...initial.questions.map((q) => q.id), 1000) + 1);
  const [profileSrc, setProfileSrc] = useState(readProfile);
  const [profileError, setProfileError] = useState("");
  const [timeMs, setTimeMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  // Voice library state.
  const [apiKey, setApiKey] = useState(() => readStored(API_KEY_KEY));
  const [remember, setRemember] = useState(() => readStored(API_KEY_KEY) !== "");
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [clips, setClips] = useState<Record<string, ClipEntry>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [recordingKey, setRecordingKey] = useState<string | null>(null);
  const [voiceMessage, setVoiceMessage] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const clipSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const recorderRef = useRef<Recording | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timeRef = useRef(0);

  const badgeImage = useImageUrl(profileSrc);
  const music = useMusicBuffer(settings.music, null);

  const voiceMode: VoiceLang = settings.narrator ? settings.language : "None";
  const lang: Lang = settings.language === "Arabic" ? "ar" : "en";
  const titleText = { en: settings.titleEn || TEXTS.en.title, ar: settings.titleAr || TEXTS.ar.title };
  const outroText = { en: settings.outroEn || TEXTS.en.outro, ar: settings.outroAr || TEXTS.ar.outro };
  const commentText = { en: settings.commentEn || TEXTS.en.comment, ar: settings.commentAr || TEXTS.ar.comment };

  // ---- Clip list shown in the voice panel ----
  const clipItems = useMemo<ClipItem[]>(() => {
    const items: ClipItem[] = [];
    const langs = voiceLangs(voiceMode);

    questions.forEach((q, index) => {
      for (const lang of langs) {
        items.push({
          key: clipKeyQ(q.id, lang),
          label: `Question ${index + 1} · ${lang === "en" ? "English" : "Arabic"}`,
          lang,
          script: voiceScript(q, lang, settings.readOptions),
        });
      }
    });

    if (settings.lastIsComment) {
      for (const lang of langs) {
        items.push({
          key: clipKeyC(lang),
          label: `Comment call · ${lang === "en" ? "English" : "Arabic"}`,
          lang,
          script: commentText[lang],
        });
      }
    }

    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, voiceMode, settings.readOptions, settings.lastIsComment, settings.commentEn, settings.commentAr]);

  // ---- Timeline and voice schedule (the clips decide how long each question stays) ----
  const plan = useMemo(() => {
    const langs = voiceLangs(voiceMode);
    const byKey = new Map(clipItems.map((item) => [item.key, item]));
    const lengthOf = (key: string): number => {
      const clip = clips[key];
      if (clip) return clip.buffer.duration * 1000;

      return estimateMs(byKey.get(key)?.script ?? "");
    };

    const questionDurations = questions.map((q) => langs.map((lang) => lengthOf(clipKeyQ(q.id, lang))));
    const commentDurations = settings.lastIsComment ? langs.map((lang) => lengthOf(clipKeyC(lang))) : [];

    const timeline = buildTimeline({
      appearMs: questionDurations.map(appearFor),
      seconds: questions.map((q) => q.seconds ?? settings.seconds),
      commentMs: commentDurations.length > 0 ? VOICE_LEAD_MS + sequenceMs(commentDurations) + VOICE_TAIL_MS : 0,
      lastIsComment: settings.lastIsComment,
      introMs: settings.intro ? INTRO_MS : 0,
    });

    const items: VoiceItem[] = [];
    questions.forEach((q, index) => {
      const starts = voiceStarts(timeline.slots[index].start, questionDurations[index]);
      langs.forEach((lang, k) => {
        const clip = clips[clipKeyQ(q.id, lang)];
        if (clip) items.push({ atMs: starts[k], buffer: clip.buffer });
      });
    });

    if (settings.lastIsComment && timeline.slots.length > 0) {
      const starts = voiceStarts(timeline.slots[timeline.slots.length - 1].revealStart, commentDurations);
      langs.forEach((lang, k) => {
        const clip = clips[clipKeyC(lang)];
        if (clip) items.push({ atMs: starts[k], buffer: clip.buffer });
      });
    }

    return { timeline, voices: items };
  }, [questions, clips, clipItems, voiceMode, settings.seconds, settings.lastIsComment, settings.intro]);

  const timeline = plan.timeline;
  const missingClips = clipItems.filter((item) => !clips[item.key]).length;
  const staleClips = clipItems.filter((item) => clips[item.key] && clips[item.key].script !== item.script).length;

  const [soundtrack, setSoundtrack] = useState<{ buffer: AudioBuffer | null; for: unknown } | null>(null);
  const soundKey = useMemo(
    () => ({ timeline, voices: plan.voices, music: music.buffer, volume: settings.musicVolume, effects: settings.effects }),
    [timeline, plan.voices, music.buffer, settings.musicVolume, settings.effects],
  );
  const soundReady = soundtrack !== null && soundtrack.for === soundKey;
  const musicLoading = music.status === "loading";

  // Remember settings and questions.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, questions }));
    } catch {
      // Not remembered in a private window.
    }
  }, [settings, questions]);

  useEffect(() => {
    try {
      if (remember && apiKey) localStorage.setItem(API_KEY_KEY, apiKey);
      else localStorage.removeItem(API_KEY_KEY);
    } catch {
      // Ignore.
    }
  }, [apiKey, remember]);

  useEffect(() => {
    try {
      localStorage.setItem(USED_KEY, JSON.stringify([...used]));
    } catch {
      // Not remembered in a private window.
    }
  }, [used]);

  // Bring back the saved voice clips.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const found: Record<string, ClipEntry> = {};
      const keys: string[] = [];

      for (const q of initial.questions) for (const lang of ["en", "ar"] as const) keys.push(clipKeyQ(q.id, lang));
      for (const lang of ["en", "ar"] as const) keys.push(clipKeyC(lang));

      for (const key of keys) {
        const stored = await loadStored(`clip:${key}`);
        if (!stored) continue;

        try {
          found[key] = { buffer: await decodeAudio(stored.bytes), script: stored.script, source: stored.source };
        } catch {
          // Damaged clip: ignore it.
        }
      }

      if (!cancelled && Object.keys(found).length > 0) setClips((current) => ({ ...found, ...current }));
    })();

    return () => {
      cancelled = true;
    };
  }, [initial.questions]);

  const stopAudio = useCallback(() => {
    try {
      sourceRef.current?.stop();
    } catch {
      // Already stopped.
    }
    sourceRef.current = null;
  }, []);

  // Build the full soundtrack (music + effects + voices) whenever something changes.
  useEffect(() => {
    if (musicLoading) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      buildSoundtrack({
        timeline: soundKey.timeline,
        music: soundKey.music,
        musicVolume: soundKey.volume,
        effects: soundKey.effects,
        voices: soundKey.voices,
      })
        .then((buffer) => {
          if (!cancelled) setSoundtrack({ buffer, for: soundKey });
        })
        .catch(() => {
          if (!cancelled) setSoundtrack({ buffer: null, for: soundKey });
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [soundKey, musicLoading]);

  function makeRenderer(width: number, height: number) {
    return createQuizRenderer({
      width,
      height,
      questions,
      timeline,
      show: settings.language,
      background: settings.background,
      badge: settings.showBadge
        ? createBadge(width, height, settings.badgeName, badgeImage, settings.badgePosition)
        : null,
      title: titleText,
      outro: outroText,
      comment: commentText,
      showMascot: settings.showMascot,
    });
  }

  const renderer = useMemo(() => {
    const width = settings.vertical ? PREVIEW_SHORT : Math.round((PREVIEW_SHORT * 16) / 9);
    const height = settings.vertical ? Math.round((PREVIEW_SHORT * 16) / 9) : PREVIEW_SHORT;

    return makeRenderer(width, height);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, questions, timeline, badgeImage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    canvas.width = renderer.width;
    canvas.height = renderer.height;
    renderer.drawFrame(ctx, Math.min(timeMs, timeline.totalMs));
  }, [renderer, timeMs, timeline.totalMs]);

  function seek(ms: number) {
    timeRef.current = ms;
    setTimeMs(ms);
  }

  function pause() {
    stopAudio();
    setPlaying(false);
  }

  useEffect(() => {
    stopAudio();
    setPlaying(false);
  }, [soundKey, stopAudio]);

  useEffect(
    () => () => {
      stopAudio();
      stopPreviewSpeech();
      recorderRef.current?.cancel();
    },
    [stopAudio],
  );

  // Playback clock: the audio clock when there is sound, otherwise the wall clock.
  useEffect(() => {
    if (!playing) return;

    const startTime = timeRef.current >= timeline.totalMs ? 0 : timeRef.current;
    const wallStart = performance.now();
    let audioStart: number | null = null;
    let frame = 0;

    if (soundReady && soundtrack?.buffer) {
      try {
        const ctx = audioRef.current ?? new AudioContext();
        audioRef.current = ctx;
        void ctx.resume();
        const source = ctx.createBufferSource();
        source.buffer = soundtrack.buffer;
        source.connect(ctx.destination);
        source.start(0, startTime / 1000);
        sourceRef.current = source;
        audioStart = ctx.currentTime;
      } catch {
        audioStart = null;
      }
    }

    const tick = () => {
      const elapsed =
        audioStart !== null && audioRef.current
          ? (audioRef.current.currentTime - audioStart) * 1000
          : performance.now() - wallStart;
      const next = startTime + elapsed;

      if (next >= timeline.totalMs) {
        timeRef.current = timeline.totalMs;
        setTimeMs(timeline.totalMs);
        stopAudio();
        setPlaying(false);
        return;
      }

      timeRef.current = next;
      setTimeMs(next);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      stopAudio();
    };
  }, [playing, timeline.totalMs, soundReady, soundtrack, stopAudio]);

  function update(patch: Partial<Settings>) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  // ---- Voice operations ----
  async function storeClip(item: ClipItem, bytes: ArrayBuffer, source: ClipEntry["source"]) {
    const buffer = await decodeAudio(bytes);

    if (buffer.duration > MAX_CLIP_SECONDS) {
      throw new Error(`This clip is ${Math.round(buffer.duration)} s long; the limit is ${MAX_CLIP_SECONDS} s.`);
    }

    setClips((current) => ({ ...current, [item.key]: { buffer, script: item.script, source } }));
    await saveStored(`clip:${item.key}`, { bytes, script: item.script, source });
  }

  async function generate(item: ClipItem) {
    const voiceId = item.lang === "en" ? settings.voiceEn : settings.voiceAr;
    setBusyKey(item.key);
    setVoiceMessage("");

    try {
      await storeClip(item, await synthesize(apiKey, voiceId, item.script), "voice");
    } catch (failure) {
      setVoiceMessage(errorText(failure, "The voice could not be generated."));
    } finally {
      setBusyKey(null);
    }
  }

  async function generateAll() {
    setBusyKey("all");
    setVoiceMessage("");

    try {
      for (const item of clipItems) {
        const clip = clips[item.key];
        if (clip && clip.script === item.script) continue;
        if (!item.script.trim()) continue;

        const voiceId = item.lang === "en" ? settings.voiceEn : settings.voiceAr;
        await storeClip(item, await synthesize(apiKey, voiceId, item.script), "voice");
      }
    } catch (failure) {
      setVoiceMessage(errorText(failure, "The voices could not be generated."));
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleRecord(item: ClipItem) {
    setVoiceMessage("");

    if (recordingKey === item.key && recorderRef.current) {
      const recorder = recorderRef.current;
      recorderRef.current = null;
      setRecordingKey(null);

      try {
        const { bytes } = await recorder.stop();
        await storeClip(item, bytes, "mic");
      } catch (failure) {
        setVoiceMessage(errorText(failure, "The recording could not be used."));
      }

      return;
    }

    try {
      recorderRef.current = await startRecording();
      setRecordingKey(item.key);
    } catch (failure) {
      setVoiceMessage(errorText(failure, "The microphone could not be used."));
    }
  }

  async function importClip(item: ClipItem, file: File) {
    setVoiceMessage("");

    if (file.size > MAX_CLIP_FILE_BYTES) {
      setVoiceMessage("Audio files must be under 15 MB.");
      return;
    }

    try {
      await storeClip(item, await file.arrayBuffer(), "file");
    } catch (failure) {
      setVoiceMessage(errorText(failure, "The audio file could not be used."));
    }
  }

  function clearClip(item: ClipItem) {
    setClips((current) => {
      const next = { ...current };
      delete next[item.key];
      return next;
    });
    void deleteStored(`clip:${item.key}`);
  }

  function playClip(item: ClipItem) {
    const clip = clips[item.key];
    if (!clip) return;

    try {
      clipSourceRef.current?.stop();
    } catch {
      // Already stopped.
    }

    const ctx = audioRef.current ?? new AudioContext();
    audioRef.current = ctx;
    void ctx.resume();
    const source = ctx.createBufferSource();
    source.buffer = clip.buffer;
    source.connect(ctx.destination);
    source.start();
    clipSourceRef.current = source;
  }

  function speakClip(item: ClipItem) {
    if (!speakPreview(item.script, item.lang)) setVoiceMessage("This browser has no built-in voice.");
  }

  async function loadVoiceList() {
    setLoadingVoices(true);
    setVoiceMessage("");

    try {
      const list = await listVoices(apiKey);
      setVoices(list);
      if (list.length === 0) setVoiceMessage("No voices were returned for this key.");
    } catch (failure) {
      setVoiceMessage(errorText(failure, "The voices could not be loaded."));
    } finally {
      setLoadingVoices(false);
    }
  }

  function previewVoice(lang: Lang) {
    const id = lang === "en" ? settings.voiceEn : settings.voiceAr;
    const url = voices.find((voice) => voice.id === id)?.previewUrl;
    if (url) void new Audio(url).play().catch(() => setVoiceMessage("The sample could not be played."));
  }

  // ---- Questions ----
  const usedByCategory = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const item of ALL_ITEMS) if (used.has(item.id)) counts[item.cat] = (counts[item.cat] ?? 0) + 1;

    return counts;
  }, [used]);

  function replaceQuestions(next: QuizQuestion[]) {
    const oldKeys = questions.flatMap((q) => (["en", "ar"] as const).map((l) => clipKeyQ(q.id, l)));
    setClips((current) => {
      const copy = { ...current };
      oldKeys.forEach((key) => delete copy[key]);
      return copy;
    });
    oldKeys.forEach((key) => void deleteStored(`clip:${key}`));
    setQuestions(next);
    seek(0);
  }

  function pickRandom() {
    const result = pickQuestions({
      cats: settings.bankCats,
      count: settings.pickCount,
      optionCount: settings.optionCount,
      used,
      firstId: nextIdRef.current,
    });

    if (result.questions.length === 0) {
      setBankMessage("Choose at least one topic.");
      return;
    }

    nextIdRef.current += result.questions.length + 1;
    try {
      localStorage.setItem(NEXT_ID_KEY, String(nextIdRef.current));
    } catch {
      // Ignore.
    }

    setUsed(result.nextUsed);
    replaceQuestions(result.questions);
    setBankMessage(
      `${result.questions.length} new questions picked.${result.restarted ? " You used up these topics, so the history started again." : ""}${result.questions.length < settings.pickCount ? " (Fewer than requested exist in these topics.)" : ""}`,
    );
  }

  function addQuestion() {
    setQuestions((list) =>
      list.length >= MAX_QUESTIONS ? list : [...list, blankQuestion(Math.max(0, ...list.map((q) => q.id)) + 1)],
    );
  }

  function resetQuestions() {
    if (window.confirm("Replace all questions with the 5 sample questions?")) {
      setQuestions(sampleQuestions());
      seek(0);
    }
  }

  async function chooseProfile(file: File | undefined) {
    if (!file) return;

    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 8 * 1024 * 1024) {
      setProfileError("Choose a PNG, JPG or WebP picture under 8 MB.");
      return;
    }

    try {
      const thumbnail = await squareThumbnail(file);
      setProfileSrc(thumbnail);
      setProfileError("");

      try {
        localStorage.setItem(PROFILE_KEY, thumbnail);
      } catch {
        // Works for this session.
      }
    } catch (failure) {
      setProfileError(errorText(failure, "The picture could not be used."));
    }
  }

  async function runExport() {
    pause();
    setError("");
    setStatus("");

    if (!soundReady) {
      setError("The sound is still being prepared. Try again in a moment.");
      return;
    }

    if (voiceMode !== "None" && missingClips > 0) {
      const go = window.confirm(`${missingClips} voice clip(s) are missing, so those parts will be silent. Export anyway?`);
      if (!go) return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setExporting(true);
    setProgress(0);

    try {
      const result = await exportVideo({
        makeRenderer,
        vertical: settings.vertical,
        quality: settings.quality,
        durationSec: timeline.totalMs / 1000,
        soundtrack: soundtrack?.buffer ?? null,
        signal: controller.signal,
        onProgress: setProgress,
      });

      if (!result) {
        setError("This browser cannot encode video. Please use a recent Chrome or Edge.");
      } else {
        download(result.blob, settings.language === "Arabic" ? "quizzy-arabic.webm" : "quizzy-english.webm");
        setStatus(`Done: ${(result.blob.size / 1024 / 1024).toFixed(1)} MB (${result.codec}${result.hasAudio ? ", with sound" : ", no sound"}).`);
      }
    } catch (failure) {
      setError(errorText(failure, "The export failed."));
    } finally {
      setExporting(false);
      abortRef.current = null;
    }
  }

  function saveThumbnail() {
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const slot = timeline.slots[0];
    makeRenderer(1280, 720).drawFrame(ctx, slot ? slot.countStart + 300 : 0);
    canvas.toBlob((blob) => {
      if (blob) download(blob, "quizzy-thumbnail.png");
    }, "image/png");
  }

  const soundMessage = musicLoading ? "Preparing music…" : !soundReady ? "Preparing sound…" : "";

  return (
    <div className="app">
      <header className="top">
        <h1>Quizzy Studio</h1>
        <p>Multiple-choice quiz videos with a countdown, voice in Arabic and English, and a comment call at the end.</p>
      </header>

      <main className="layout">
        <section className="panel">
          <h2>1. Questions</h2>
          <BankPanel
            selected={settings.bankCats}
            total={BANK_TOTALS}
            used={usedByCategory}
            pickCount={settings.pickCount}
            maxCount={MAX_QUESTIONS}
            optionCount={settings.optionCount}
            message={bankMessage}
            onSelected={(next) => update({ bankCats: next })}
            onPickCount={(value) => update({ pickCount: value })}
            onOptionCount={(value) => update({ optionCount: value === 4 ? 4 : 3 })}
            onPick={pickRandom}
            onResetHistory={() => {
              setUsed(new Set());
              setBankMessage("History cleared.");
            }}
          />
          <h3>Questions of this video (editable)</h3>
          <QuestionEditor
            questions={questions}
            lastIsComment={settings.lastIsComment}
            defaultSeconds={settings.seconds}
            onChange={setQuestions}
            onAdd={addQuestion}
            onReset={resetQuestions}
          />
          <p className="hint">Check every fact yourself before publishing; the sample questions are only examples.</p>

          <h2>2. Timing</h2>
          <label htmlFor="seconds">Countdown for each question: {settings.seconds} seconds</label>
          <input
            id="seconds"
            type="range"
            min={MIN_SECONDS}
            max={MAX_SECONDS}
            value={settings.seconds}
            onChange={(e) => update({ seconds: Number(e.target.value) })}
          />
          <p className="hint">You can give any single question its own countdown in the list above.</p>
          <label className="check">
            <input type="checkbox" checked={settings.lastIsComment} onChange={(e) => update({ lastIsComment: e.target.checked })} />
            Last question: do not show the answer, ask viewers to answer in the comments
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.intro} onChange={(e) => update({ intro: e.target.checked })} />
            Show a title card at the start (off = the first question starts at once)
          </label>

          <h2>3. Language and voice</h2>
          <label htmlFor="language">Video language (screen and voice use the same language)</label>
          <select id="language" value={settings.language} onChange={(e) => update({ language: e.target.value === "Arabic" ? "Arabic" : "English" })}>
            <option value="English">English</option>
            <option value="Arabic">العربية (Arabic)</option>
          </select>
          <p className="hint">Make one video per language: switch the language and export again. The questions already hold both versions.</p>
          <label className="check">
            <input type="checkbox" checked={settings.narrator} onChange={(e) => update({ narrator: e.target.checked })} />
            Narrator reads the question
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.readOptions} onChange={(e) => update({ readOptions: e.target.checked })} />
            The narrator also reads the options (A, B, C)
          </label>

          {voiceMode !== "None" ? (
            <VoicePanel
              items={clipItems}
              clips={clips}
              busyKey={busyKey}
              recordingKey={recordingKey}
              message={voiceMessage}
              apiKey={apiKey}
              remember={remember}
              voices={voices}
              loadingVoices={loadingVoices}
              voiceEn={settings.voiceEn}
              voiceAr={settings.voiceAr}
              lang={lang}
              onApiKey={setApiKey}
              onRemember={setRemember}
              onLoadVoices={() => void loadVoiceList()}
              onVoice={(lang, id) => update(lang === "en" ? { voiceEn: id } : { voiceAr: id })}
              onPreviewVoice={previewVoice}
              onGenerate={(item) => void generate(item)}
              onGenerateAll={() => void generateAll()}
              onRecord={(item) => void toggleRecord(item)}
              onImport={(item, file) => void importClip(item, file)}
              onClear={clearClip}
              onPlay={playClip}
              onSpeak={speakClip}
            />
          ) : null}

          <h2>4. Look and sound</h2>
          <div className="row">
            <div>
              <label htmlFor="ratio">Format</label>
              <select id="ratio" value={settings.vertical ? "v" : "h"} onChange={(e) => update({ vertical: e.target.value === "v" })}>
                <option value="v">Vertical 9:16 (Reels, Shorts, TikTok)</option>
                <option value="h">Landscape 16:9 (YouTube)</option>
              </select>
            </div>
            <div>
              <label htmlFor="quality">Quality</label>
              <select id="quality" value={settings.quality} onChange={(e) => update({ quality: e.target.value === "1080p" ? "1080p" : "720p" })}>
                <option value="720p">720p (faster)</option>
                <option value="1080p">1080p (sharper)</option>
              </select>
            </div>
          </div>
          <div className="row">
            <div>
              <label htmlFor="background">Background</label>
              <select id="background" value={settings.background} onChange={(e) => isBackgroundPreset(e.target.value) && update({ background: e.target.value })}>
                {BACKGROUND_OPTIONS.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="music">Music</label>
              <select
                id="music"
                value={settings.music}
                onChange={(e) => (e.target.value === "none" || isMusicTrackId(e.target.value)) && update({ music: e.target.value })}
              >
                <option value="none">No music</option>
                {GENERATED_TRACKS.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label htmlFor="volume">Music volume: {Math.round(settings.musicVolume * 100)}% (it gets quieter by itself while the narrator speaks)</label>
          <input id="volume" type="range" min={0} max={1} step={0.05} value={settings.musicVolume} onChange={(e) => update({ musicVolume: Number(e.target.value) })} />
          {music.status === "error" ? <p className="error">{music.message}</p> : null}
          <label className="check">
            <input type="checkbox" checked={settings.effects} onChange={(e) => update({ effects: e.target.checked })} />
            Sound effects (clock ticks, answer chime)
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.showMascot} onChange={(e) => update({ showMascot: e.target.checked })} />
            Show the little mascot
          </label>

          <details>
            <summary>Change the title, comment and ending texts</summary>
            {(
              [
                ["titleEn", "titleAr", "Title card", TEXTS.en.title, TEXTS.ar.title],
                ["commentEn", "commentAr", "Comment call (last question)", TEXTS.en.comment, TEXTS.ar.comment],
                ["outroEn", "outroAr", "Ending card", TEXTS.en.outro, TEXTS.ar.outro],
              ] as const
            ).map(([enKey, arKey, label, enDefault, arDefault]) => (
              <div key={enKey} className="row">
                <div>
                  <label htmlFor={enKey}>{label} (English)</label>
                  <input id={enKey} maxLength={60} value={settings[enKey]} placeholder={enDefault} onChange={(e) => update({ [enKey]: e.target.value })} />
                </div>
                <div>
                  <label htmlFor={arKey}>{label} (العربية)</label>
                  <input id={arKey} dir="rtl" maxLength={60} value={settings[arKey]} placeholder={arDefault} onChange={(e) => update({ [arKey]: e.target.value })} />
                </div>
              </div>
            ))}
          </details>

          <h2>5. My account</h2>
          <label className="check">
            <input type="checkbox" checked={settings.showBadge} onChange={(e) => update({ showBadge: e.target.checked })} />
            Show my account (name and picture) in the video
          </label>
          {settings.showBadge ? (
            <>
              <div className="badge-preview">
                <img src={profileSrc} alt="Profile" />
                <button type="button" className="ghost" onClick={() => profileInputRef.current?.click()}>
                  Change picture
                </button>
                <input
                  ref={profileInputRef}
                  type="file"
                  hidden
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    void chooseProfile(file);
                  }}
                />
              </div>
              {profileError ? <p className="error">{profileError}</p> : null}
              <div className="row">
                <div>
                  <label htmlFor="badge-name">Account name</label>
                  <input id="badge-name" value={settings.badgeName} maxLength={MAX_BADGE_NAME} onChange={(e) => update({ badgeName: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="badge-position">Position</label>
                  <select id="badge-position" value={settings.badgePosition} onChange={(e) => isBadgePosition(e.target.value) && update({ badgePosition: e.target.value })}>
                    {BADGE_POSITIONS.map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          ) : null}
        </section>

        <section className="panel preview-panel">
          <h2>Preview</h2>
          <canvas ref={canvasRef} className={settings.vertical ? "preview vertical" : "preview landscape"} aria-label="Video preview" />

          <div className="player">
            <button type="button" className="primary" disabled={exporting} onClick={() => (playing ? pause() : setPlaying(true))}>
              {playing ? "Pause" : timeMs >= timeline.totalMs ? "Replay" : "Play"}
            </button>
            <input
              type="range"
              aria-label="Position"
              min={0}
              max={timeline.totalMs}
              value={Math.min(timeMs, timeline.totalMs)}
              onChange={(e) => {
                pause();
                seek(Number(e.target.value));
              }}
            />
            <span className="time">
              {formatTime(timeMs)} / {formatTime(timeline.totalMs)}
            </span>
          </div>
          {soundMessage ? <p className="hint">{soundMessage}</p> : null}
          {voiceMode !== "None" && missingClips > 0 ? (
            <p className="warning">{missingClips} voice clip(s) are missing; the preview and export are silent there.</p>
          ) : null}
          {staleClips > 0 ? <p className="warning">{staleClips} voice clip(s) were made for an older text. Redo them.</p> : null}

          <div className="actions">
            {exporting ? (
              <button type="button" className="ghost" onClick={() => abortRef.current?.abort()}>
                Cancel ({Math.round(progress * 100)}%)
              </button>
            ) : (
              <button type="button" className="primary big" disabled={!exportSupported() || !soundReady} onClick={() => void runExport()}>
                Export video (WebM)
              </button>
            )}
            <button type="button" className="ghost" onClick={saveThumbnail}>
              Save thumbnail (PNG)
            </button>
          </div>
          {exporting ? <progress className="bar" max={1} value={progress} /> : null}
          {!exportSupported() ? <p className="error">Video export needs a recent Chrome or Edge.</p> : null}
          {status ? <p className="ok">{status}</p> : null}
          {error ? <p className="error">{error}</p> : null}
          <p className="hint">Length: {formatTime(timeline.totalMs)}. The file is WebM with sound; YouTube and Facebook accept it.</p>
        </section>
      </main>
    </div>
  );
}
