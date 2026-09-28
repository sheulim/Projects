import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { startJob } from "@/lib/jobs/client";
import { ChannelCard, isBusy } from "@/components/channel-studio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/daily-video")({
  head: () => ({
    meta: [
      { title: "Daily video — CampaignForge" },
      {
        name: "description",
        content: "Turn today's content into a YouTube video in your own voice.",
      },
    ],
  }),
  component: DailyVideoPage,
});

const DAILY_TITLE = "Daily YouTube videos";

function today() {
  return new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function DailyVideoPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState("");
  const [content, setContent] = useState("");

  // All daily videos live in one campaign, created the first time.
  const campaign = useQuery({
    queryKey: ["daily_campaign", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: found } = await supabase
        .from("campaigns")
        .select("id")
        .eq("user_id", user!.id)
        .eq("title", DAILY_TITLE)
        .limit(1)
        .maybeSingle();
      if (found) return found.id;
      const { data, error } = await supabase
        .from("campaigns")
        .insert({
          title: DAILY_TITLE,
          business_brief: "A daily YouTube video made from the creator's own content.",
          target_audience: "",
          campaign_goal: "Publish one video every day.",
          channels: ["YouTube"],
          status: "planned",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
  });
  const campaignId = campaign.data;

  const videos = useQuery({
    queryKey: ["channel_assets", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channel_assets")
        .select("*")
        .eq("campaign_id", campaignId!)
        .eq("channel", "youtube")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
    refetchInterval: (q) => ((q.state.data ?? []).some(isBusy) ? 3000 : false),
  });

  const voice = useQuery({
    queryKey: ["voice_profile"],
    queryFn: async () => {
      const { data } = await supabase.from("voice_profiles").select("status").maybeSingle();
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (input: { title: string; source: string }) => {
      if (!campaignId) throw new Error("Still getting ready. Try again in a moment.");
      const { data, error } = await supabase
        .from("channel_assets")
        .insert({
          campaign_id: campaignId,
          channel: "youtube",
          status: "generating",
          title: input.title,
          content: { _source: input.source },
        })
        .select("id")
        .single();
      if (error) throw error;
      await startJob({ job: "channel", assetId: data.id });
    },
    onSuccess: () => {
      toast.message("Writing your video. This usually takes under a minute.");
      setContent("");
      setTopic("");
      void queryClient.invalidateQueries({ queryKey: ["channel_assets", campaignId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not start."),
  });

  const words = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <p className="eyebrow">YouTube, every day</p>
      <h1 className="mt-2 text-3xl font-semibold">Daily video</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Paste today's content. CampaignForge turns it into a ready YouTube video: title,
        description, tags, chapters, the narration script, a thumbnail, a voiceover in your voice
        and a downloadable video.
      </p>

      <div className="mt-4 text-sm">
        {voice.data?.status === "ready" ? (
          <span className="text-support">✓ Voiceovers will use your cloned voice.</span>
        ) : (
          <span className="text-muted-foreground">
            Voiceovers use a standard AI voice.{" "}
            <Link to="/my-voice" className="text-primary underline">
              Set up your own voice
            </Link>{" "}
            first for the best result.
          </span>
        )}
      </div>

      <form
        className="panel mt-6 space-y-4 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ title: topic.trim() || `Video for ${today()}`, source: content.trim() });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="dv-topic">Topic (optional)</Label>
          <Input
            id="dv-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. What your life path number says about your career"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dv-content">Today's content</Label>
          <Textarea
            id="dv-content"
            required
            rows={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste your notes, article or talking points. The video keeps your meaning and your words."
          />
          <p className="text-xs text-muted-foreground">
            {words} words · about 300–600 words makes a 2–4 minute video.
          </p>
        </div>
        <Button
          type="submit"
          className="shadow-signal"
          disabled={!content.trim() || create.isPending || !campaignId}
        >
          {create.isPending ? "Starting…" : "Make today's video"}
        </Button>
      </form>

      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold">How to finish each video</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            Wait about a minute for the script and read it. If something is off, adjust your content
            and press Regenerate.
          </li>
          <li>Press Create image for the thumbnail and Create voiceover for your narration.</li>
          <li>Press Make video, then download it.</li>
          <li>
            Upload the video in YouTube Studio and paste the title, description and tags with the
            Copy buttons.
          </li>
        </ol>
      </section>

      <section className="mt-8 space-y-5">
        <h2 className="font-display text-lg font-semibold">Your videos</h2>
        {videos.isLoading || campaign.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (videos.data ?? []).length === 0 ? (
          <div className="panel p-8 text-center text-sm text-muted-foreground">
            No videos yet. Paste your first content above.
          </div>
        ) : (
          (videos.data ?? []).map((v) => (
            <div key={v.id} className="space-y-2">
              <p className="font-mono text-xs text-muted-foreground">
                {v.title} ·{" "}
                {new Date(v.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}
              </p>
              <ChannelCard
                asset={v}
                canEdit
                onRegenerate={() => {
                  const source = String((v.content as Record<string, unknown>)?.["_source"] ?? "");
                  if (!source) {
                    toast.error("The original content for this video was not saved.");
                    return;
                  }
                  create.mutate({ title: v.title, source });
                }}
              />
            </div>
          ))
        )}
      </section>
    </main>
  );
}
