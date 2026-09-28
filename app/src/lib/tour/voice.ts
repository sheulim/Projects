// Plays the tour narration. First choice: a natural AI voice from the tour-voice Netlify
// function (recorded once, then served from Netlify's cache). Fallback: the browser's own voice.
// Browsers only allow sound that starts from a tap, so unlockVoice() must run inside the click
// that starts the tour; after that, later lines can play on their own.
import { lineVersion, type TourStep } from "./script";

export type VoiceEvents = {
  onStart: () => void;
  onEnd: () => void;
  /** The browser blocked or never started the sound; the user must press Play. */
  onBlocked: (reason: "blocked" | "silent" | "unsupported") => void;
};

let audio: HTMLAudioElement | null = null;
let serverVoice: boolean | null = null; // null = not tried yet
let token = 0;
let keepAlive: ReturnType<typeof setInterval> | undefined;
const timers: Array<ReturnType<typeof setTimeout>> = [];

function synth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window
    ? window.speechSynthesis
    : null;
}

/** A tiny silent WAV, used to unlock audio playback inside the user's tap. */
function silentWav(): string {
  const samples = 800;
  const buf = new ArrayBuffer(44 + samples);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + samples, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  w(36, "data");
  v.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) v.setUint8(44 + i, 128);
  let bin = "";
  new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
  return `data:audio/wav;base64,${btoa(bin)}`;
}

export function unlockVoice() {
  if (typeof window === "undefined") return;
  try {
    audio ??= new Audio();
    audio.src = silentWav();
    void audio.play().catch(() => undefined);
  } catch {
    /* ignore */
  }
  const s = synth();
  if (s) {
    try {
      if (s.speaking || s.pending) s.cancel();
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      s.speak(u);
      s.resume();
    } catch {
      /* ignore */
    }
  }
}

export function voiceUrl(step: TourStep): string {
  return `/.netlify/functions/tour-voice?id=${encodeURIComponent(step.id)}&v=${lineVersion(step.say)}`;
}

/** Ask the server to record the next line early, so it plays without a wait. */
export function prefetchLine(step: TourStep | undefined) {
  if (!step || serverVoice === false || typeof fetch === "undefined") return;
  void fetch(voiceUrl(step)).catch(() => undefined);
}

export function stopVoice() {
  token++;
  timers.splice(0).forEach(clearTimeout);
  clearInterval(keepAlive);
  if (audio) {
    audio.onplaying = audio.onended = audio.onerror = null;
    audio.pause();
  }
  const s = synth();
  if (s && (s.speaking || s.pending)) s.cancel();
}

function later(fn: () => void, ms: number) {
  timers.push(setTimeout(fn, ms));
}

export function speakLine(step: TourStep, ev: VoiceEvents) {
  stopVoice();
  const my = token;
  if (serverVoice !== false && audio) {
    const a = audio;
    let started = false;
    const fallback = () => {
      if (my !== token || started) return;
      serverVoice = false;
      a.onplaying = a.onended = a.onerror = null;
      a.pause();
      browserSpeak(step, ev, my);
    };
    a.onplaying = () => {
      if (my !== token) return;
      started = true;
      serverVoice = true;
      ev.onStart();
    };
    a.onended = () => my === token && ev.onEnd();
    a.onerror = fallback;
    a.src = voiceUrl(step);
    a.play().catch((e: unknown) => {
      if (my !== token) return;
      if (e instanceof DOMException && e.name === "NotAllowedError") ev.onBlocked("blocked");
      else fallback();
    });
    // The first recording of a line can take a few seconds; after that, use the browser voice.
    later(fallback, 9000);
    return;
  }
  browserSpeak(step, ev, my);
}

function pickVoice(s: SpeechSynthesis): SpeechSynthesisVoice | null {
  const vs = s.getVoices();
  return (
    vs.find((v) => /en-IN/i.test(v.lang)) ??
    vs.find((v) => /^en-GB/i.test(v.lang)) ??
    vs.find((v) => /^en/i.test(v.lang)) ??
    null
  );
}

function browserSpeak(step: TourStep, ev: VoiceEvents, my: number) {
  const s = synth();
  if (!s) {
    ev.onBlocked("unsupported");
    return;
  }
  const u = new SpeechSynthesisUtterance(step.say);
  const voice = pickVoice(s);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? "en-IN";
  u.rate = 0.98;
  let started = false;
  u.onstart = () => {
    if (my !== token) return;
    started = true;
    ev.onStart();
    // Chrome on computers stops speech that runs longer than about 15 seconds; nudge it.
    if (!/android/i.test(navigator.userAgent)) {
      keepAlive = setInterval(() => {
        if (s.speaking) {
          s.pause();
          s.resume();
        }
      }, 9000);
    }
  };
  u.onend = () => {
    if (my !== token) return;
    clearInterval(keepAlive);
    ev.onEnd();
  };
  u.onerror = (e) => {
    if (my !== token || e.error === "interrupted" || e.error === "canceled") return;
    clearInterval(keepAlive);
    ev.onBlocked(e.error === "not-allowed" ? "blocked" : "silent");
  };
  s.speak(u);
  s.resume();
  later(() => {
    if (my === token && !started) ev.onBlocked("silent");
  }, 3500);
}
