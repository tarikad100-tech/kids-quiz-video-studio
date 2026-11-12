import { hashText, loadStored, saveStored } from "./store";

/*
 * ElevenLabs text-to-speech through the browser, with the person's own API key.
 * NOT TESTED by the author (no internet access when this was written): check
 * the status messages the app shows if something fails.
 */

const API = "https://api.elevenlabs.io/v1";
export const MODEL_ID = "eleven_multilingual_v2";

export type VoiceInfo = {
  id: string;
  name: string;
  previewUrl: string | null;
  description: string;
};

async function failure(response: Response): Promise<Error> {
  let message = "";

  try {
    const body: unknown = await response.json();
    const detail = (body as { detail?: unknown }).detail;

    if (typeof detail === "string") message = detail;
    else if (typeof detail === "object" && detail !== null) {
      const text = (detail as { message?: unknown }).message;
      if (typeof text === "string") message = text;
    }
  } catch {
    // No JSON body.
  }

  if (response.status === 401) return new Error("The API key was not accepted (401). Check it and try again.");
  if (response.status === 402 || response.status === 429) {
    return new Error(`Quota or plan limit reached (${response.status}). ${message}`.trim());
  }

  return new Error(`ElevenLabs error ${response.status}. ${message}`.trim());
}

export async function listVoices(apiKey: string): Promise<VoiceInfo[]> {
  const response = await fetch(`${API}/voices`, { headers: { "xi-api-key": apiKey } });
  if (!response.ok) throw await failure(response);

  const body = (await response.json()) as { voices?: unknown };
  const list = Array.isArray(body.voices) ? body.voices : [];
  const voices: VoiceInfo[] = [];

  for (const item of list) {
    if (typeof item !== "object" || item === null) continue;

    const v = item as Record<string, unknown>;
    if (typeof v.voice_id !== "string" || typeof v.name !== "string") continue;

    const labels = typeof v.labels === "object" && v.labels !== null ? (v.labels as Record<string, unknown>) : {};
    const description = [labels.gender, labels.accent, labels.age, labels.descriptive]
      .filter((part): part is string => typeof part === "string")
      .join(", ");

    voices.push({
      id: v.voice_id,
      name: v.name,
      previewUrl: typeof v.preview_url === "string" ? v.preview_url : null,
      description,
    });
  }

  return voices;
}

/** Returns MP3 bytes. The same voice + text is served from the saved cache. */
export async function synthesize(apiKey: string, voiceId: string, text: string): Promise<ArrayBuffer> {
  const cacheKey = `tts:${hashText(`${voiceId}|${MODEL_ID}|${text}`)}`;
  const cached = await loadStored(cacheKey);
  if (cached) return cached.bytes;

  const response = await fetch(`${API}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: { stability: 0.55, similarity_boost: 0.75 },
    }),
  });

  if (!response.ok) throw await failure(response);

  const bytes = await response.arrayBuffer();
  await saveStored(cacheKey, { bytes, script: text, source: "voice" });

  return bytes;
}
