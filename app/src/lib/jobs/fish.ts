// Voice cloning and speech in the cloned voice, through the Fish Audio API.
// Keep free of "@/..." imports.

const FISH_URL = "https://api.fish.audio";

function key(): string {
  const k = process.env["FISH_AUDIO_API_KEY"];
  if (!k)
    throw new Error(
      "Voice cloning is not configured yet: add FISH_AUDIO_API_KEY in Netlify's environment variables.",
    );
  return k;
}

export function fishConfigured(): boolean {
  return Boolean(process.env["FISH_AUDIO_API_KEY"]);
}

async function fishError(res: Response, what: string): Promise<Error> {
  const body = await res.text().catch(() => "");
  console.error(`Fish Audio ${what} failed [${res.status}]: ${body.slice(0, 500)}`);
  if (res.status === 401 || res.status === 403)
    return new Error("The Fish Audio API key is missing or invalid.");
  if (res.status === 402)
    return new Error("Your Fish Audio balance is used up. Top up your Fish Audio account.");
  if (res.status === 429) return new Error("Fish Audio is busy. Try again in a minute.");
  return new Error(`${what} failed (${res.status}). Try again.`);
}

/** Creates a private voice model from the user's own recording. Returns its id. */
export async function createVoiceModel(sample: Blob, title: string): Promise<string> {
  const form = new FormData();
  form.append("type", "tts");
  form.append("title", title);
  form.append("visibility", "private");
  form.append("train_mode", "fast");
  form.append("enhance_audio_quality", "true");
  form.append("voices", sample, "sample.wav");
  const res = await fetch(`${FISH_URL}/model`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}` },
    body: form,
  });
  if (!res.ok) throw await fishError(res, "Voice cloning");
  const json = (await res.json()) as { _id?: string; id?: string };
  const id = json._id ?? json.id;
  if (!id) throw new Error("Fish Audio did not return a voice id.");
  return id;
}

/** Split long narration at sentence boundaries to keep each request short. */
function chunkText(text: string, max = 1800): string[] {
  const sentences = text.match(/[^.!?।]+[.!?।]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    if ((current + s).length > max && current) {
      chunks.push(current.trim());
      current = "";
    }
    current += s;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/** MP3 narration in the cloned voice. */
export async function fishSpeech(text: string, voiceId: string): Promise<Uint8Array> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key()}`,
    "Content-Type": "application/json",
  };
  // Optional: pin a Fish Audio model; otherwise Fish Audio's default is used.
  const model = process.env["FISH_AUDIO_MODEL"];
  if (model) headers["model"] = model;

  const parts: Uint8Array[] = [];
  for (const chunk of chunkText(text)) {
    const res = await fetch(`${FISH_URL}/v1/tts`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text: chunk, reference_id: voiceId, format: "mp3" }),
    });
    if (!res.ok) throw await fishError(res, "Voiceover");
    parts.push(new Uint8Array(await res.arrayBuffer()));
  }
  // MP3 frames can be joined end to end.
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
