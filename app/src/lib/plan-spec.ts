// Campaign plan generation spec. Shared by the server and background AI jobs; keep free of "@/..." imports.
import { z as z4 } from "zod/v4";

export const PlanSchema = z4.object({
  calendar: z4.array(
    z4.object({
      date: z4.string().describe("YYYY-MM-DD, inside the campaign date range"),
      title: z4.string(),
      description: z4.string(),
      type: z4.enum(["content", "social", "ad", "email", "event"]),
      channel: z4.string(),
    }),
  ),
  ideas: z4.array(z4.string()),
  scripts: z4.array(z4.object({ title: z4.string(), content: z4.string() })),
  creativeBrief: z4.object({ title: z4.string(), content: z4.string() }),
});

export type GeneratedPlan = z4.infer<typeof PlanSchema>;

export const PLAN_SYSTEM = `You are a senior campaign strategist for small marketing teams.
Given a business brief, audience, goal, channels and date range, produce a practical,
day-by-day marketing plan. Be specific and executable — no filler.
Rules: 8-18 calendar items spread across the date range and inside it; at least 4 ideas;
2 ad scripts written as ready-to-record copy with hook, body and CTA; one creative brief
covering objective, audience insight, message, tone, deliverables and success measures.`;
