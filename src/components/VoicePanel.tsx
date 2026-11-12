import { useRef, type ChangeEvent } from "react";
import type { Lang } from "../quiz/questions";
import type { VoiceInfo } from "../voice/elevenlabs";

export type ClipEntry = { buffer: AudioBuffer; script: string; source: "voice" | "mic" | "file" };
export type ClipItem = { key: string; label: string; lang: Lang; script: string };

type Props = {
  items: ClipItem[];
  clips: Record<string, ClipEntry>;
  busyKey: string | null;
  recordingKey: string | null;
  message: string;
  apiKey: string;
  remember: boolean;
  voices: VoiceInfo[];
  loadingVoices: boolean;
  voiceEn: string;
  voiceAr: string;
  lang: Lang;
  onApiKey: (value: string) => void;
  onRemember: (value: boolean) => void;
  onLoadVoices: () => void;
  onVoice: (lang: Lang, id: string) => void;
  onPreviewVoice: (lang: Lang) => void;
  onGenerate: (item: ClipItem) => void;
  onGenerateAll: () => void;
  onRecord: (item: ClipItem) => void;
  onImport: (item: ClipItem, file: File) => void;
  onClear: (item: ClipItem) => void;
  onPlay: (item: ClipItem) => void;
  onSpeak: (item: ClipItem) => void;
};

const SOURCE_LABEL = { voice: "AI voice", mic: "my recording", file: "imported file" } as const;

function ClipRow({ item, props }: { item: ClipItem; props: Props }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const clip = props.clips[item.key];
  const stale = clip !== undefined && clip.script !== item.script;
  const recording = props.recordingKey === item.key;
  const busy = props.busyKey === item.key || props.busyKey === "all";
  const empty = item.script.trim().length === 0;

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) props.onImport(item, file);
  }

  return (
    <li className="clip">
      <div className="clip-head">
        <strong>{item.label}</strong>
        <span className={clip ? (stale ? "tag warn" : "tag good") : "tag"}>
          {clip
            ? `${clip.buffer.duration.toFixed(1)} s · ${SOURCE_LABEL[clip.source]}${stale ? " · text changed, redo it" : ""}`
            : "no voice yet"}
        </span>
      </div>
      <p className="clip-script" dir={item.lang === "ar" ? "rtl" : "ltr"}>
        {item.script || "(empty)"}
      </p>
      <div className="clip-actions">
        <button type="button" className="ghost small" disabled={!clip} onClick={() => props.onPlay(item)}>
          ▶ Play
        </button>
        <button
          type="button"
          className="ghost small"
          disabled={busy || empty || !props.apiKey || (item.lang === "en" ? !props.voiceEn : !props.voiceAr)}
          onClick={() => props.onGenerate(item)}
        >
          {busy ? "Working…" : "AI voice"}
        </button>
        <button
          type="button"
          className={recording ? "ghost small rec" : "ghost small"}
          disabled={busy || (props.recordingKey !== null && !recording)}
          onClick={() => props.onRecord(item)}
        >
          {recording ? "■ Stop" : "● Record"}
        </button>
        <button type="button" className="ghost small" disabled={busy} onClick={() => fileRef.current?.click()}>
          Import
        </button>
        <input ref={fileRef} type="file" hidden accept="audio/*" onChange={pick} />
        <button type="button" className="ghost small" disabled={empty} onClick={() => props.onSpeak(item)}>
          Browser voice (listen only)
        </button>
        <button type="button" className="icon" aria-label={`Remove voice ${item.label}`} disabled={!clip} onClick={() => props.onClear(item)}>
          ✕
        </button>
      </div>
    </li>
  );
}

export default function VoicePanel(props: Props) {
  const { voices } = props;

  return (
    <div className="voice-panel">
      <p className="hint">
        Professional voices come from ElevenLabs with your own API key (the free plan has a monthly
        allowance). Every clip is saved on this computer, so you never pay twice for the same text. You can
        also record your own voice or import an audio file for any clip.
      </p>

      <div className="row">
        <div>
          <label htmlFor="apikey">ElevenLabs API key</label>
          <input
            id="apikey"
            type="password"
            autoComplete="off"
            value={props.apiKey}
            onChange={(event) => props.onApiKey(event.target.value.trim())}
            placeholder="paste your key"
          />
        </div>
        <div className="align-end">
          <button
            type="button"
            className="ghost"
            disabled={!props.apiKey || props.loadingVoices}
            onClick={props.onLoadVoices}
          >
            {props.loadingVoices ? "Loading…" : "Load my voices"}
          </button>
        </div>
      </div>
      <label className="check">
        <input type="checkbox" checked={props.remember} onChange={(event) => props.onRemember(event.target.checked)} />
        Remember the key on this computer (leave off on a shared computer)
      </label>

      {voices.length > 0 ? (
        <div className="row single">
          {([props.lang] as const).map((lang) => (
            <div key={lang}>
              <label htmlFor={`voice-${lang}`}>{lang === "en" ? "English voice" : "Arabic voice"}</label>
              <div className="inline">
                <select
                  id={`voice-${lang}`}
                  value={lang === "en" ? props.voiceEn : props.voiceAr}
                  onChange={(event) => props.onVoice(lang, event.target.value)}
                >
                  <option value="">Choose…</option>
                  {voices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name}
                      {voice.description ? ` (${voice.description})` : ""}
                    </option>
                  ))}
                </select>
                <button type="button" className="ghost small" onClick={() => props.onPreviewVoice(lang)}>
                  ▶
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {props.message ? <p className="hint">{props.message}</p> : null}

      <div className="actions">
        <button
          type="button"
          className="primary"
          disabled={!props.apiKey || !(props.lang === "en" ? props.voiceEn : props.voiceAr) || props.busyKey !== null || props.items.length === 0}
          onClick={props.onGenerateAll}
        >
          Generate all missing voices
        </button>
      </div>

      <ul className="clips">
        {props.items.map((item) => (
          <ClipRow key={item.key} item={item} props={props} />
        ))}
      </ul>
    </div>
  );
}
