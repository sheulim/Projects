// AI strategy spec. Shared by the UI and background AI jobs; keep free of "@/..." imports.
import { z } from "zod/v4";

export const StrategySchema = z.object({
  summary: z.string(),
  segments: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      size_estimate: z.string(),
      why: z.string(),
    }),
  ),
  channel_mix: z.array(
    z.object({
      channel: z.string(),
      share_percent: z.number(),
      role: z.string(),
      rationale: z.string(),
    }),
  ),
  messaging_angles: z.array(
    z.object({
      angle: z.string(),
      headline: z.string(),
      target_segment: z.string(),
      proof_point: z.string(),
    }),
  ),
});

export type Recommendation = z.infer<typeof StrategySchema>;

export const STRATEGY_SYSTEM = `You are a senior campaign strategist. From a campaign brief, recommend:
- 3-4 audience segments (name, who they are, rough size estimate as text, why they fit)
- a channel mix of 3-6 channels whose share_percent values sum to 100, each with its role in the funnel and rationale
- 3-5 messaging angles, each with a headline, the segment it targets and a concrete proof point.
Be specific to the business. Keep each text field under 45 words.`;
