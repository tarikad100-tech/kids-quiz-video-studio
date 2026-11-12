/** Decodes recorded or imported audio into a stereo-capable AudioBuffer at 44.1 kHz. */
export async function decodeAudio(bytes: ArrayBuffer): Promise<AudioBuffer> {
  if (typeof OfflineAudioContext === "undefined") {
    throw new Error("This browser does not support Web Audio.");
  }

  try {
    // decodeAudioData detaches the buffer, so give it a copy.
    return await new OfflineAudioContext(2, 1, 44100).decodeAudioData(bytes.slice(0));
  } catch {
    throw new Error("This audio could not be decoded. Try an MP3, WAV, OGG or M4A file.");
  }
}

export const MAX_CLIP_SECONDS = 40;
export const MAX_CLIP_FILE_BYTES = 15 * 1024 * 1024;

export type Recording = { stop: () => Promise<{ bytes: ArrayBuffer; mime: string }>; cancel: () => void };

/** Starts recording the microphone. Rejects if the permission is refused. */
export async function startRecording(): Promise<Recording> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    throw new Error("Recording is not supported in this browser.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  });
  const recorder = new MediaRecorder(stream);
  const parts: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) parts.push(event.data);
  };
  recorder.start();

  const release = () => stream.getTracks().forEach((track) => track.stop());

  return {
    stop: () =>
      new Promise((resolve, reject) => {
        recorder.onstop = () => {
          release();
          const blob = new Blob(parts, { type: recorder.mimeType });
          blob.arrayBuffer().then((bytes) => resolve({ bytes, mime: blob.type }), reject);
        };
        recorder.stop();
      }),
    cancel: () => {
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
      release();
    },
  };
}

/** Browser voice, for listening while editing only. It is never put into the video. */
export function speakPreview(text: string, lang: "en" | "ar"): boolean {
  if (typeof speechSynthesis === "undefined") return false;

  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === "ar" ? "ar-SA" : "en-US";
  speechSynthesis.speak(utterance);

  return true;
}

export function stopPreviewSpeech() {
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}
