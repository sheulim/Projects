// Natural AI narration for the guided tour. Only lines from the tour script can be voiced,
// and each recording is cached by Netlify's CDN, so every line is generated only once.
import { TOUR_STEPS } from "../../src/lib/tour/script";

export default async (req: Request) => {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const step = TOUR_STEPS.find((s) => s.id === id);
  if (!step) return new Response("Unknown line", { status: 404 });

  const key = process.env["OPENAI_API_KEY"];
  // Without a key, the browser's own voice reads the tour instead.
  if (!key) return new Response("Voice not configured", { status: 404 });

  const model = process.env["OPENAI_TTS_MODEL"] || "gpt-4o-mini-tts";
  const body: Record<string, unknown> = {
    model,
    voice: process.env["OPENAI_TOUR_VOICE"] || process.env["OPENAI_TTS_VOICE"] || "alloy",
    input: step.say,
    response_format: "mp3",
  };
  if (model === "gpt-4o-mini-tts") {
    body["instructions"] =
      "Speak as a warm, friendly guide showing a first-time visitor around a website. Calm, clear and unhurried.";
  }

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`tour-voice ${id}: OpenAI ${res.status} ${(await res.text()).slice(0, 300)}`);
    return new Response("Voice unavailable", { status: 502 });
  }

  return new Response(await res.arrayBuffer(), {
    headers: {
      "Content-Type": "audio/mpeg",
      // Browsers keep it for a day; Netlify's CDN keeps it until the line's text changes
      // (the text version is part of the URL).
      "Cache-Control": "public, max-age=86400",
      "Netlify-CDN-Cache-Control": "public, durable, max-age=31536000, immutable",
    },
  });
};
