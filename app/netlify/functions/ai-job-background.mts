// Netlify background function: runs AI jobs that can take longer than a normal request
// (plans, strategy, channel content, images, voiceovers). Netlify answers the browser
// with 202 immediately and runs this for up to 15 minutes; the app polls the database
// for the result. The caller's Supabase session is used, so row-level security applies.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/integrations/supabase/types";
import {
  runChannelJob,
  runCloneJob,
  runImageJob,
  runPlanJob,
  runStrategyJob,
  runVoiceJob,
} from "../../src/lib/jobs/run";

type Job =
  | { job: "plan"; campaignId: string }
  | { job: "strategy"; campaignId: string; brief: string }
  | { job: "channel"; assetId: string }
  | { job: "image"; assetId: string }
  | { job: "voice"; assetId: string }
  | { job: "clone" };

export default async (req: Request) => {
  if (req.method !== "POST") return;
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const anon =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!token || !url || !anon) {
    console.error("ai-job: missing token or Supabase configuration");
    return;
  }

  const db = createClient<Database>(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) {
    console.error("ai-job: invalid session");
    return;
  }
  const userId = userData.user.id;

  let body: Job;
  try {
    body = (await req.json()) as Job;
  } catch {
    console.error("ai-job: bad request body");
    return;
  }

  try {
    switch (body.job) {
      case "plan":
        await runPlanJob(db, userId, body.campaignId);
        break;
      case "strategy":
        await runStrategyJob(db, userId, body.campaignId, body.brief);
        break;
      case "channel":
        await runChannelJob(db, userId, body.assetId);
        break;
      case "image":
        await runImageJob(db, userId, body.assetId);
        break;
      case "voice":
        await runVoiceJob(db, userId, body.assetId);
        break;
      case "clone":
        await runCloneJob(db, userId);
        break;
      default:
        console.error("ai-job: unknown job");
    }
  } catch (error) {
    console.error(`ai-job ${body.job} failed:`, error instanceof Error ? error.message : error);
  }
};
