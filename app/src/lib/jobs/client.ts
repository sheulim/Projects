import { supabase } from "@/integrations/supabase/client";

export type JobRequest =
  | { job: "plan"; campaignId: string }
  | { job: "strategy"; campaignId: string; brief: string }
  | { job: "channel"; assetId: string }
  | { job: "image"; assetId: string }
  | { job: "voice"; assetId: string };

/** Start a background AI job. Resolves once Netlify has accepted it; results appear in the database. */
export async function startJob(request: JobRequest): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session has expired. Sign in again.");
  const res = await fetch("/.netlify/functions/ai-job-background", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(request),
  });
  if (res.status !== 202 && !res.ok) {
    throw new Error(
      res.status === 404
        ? "AI jobs run on the deployed Netlify site, not in local preview."
        : `Could not start the AI job (${res.status}).`,
    );
  }
}
