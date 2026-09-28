// Long-running AI jobs, executed inside the Netlify background function
// (netlify/functions/ai-job-background.mts). Keep free of "@/..." imports.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../integrations/supabase/types";
import { brandDnaPrompt, generateStructured } from "../claude.server";
import { PLAN_SYSTEM, PlanSchema } from "../plan-spec";
import { STRATEGY_SYSTEM, StrategySchema } from "../strategy-spec";
import { CHANNELS, CHANNEL_SYSTEM, isChannelId, voiceoverText } from "../channel-specs";
import { generateImage, generateSpeech } from "./openai";
import { createVoiceModel, fishConfigured, fishSpeech } from "./fish";

type Db = SupabaseClient<Database>;

export const MEDIA_BUCKET = "campaign-media";

async function loadDna(db: Db, userId: string) {
  const { data } = await db.from("brand_dna").select("*").eq("user_id", userId).maybeSingle();
  return data;
}

async function loadCampaign(db: Db, campaignId: string) {
  const { data, error } = await db.from("campaigns").select("*").eq("id", campaignId).single();
  if (error || !data) throw new Error("Campaign not found.");
  return data;
}

function briefText(c: Database["public"]["Tables"]["campaigns"]["Row"]) {
  return `Campaign title: ${c.title}
Business brief: ${c.business_brief}
Target audience: ${c.target_audience}
Campaign goal: ${c.campaign_goal}
Channels: ${(c.channels ?? []).join(", ") || "any suitable"}
Start date: ${c.start_date}
End date: ${c.end_date}`;
}

/** Full campaign plan: calendar, ideas, ad scripts and creative brief. */
export async function runPlanJob(db: Db, userId: string, campaignId: string) {
  const campaign = await loadCampaign(db, campaignId);
  try {
    const plan = await generateStructured({
      system: PLAN_SYSTEM + brandDnaPrompt(await loadDna(db, userId)),
      prompt: briefText(campaign),
      schema: PlanSchema,
      maxTokens: 12000,
    });

    await db.from("calendar_items").delete().eq("campaign_id", campaign.id);
    await db.from("generated_assets").delete().eq("campaign_id", campaign.id);

    const items = plan.calendar.slice(0, 40).map((item, index) => ({
      campaign_id: campaign.id,
      user_id: userId,
      item_date: item.date.slice(0, 10) || campaign.start_date,
      title: item.title || "Untitled",
      description: item.description,
      item_type: item.type,
      channel: item.channel || "social",
      status: "draft",
      position: index,
    }));
    if (items.length) {
      const { error } = await db.from("calendar_items").insert(items);
      if (error) throw new Error(error.message);
    }

    const assets = [
      ...plan.ideas.map((idea, i) => ({
        asset_type: "idea",
        title: `Content idea ${i + 1}`,
        content: idea,
      })),
      ...plan.scripts.map((s) => ({
        asset_type: "script",
        title: s.title || "Ad script",
        content: s.content,
      })),
      {
        asset_type: "creative_brief",
        title: plan.creativeBrief.title || "Creative brief",
        content: plan.creativeBrief.content,
      },
    ].map((a) => ({ ...a, campaign_id: campaign.id, user_id: userId, status: "draft" }));
    const { error: assetsError } = await db.from("generated_assets").insert(assets);
    if (assetsError) throw new Error(assetsError.message);

    await db
      .from("campaigns")
      .update({ status: "planned", updated_at: new Date().toISOString() })
      .eq("id", campaign.id);
  } catch (error) {
    await db
      .from("campaigns")
      .update({ status: "error", updated_at: new Date().toISOString() })
      .eq("id", campaign.id);
    throw error;
  }
}

/** AI strategy: segments, channel mix and messaging angles. */
export async function runStrategyJob(db: Db, userId: string, campaignId: string, brief: string) {
  const campaign = await loadCampaign(db, campaignId);
  if (campaign.user_id !== userId)
    throw new Error("Only the campaign owner can request recommendations.");
  const result = await generateStructured({
    system: STRATEGY_SYSTEM + brandDnaPrompt(await loadDna(db, userId)),
    prompt: `Campaign: ${campaign.title}
Goal: ${campaign.campaign_goal}
Planned channels: ${(campaign.channels ?? []).join(", ") || "open"}
Dates: ${campaign.start_date} to ${campaign.end_date}
Budget: ${campaign.budget ?? "not set"}

Brief from the campaign manager:
${brief}`,
    schema: StrategySchema,
    maxTokens: 6000,
  });
  const { error } = await db.from("campaign_recommendations").insert({
    campaign_id: campaign.id,
    user_id: userId,
    brief,
    result: result as unknown as Json,
  });
  if (error) throw new Error(error.message);
}

async function loadAsset(db: Db, assetId: string) {
  const { data, error } = await db.from("channel_assets").select("*").eq("id", assetId).single();
  if (error || !data) throw new Error("Channel item not found.");
  if (!isChannelId(data.channel)) throw new Error(`Unknown channel: ${data.channel}`);
  return { ...data, channel: data.channel };
}

async function setAsset(
  db: Db,
  assetId: string,
  patch: Database["public"]["Tables"]["channel_assets"]["Update"],
) {
  await db
    .from("channel_assets")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", assetId);
}

type Content = Record<string, unknown> & { _media?: Record<string, string>; _error?: string };

async function setMediaState(
  db: Db,
  assetId: string,
  kind: "image" | "voice",
  state: string,
  extra: Record<string, unknown> = {},
) {
  const { data } = await db.from("channel_assets").select("content").eq("id", assetId).single();
  const content = ((data?.content as Content) ?? {}) as Content;
  const media = { ...(content._media ?? {}), [kind]: state };
  await setAsset(db, assetId, { content: { ...content, _media: media } as Json, ...extra });
}

/** Channel-specific, ready-to-post content for one channel of a campaign. */
export async function runChannelJob(db: Db, userId: string, assetId: string) {
  const asset = await loadAsset(db, assetId);
  const spec = CHANNELS[asset.channel];
  // Daily videos carry the creator's own text; the AI must build on it, not replace it.
  const source = String((asset.content as Content | null)?.["_source"] ?? "").trim();
  try {
    const campaign = await loadCampaign(db, asset.campaign_id);
    const content = await generateStructured({
      system: CHANNEL_SYSTEM + brandDnaPrompt(await loadDna(db, userId)),
      prompt: source
        ? `Write the ${spec.label} content from the creator's own material below.
Keep the creator's meaning, ideas and wording wherever possible; do not add claims that are not in it.
The narration should sound like the creator speaking in first person.
What to produce: ${spec.guidance}

CREATOR'S MATERIAL:
${source}`
        : `${briefText(campaign)}

Write the ${spec.label} content for this campaign.
What to produce: ${spec.guidance}`,
      schema: spec.schema,
      maxTokens: asset.channel === "blog" ? 12000 : 8000,
    });
    await setAsset(db, assetId, {
      content: (source ? { ...content, _source: source } : content) as unknown as Json,
      title: source ? asset.title || `${spec.label} content` : `${spec.label} content`,
      status: "draft",
    });
  } catch (error) {
    await setAsset(db, assetId, {
      status: "error",
      content: {
        _error: error instanceof Error ? error.message : "Generation failed.",
        ...(source ? { _source: source } : {}),
      } as Json,
    });
    throw error;
  }
}

/** Generate the image for a channel item from its image prompt and store it privately. */
export async function runImageJob(db: Db, userId: string, assetId: string) {
  const asset = await loadAsset(db, assetId);
  const content = (asset.content ?? {}) as Content;
  const prompt = String(content["image_prompt"] ?? "");
  if (!prompt) throw new Error("This item has no image prompt.");
  await setMediaState(db, assetId, "image", "generating");
  try {
    const orientation =
      asset.channel === "youtube"
        ? "landscape"
        : asset.channel === "instagram" || asset.channel === "tiktok"
          ? "portrait"
          : "square";
    const png = await generateImage(prompt, orientation);
    const path = `${userId}/${assetId}/image-${Date.now()}.png`;
    const { error } = await db.storage
      .from(MEDIA_BUCKET)
      .upload(path, png, { contentType: "image/png", upsert: true });
    if (error) throw new Error(error.message);
    await setMediaState(db, assetId, "image", "ready", { image_path: path });
  } catch (error) {
    await setMediaState(db, assetId, "image", "error");
    throw error;
  }
}

/** Generate the voiceover for a video channel item and store it privately. */
export async function runVoiceJob(db: Db, userId: string, assetId: string) {
  const asset = await loadAsset(db, assetId);
  const content = (asset.content ?? {}) as Content;
  const text = voiceoverText(asset.channel, content);
  if (!text) throw new Error("This item has no narration to voice.");
  await setMediaState(db, assetId, "voice", "generating");
  try {
    const voice = await readyVoice(db, userId);
    const mp3 = voice ? await fishSpeech(text, voice) : await generateSpeech(text);
    const path = `${userId}/${assetId}/voiceover-${Date.now()}.mp3`;
    const { error } = await db.storage
      .from(MEDIA_BUCKET)
      .upload(path, mp3, { contentType: "audio/mpeg", upsert: true });
    if (error) throw new Error(error.message);
    await setMediaState(db, assetId, "voice", "ready", { audio_path: path });
  } catch (error) {
    await setMediaState(db, assetId, "voice", "error");
    throw error;
  }
}

/** The user's cloned voice id, when cloning is set up and the voice is ready. */
async function readyVoice(db: Db, userId: string): Promise<string | null> {
  if (!fishConfigured()) return null;
  const { data } = await db
    .from("voice_profiles")
    .select("model_id, status")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.status === "ready" && data.model_id ? data.model_id : null;
}

const TEST_LINE =
  "Hello, and welcome. This is my own voice, created for my videos. Thank you for listening.";

/** Clone the user's voice from their consented recording, then record a short test line. */
export async function runCloneJob(db: Db, userId: string) {
  const { data: profile } = await db
    .from("voice_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile?.sample_path) throw new Error("No voice recording found.");
  if (!profile.consent_at) throw new Error("Consent is required before cloning a voice.");
  const update = (patch: Database["public"]["Tables"]["voice_profiles"]["Update"]) =>
    db
      .from("voice_profiles")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
  try {
    const { data: sample, error } = await db.storage
      .from(MEDIA_BUCKET)
      .download(profile.sample_path);
    if (error || !sample) throw new Error("Could not read your recording. Upload it again.");
    const modelId = await createVoiceModel(sample, profile.title || "My voice");
    const mp3 = await fishSpeech(TEST_LINE, modelId);
    const path = `${userId}/voice/test-${Date.now()}.mp3`;
    const up = await db.storage
      .from(MEDIA_BUCKET)
      .upload(path, mp3, { contentType: "audio/mpeg", upsert: true });
    if (up.error) throw new Error(up.error.message);
    await update({ model_id: modelId, status: "ready", error: null, test_audio_path: path });
  } catch (error) {
    await update({
      status: "error",
      error: error instanceof Error ? error.message : "Voice cloning failed.",
    });
    throw error;
  }
}
