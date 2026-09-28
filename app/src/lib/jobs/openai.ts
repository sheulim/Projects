// Images and voiceover through the OpenAI REST API. Model names are configurable through
// Netlify environment variables so they can be changed without a code release.
// Keep free of "@/..." imports.

const OPENAI_URL = "https://api.openai.com/v1";

function key(): string {
  const k = process.env["OPENAI_API_KEY"];
  if (!k)
    throw new Error(
      "Images and voiceover are not configured yet: add OPENAI_API_KEY in Netlify's environment variables.",
    );
  return k;
}

async function openaiError(res: Response, what: string): Promise<Error> {
  const body = await res.text().catch(() => "");
  console.error(`OpenAI ${what} failed [${res.status}]: ${body.slice(0, 500)}`);
  if (res.status === 401) return new Error("The OpenAI API key is missing or invalid.");
  if (res.status === 429)
    return new Error(
      "OpenAI rate limit or quota reached. Check your OpenAI billing and try again.",
    );
  if (res.status === 400 && /safety|policy/i.test(body))
    return new Error(
      "The image request was blocked by OpenAI's safety system. Edit the image prompt and try again.",
    );
  return new Error(`${what} failed (${res.status}). Try again.`);
}

const SIZES = { square: "1024x1024", portrait: "1024x1536", landscape: "1536x1024" } as const;

export async function generateImage(
  prompt: string,
  orientation: keyof typeof SIZES,
): Promise<Uint8Array> {
  const res = await fetch(`${OPENAI_URL}/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env["OPENAI_IMAGE_MODEL"] || "gpt-image-1",
      prompt: `${prompt}\nNo text, letters, watermarks or logos in the image.`,
      size: SIZES[orientation],
      n: 1,
    }),
  });
  if (!res.ok) throw await openaiError(res, "Image generation");
  const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const first = json.data?.[0];
  if (first?.b64_json) return Uint8Array.from(Buffer.from(first.b64_json, "base64"));
  if (first?.url) {
    const img = await fetch(first.url);
    if (!img.ok) throw new Error("Could not download the generated image.");
    return new Uint8Array(await img.arrayBuffer());
  }
  throw new Error("OpenAI returned no image.");
}

/** Split long narration at sentence boundaries so each request stays under the speech input limit. */
function chunkText(text: string, max = 3500): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
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

export async function generateSpeech(text: string): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  for (const chunk of chunkText(text)) {
    const res = await fetch(`${OPENAI_URL}/audio/speech`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env["OPENAI_TTS_MODEL"] || "gpt-4o-mini-tts",
        voice: process.env["OPENAI_TTS_VOICE"] || "alloy",
        input: chunk,
        response_format: "mp3",
      }),
    });
    if (!res.ok) throw await openaiError(res, "Voiceover");
    parts.push(new Uint8Array(await res.arrayBuffer()));
  }
  // MP3 frames can be joined end to end.
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
