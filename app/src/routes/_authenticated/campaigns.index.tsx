import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/campaigns/")({
  head: () => ({
    meta: [
      { title: "Your campaigns — CampaignForge" },
      {
        name: "description",
        content:
          "Every campaign brief, calendar and creative asset you have planned, in one place.",
      },
      { property: "og:title", content: "Your campaigns — CampaignForge" },
      {
        property: "og:description",
        content:
          "Every campaign brief, calendar and creative asset you have planned, in one place.",
      },
    ],
  }),
  component: CampaignsPage,
});

const CHANNELS = ["Instagram", "LinkedIn", "Email", "Paid search", "YouTube", "Blog"];

function CampaignsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campaign deleted.");
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1 className="mt-2 text-3xl font-semibold">Your campaigns</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Brief in, full plan out. Every campaign keeps its calendar and creative assets together.
          </p>
        </div>
        <Button onClick={() => setOpen((v) => !v)}>{open ? "Close" : "New campaign"}</Button>
      </div>

      {open ? (
        <BriefForm onCreated={(id) => navigate({ to: "/campaigns/$id", params: { id } })} />
      ) : null}

      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading campaigns…</p>
        ) : campaigns && campaigns.length > 0 ? (
          campaigns.map((c) => (
            <div
              key={c.id}
              className="panel group flex flex-col p-5 transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-lg font-semibold leading-snug">{c.title}</h2>
                <Badge variant="outline" className="shrink-0 capitalize">
                  {c.status}
                </Badge>
              </div>
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                {c.business_brief || "No brief yet."}
              </p>
              <p className="mt-4 font-mono text-xs text-muted-foreground">
                {c.start_date} → {c.end_date}
              </p>
              <div className="mt-5 flex items-center gap-2">
                <Link to="/campaigns/$id" params={{ id: c.id }} className="flex-1">
                  <Button variant="secondary" size="sm" className="w-full">
                    Open plan
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove.mutate(c.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="panel col-span-full p-10 text-center">
            <h2 className="font-display text-lg font-semibold">No campaigns yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Start with a short brief — audience, goal and dates. The plan builds itself from
              there.
            </p>
            <Button className="mt-5" onClick={() => setOpen(true)}>
              Create your first campaign
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

function BriefForm({ onCreated }: { onCreated: (id: string) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const inTwoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const [form, setForm] = useState({
    title: "",
    business_brief: "",
    target_audience: "",
    campaign_goal: "",
    start_date: today,
    end_date: inTwoWeeks,
  });
  const [channels, setChannels] = useState<string[]>(["Instagram", "Email"]);

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .insert({ ...form, channels })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Campaign saved. Generate the plan next.");
      onCreated(id);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save."),
  });

  return (
    <form
      data-tour="brief-form"
      className="panel mt-8 grid gap-5 p-6 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="title">Campaign title</Label>
        <Input
          id="title"
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Spring launch for the freelancer plan"
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="brief">Business brief</Label>
        <Textarea
          id="brief"
          required
          rows={4}
          value={form.business_brief}
          onChange={(e) => setForm({ ...form, business_brief: e.target.value })}
          placeholder="What you sell, what's new, what the offer is, and any must-say points."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="audience">Target audience</Label>
        <Textarea
          id="audience"
          required
          rows={3}
          value={form.target_audience}
          onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
          placeholder="Freelance designers in India, 25-40, price sensitive."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="goal">Campaign goal</Label>
        <Textarea
          id="goal"
          required
          rows={3}
          value={form.campaign_goal}
          onChange={(e) => setForm({ ...form, campaign_goal: e.target.value })}
          placeholder="300 trial signups in two weeks."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="start">Start date</Label>
        <Input
          id="start"
          type="date"
          value={form.start_date}
          onChange={(e) => setForm({ ...form, start_date: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="end">End date</Label>
        <Input
          id="end"
          type="date"
          value={form.end_date}
          onChange={(e) => setForm({ ...form, end_date: e.target.value })}
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>Channels</Label>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((channel) => {
            const active = channels.includes(channel);
            return (
              <button
                key={channel}
                type="button"
                onClick={() =>
                  setChannels(
                    active ? channels.filter((c) => c !== channel) : [...channels, channel],
                  )
                }
                className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                  active
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {channel}
              </button>
            );
          })}
        </div>
      </div>
      <div className="md:col-span-2">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Saving…" : "Save brief"}
        </Button>
      </div>
    </form>
  );
}
