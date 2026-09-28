import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod/v4";

export const CLAUDE_MODEL = "claude-opus-5";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env["ANTHROPIC_API_KEY"]) {
    throw new Error(
      "AI is not configured yet: add ANTHROPIC_API_KEY in Netlify's environment variables.",
    );
  }
  client ??= new Anthropic();
  return client;
}

type GenerateOptions<S extends z.ZodType> = {
  system: string;
  prompt: string;
  schema: S;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
};

/**
 * One structured Claude call. Returns data validated against `schema`.
 * Uses server-side refusal fallbacks so a declined request is retried on Anthropic's
 * recommended fallback model instead of failing outright.
 */
export async function generateStructured<S extends z.ZodType>(
  opts: GenerateOptions<S>,
): Promise<z.infer<S>> {
  const anthropic = getClient();
  let response;
  try {
    response = await anthropic.beta.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: opts.maxTokens ?? 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: opts.effort ?? "low", format: betaZodOutputFormat(opts.schema) },
      system: opts.system,
      messages: [{ role: "user", content: opts.prompt }],
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError)
      throw new Error("Too many requests right now. Try again in a minute.");
    if (error instanceof Anthropic.AuthenticationError)
      throw new Error("The Anthropic API key is missing or invalid.");
    if (error instanceof Anthropic.APIConnectionError)
      throw new Error("Could not reach the AI service. Try again.");
    if (error instanceof Anthropic.APIError) {
      console.error("Claude API error", error.status, error.message);
      throw new Error(
        `The AI service returned an error (${error.status ?? "unknown"}). Try again.`,
      );
    }
    throw error;
  }

  if (response.stop_reason === "refusal") {
    throw new Error("The AI declined this request. Rephrase the brief and try again.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error(
      "The AI response was cut short. Try again with fewer channels or a shorter brief.",
    );
  }
  if (!response.parsed_output) {
    throw new Error("The AI response came back in an unexpected format. Try again.");
  }
  return response.parsed_output as z.infer<S>;
}

/** Company DNA rendered as prompt text. Empty string when the user has not set one up. */
export function brandDnaPrompt(
  dna: {
    brand_name: string;
    voice: string;
    phrases_use: string;
    words_avoid: string;
    facts: string;
    persona: string;
    example_post: string;
    disclaimer: string;
    languages: string;
  } | null,
): string {
  if (!dna) return "";
  const lines = [
    dna.brand_name && `Brand: ${dna.brand_name}`,
    dna.voice && `Voice: ${dna.voice}`,
    dna.phrases_use && `Phrases to use where natural: ${dna.phrases_use}`,
    dna.words_avoid && `Never use these words or claims: ${dna.words_avoid}`,
    dna.facts &&
      `Approved facts (the ONLY prices, offers and product claims you may state): ${dna.facts}`,
    dna.persona && `Audience persona: ${dna.persona}`,
    dna.example_post && `Example of the brand's voice: ${dna.example_post}`,
    dna.disclaimer && `Add this disclaimer to any post that mentions an offer: ${dna.disclaimer}`,
    dna.languages && `Content languages: ${dna.languages}`,
  ].filter(Boolean);
  return lines.length ? `\n\nCOMPANY DNA (follow strictly):\n${lines.join("\n")}` : "";
}
