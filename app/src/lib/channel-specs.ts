// Channel Studio: what each channel produces. Shared by the UI and the background AI jobs,
// so keep this file free of "@/..." imports.
import { z } from "zod/v4";

const scene = z.object({
  seconds: z.number().describe("Length of the scene in seconds"),
  visual: z.string().describe("What is on screen"),
  on_screen_text: z.string().describe("Short caption burned into the video"),
  voiceover: z.string().describe("What the narrator says during this scene"),
});

export const CHANNELS = {
  instagram: {
    label: "Instagram",
    media: ["image", "voice", "video"] as const,
    guidance:
      "An Instagram Reel of 20-30 seconds in 4-6 scenes with a strong hook in the first 2 seconds, plus a feed caption (under 2,200 characters, first line is the hook), 5-12 relevant hashtags, and one image prompt for the cover or feed post.",
    schema: z.object({
      caption: z.string(),
      hashtags: z.array(z.string()),
      reel_scenes: z.array(scene),
      cta: z.string(),
      image_prompt: z.string().describe("Prompt for a square or 4:5 image, no text in the image"),
    }),
  },
  facebook: {
    label: "Facebook",
    media: ["image"] as const,
    guidance:
      "A Facebook post of 60-150 words that starts a conversation, a link headline of under 40 characters, and an image prompt.",
    schema: z.object({
      post: z.string(),
      link_headline: z.string(),
      image_prompt: z.string(),
    }),
  },
  linkedin: {
    label: "LinkedIn",
    media: ["image"] as const,
    guidance:
      "A professional LinkedIn post of 120-250 words with a hook line, short paragraphs and a clear call to action; a 5-7 slide document carousel (title and one or two sentences per slide); and an image prompt.",
    schema: z.object({
      post: z.string(),
      carousel_slides: z.array(z.object({ title: z.string(), body: z.string() })),
      image_prompt: z.string(),
    }),
  },
  x: {
    label: "X",
    media: ["image"] as const,
    guidance:
      "Three standalone posts, each under 280 characters including hashtags, plus a 4-6 post thread expanding the main idea (each post under 280 characters), and an image prompt.",
    schema: z.object({
      posts: z.array(z.string()),
      thread: z.array(z.string()),
      image_prompt: z.string(),
    }),
  },
  youtube: {
    label: "YouTube",
    media: ["image", "voice", "video"] as const,
    guidance:
      "A YouTube video of 2-4 minutes: an SEO title under 70 characters, a description of 150-300 words with chapter timestamps, 8-15 tags, chapters, the full narration script split into scenes, and a thumbnail image prompt. Also a 30-45 second Shorts script.",
    schema: z.object({
      title: z.string(),
      description: z.string(),
      tags: z.array(z.string()),
      chapters: z.array(z.object({ time: z.string(), title: z.string() })),
      scenes: z.array(scene),
      shorts_script: z.string(),
      image_prompt: z.string().describe("Thumbnail prompt, 16:9, bold and uncluttered"),
    }),
  },
  google_ads: {
    label: "Google Ads",
    media: ["image"] as const,
    guidance:
      "A responsive search ad: 12-15 headlines of at most 30 characters each and 4 descriptions of at most 90 characters each; 15-25 keywords with match type; a short display headline (max 30 characters), a long display headline (max 90 characters); and an image prompt for display ads.",
    schema: z.object({
      headlines: z.array(z.string()),
      descriptions: z.array(z.string()),
      keywords: z.array(
        z.object({ keyword: z.string(), match: z.enum(["broad", "phrase", "exact"]) }),
      ),
      display_headline_short: z.string(),
      display_headline_long: z.string(),
      image_prompt: z.string(),
    }),
  },
  blog: {
    label: "Blog",
    media: ["image"] as const,
    guidance:
      "A complete SEO blog article of 800-1,200 words in Markdown with H2/H3 headings, an SEO title under 60 characters, a meta description of 140-160 characters, a URL slug, and a header image prompt.",
    schema: z.object({
      title: z.string(),
      meta_description: z.string(),
      slug: z.string(),
      body_markdown: z.string(),
      image_prompt: z.string(),
    }),
  },
  email: {
    label: "Email",
    media: [] as const,
    guidance:
      "A professional marketing email: two subject lines for an A/B test (under 60 characters), preview text under 90 characters, and the email body in Markdown with a greeting, 120-220 words, one clear call to action and a sign-off.",
    schema: z.object({
      subject_a: z.string(),
      subject_b: z.string(),
      preview_text: z.string(),
      body_markdown: z.string(),
      cta_label: z.string(),
    }),
  },
  whatsapp: {
    label: "WhatsApp",
    media: ["image"] as const,
    guidance:
      "A WhatsApp broadcast message under 700 characters for customers who opted in, friendly and personal, with one call to action, plus an image prompt.",
    schema: z.object({
      message: z.string(),
      image_prompt: z.string(),
    }),
  },
  tiktok: {
    label: "TikTok",
    media: ["image", "voice", "video"] as const,
    guidance:
      "A TikTok video of 15-30 seconds in 3-5 scenes with a hook in the first second, a caption under 150 characters, 3-6 hashtags, and a cover image prompt.",
    schema: z.object({
      caption: z.string(),
      hashtags: z.array(z.string()),
      reel_scenes: z.array(scene),
      cta: z.string(),
      image_prompt: z.string(),
    }),
  },
} as const;

export type ChannelId = keyof typeof CHANNELS;
export const CHANNEL_IDS = Object.keys(CHANNELS) as ChannelId[];

export function isChannelId(value: string): value is ChannelId {
  return value in CHANNELS;
}

/** Map free-text channel names from a campaign ("Paid search", "Insta") to Channel Studio ids. */
export function matchChannel(name: string): ChannelId | null {
  const n = name.toLowerCase();
  if (n.includes("insta")) return "instagram";
  if (n.includes("face")) return "facebook";
  if (n.includes("linked")) return "linkedin";
  if (n === "x" || n.includes("twitter")) return "x";
  if (n.includes("youtube")) return "youtube";
  if (n.includes("google") || n.includes("search") || n.includes("ads")) return "google_ads";
  if (n.includes("blog")) return "blog";
  if (n.includes("mail")) return "email";
  if (n.includes("whatsapp")) return "whatsapp";
  if (n.includes("tiktok")) return "tiktok";
  return null;
}

export const CHANNEL_SYSTEM = `You are a senior content marketer who writes ready-to-publish content for one specific channel.
Write the final copy itself, never placeholders or instructions to the user. Match the channel's native style and length limits exactly.
Never invent prices, discounts, statistics, testimonials or guarantees; if a fact is needed and not provided, write around it.
Image prompts describe a photograph or illustration with no words or logos in it.`;

type Scene = z.infer<typeof scene>;

/** The narration to turn into a voiceover for channels that have video. */
export function voiceoverText(channel: ChannelId, content: Record<string, unknown>): string {
  const scenes = (channel === "youtube" ? content["scenes"] : content["reel_scenes"]) as
    Scene[] | undefined;
  return (scenes ?? [])
    .map((s) => s.voiceover)
    .join(" ")
    .trim();
}

export function videoScenes(channel: ChannelId, content: Record<string, unknown>): Scene[] {
  return (
    ((channel === "youtube" ? content["scenes"] : content["reel_scenes"]) as Scene[] | undefined) ??
    []
  );
}
