import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { startJob } from "@/lib/jobs/client";
import { ChannelStudio } from "@/components/channel-studio";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { TOUR_TAB_EVENT } from "@/components/guided-tour";
import {
  ApprovalControls,
  ApprovalHistory,
  RecommendationsPanel,
  ReviewersPanel,
} from "@/components/campaign-workflow";

type Perms = { isOwner: boolean; isReviewer: boolean };

export const Route = createFileRoute("/_authenticated/campaigns/$id")({
  head: () => ({
    meta: [
      { title: "Campaign plan — CampaignForge" },
      {
        name: "description",
        content:
          "Day-by-day calendar, content ideas, ad scripts and creative brief for your campaign.",
      },
      { property: "og:title", content: "Campaign plan — CampaignForge" },
      {
        property: "og:description",
        content:
          "Day-by-day calendar, content ideas, ad scripts and creative brief for your campaign.",
      },
    ],
  }),
  component: CampaignDetail,
});

const TYPE_LABEL: Record<string, string> = {
  content: "Content",
  social: "Social",
  ad: "Ad",
  email: "Email",
  event: "Event",
};

function CampaignDetail() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();

  const campaign = useQuery({
    queryKey: ["campaign", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("campaigns").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    refetchInterval: (q) => (q.state.data?.status === "generating" ? 3000 : false),
  });

  // When a background plan job finishes, refresh the plan and tell the user.
  const lastStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    const status = campaign.data?.status;
    if (lastStatus.current === "generating" && status && status !== "generating") {
      if (status === "error") toast.error("Plan generation failed. Try again.");
      else toast.success("Your plan is ready.");
      queryClient.invalidateQueries({ queryKey: ["calendar_items", id] });
      queryClient.invalidateQueries({ queryKey: ["generated_assets", id] });
    }
    lastStatus.current = status;
  }, [campaign.data?.status, id, queryClient]);

  const items = useQuery({
    queryKey: ["calendar_items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_items")
        .select("*")
        .eq("campaign_id", id)
        .order("item_date")
        .order("position");
      if (error) throw error;
      return data;
    },
  });

  const assets = useQuery({
    queryKey: ["generated_assets", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_assets")
        .select("*")
        .eq("campaign_id", id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const runGenerate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("campaigns")
        .update({ status: "generating" })
        .eq("id", id);
      if (error) throw error;
      try {
        await startJob({ job: "plan", campaignId: id });
      } catch (e) {
        await supabase.from("campaigns").update({ status: "draft" }).eq("id", id);
        throw e;
      }
    },
    onSuccess: () => {
      toast.message("Building your plan. This usually takes under a minute.");
      queryClient.invalidateQueries({ queryKey: ["campaign", id] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Plan generation failed."),
  });

  const { user } = useAuth();
  const reviewerRows = useQuery({
    queryKey: ["campaign_reviewers", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_reviewers")
        .select("*")
        .eq("campaign_id", id);
      if (error) throw error;
      return data;
    },
  });
  const c = campaign.data;
  const perms: Perms = {
    isOwner: !!c && c.user_id === user?.id,
    isReviewer: (reviewerRows.data ?? []).some((r) => r.reviewer_id === user?.id),
  };
  const hasPlan = (items.data?.length ?? 0) > 0;

  // The guided tour switches tabs as it explains them.
  const [tab, setTab] = useState("calendar");
  useEffect(() => {
    const onTab = (e: Event) => setTab(String((e as CustomEvent).detail));
    window.addEventListener(TOUR_TAB_EVENT, onTab);
    return () => window.removeEventListener(TOUR_TAB_EVENT, onTab);
  }, []);
  const planBuilding = runGenerate.isPending || c?.status === "generating";

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <Link to="/campaigns" className="eyebrow">
        ← All campaigns
      </Link>

      <div
        data-tour="campaign-head"
        className="mt-4 flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-semibold">{c?.title ?? "Loading…"}</h1>
          {c ? (
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              {c.start_date} → {c.end_date} · {(c.channels ?? []).join(" · ") || "no channels set"}
            </p>
          ) : null}
        </div>
        <Button onClick={() => runGenerate.mutate()} disabled={planBuilding || !perms.isOwner}>
          {planBuilding ? "Building your plan…" : hasPlan ? "Regenerate plan" : "Generate plan"}
        </Button>
      </div>

      {c ? (
        <div className="panel mt-6 grid gap-5 p-6 md:grid-cols-3">
          <BriefBlock label="Business brief" value={c.business_brief} />
          <BriefBlock label="Audience" value={c.target_audience} />
          <BriefBlock label="Goal" value={c.campaign_goal} />
        </div>
      ) : null}

      {c ? (
        <BudgetPanel
          campaign={c}
          onExport={() => exportCalendarCsv(c.title, items.data ?? [])}
          canExport={hasPlan}
        />
      ) : null}

      <Tabs data-tour="tabs" value={tab} onValueChange={setTab} className="mt-10">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="studio">Channel Studio</TabsTrigger>
          <TabsTrigger value="ideas">Ideas</TabsTrigger>
          <TabsTrigger value="scripts">Ad scripts</TabsTrigger>
          <TabsTrigger value="brief">Creative brief</TabsTrigger>
          <TabsTrigger value="strategy">AI strategy</TabsTrigger>
          <TabsTrigger value="review">Review & history</TabsTrigger>
        </TabsList>

        <TabsContent value="studio" className="mt-6">
          {c ? <ChannelStudio campaign={c} canEdit={perms.isOwner} /> : null}
        </TabsContent>

        <TabsContent value="strategy" className="mt-6">
          {c ? (
            <RecommendationsPanel
              campaignId={id}
              isOwner={perms.isOwner}
              defaultBrief={[
                c.business_brief,
                c.target_audience && `Audience: ${c.target_audience}`,
                c.campaign_goal && `Goal: ${c.campaign_goal}`,
              ]
                .filter(Boolean)
                .join("\n")}
            />
          ) : null}
        </TabsContent>
        <TabsContent value="review" className="mt-6 grid gap-6 md:grid-cols-[1fr_1.4fr]">
          <ReviewersPanel campaignId={id} isOwner={perms.isOwner} />
          <ApprovalHistory campaignId={id} />
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          {hasPlan ? (
            <div className="space-y-3">
              {items.data!.map((item) => (
                <CalendarRow key={item.id} item={item} campaignId={id} perms={perms} />
              ))}
            </div>
          ) : (
            <EmptyPlan pending={planBuilding} />
          )}
        </TabsContent>

        <TabsContent value="ideas" className="mt-6">
          <AssetList assets={assets.data ?? []} type="idea" campaignId={id} perms={perms} />
        </TabsContent>
        <TabsContent value="scripts" className="mt-6">
          <AssetList assets={assets.data ?? []} type="script" campaignId={id} perms={perms} />
        </TabsContent>
        <TabsContent value="brief" className="mt-6">
          <AssetList
            assets={assets.data ?? []}
            type="creative_brief"
            campaignId={id}
            perms={perms}
          />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function BriefBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="mt-2 text-sm text-muted-foreground">{value || "—"}</p>
    </div>
  );
}

function EmptyPlan({ pending }: { pending: boolean }) {
  return (
    <div className="panel p-10 text-center">
      <h2 className="font-display text-lg font-semibold">
        {pending ? "Writing your plan…" : "No plan generated yet"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {pending
          ? "This takes a few seconds. The calendar, ideas, scripts and brief arrive together."
          : "Hit Generate plan and you'll get a day-by-day calendar plus ideas, ad scripts and a creative brief."}
      </p>
    </div>
  );
}

type CalendarItem = {
  id: string;
  item_date: string;
  title: string;
  description: string;
  item_type: string;
  channel: string;
  status: string;
};

function CalendarRow({
  item,
  campaignId,
  perms,
}: {
  item: CalendarItem;
  campaignId: string;
  perms: Perms;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: item.title, description: item.description });

  const save = useMutation({
    mutationFn: async (patch: Partial<CalendarItem>) => {
      const { error } = await supabase.from("calendar_items").update(patch).eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar_items", campaignId] });
      setEditing(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save."),
  });

  return (
    <div className="panel flex flex-col gap-3 p-4 md:flex-row md:items-start">
      <div className="w-full shrink-0 md:w-28">
        <p className="font-mono text-xs text-primary">{item.item_date}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {TYPE_LABEL[item.item_type] ?? item.item_type}
        </p>
      </div>

      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="space-y-2">
            <Input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            <Textarea
              rows={3}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => save.mutate(draft)}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="font-display text-base font-semibold">{item.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
            <p className="mt-2 text-xs text-muted-foreground">{item.channel}</p>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {!editing && perms.isOwner && item.status !== "approved" ? (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
        ) : null}
        <ApprovalControls
          kind="calendar_item"
          itemId={item.id}
          status={item.status}
          campaignId={campaignId}
          {...perms}
        />
      </div>
    </div>
  );
}

type Asset = {
  id: string;
  asset_type: string;
  title: string;
  content: string;
  status: string;
};

function AssetList({
  assets,
  type,
  campaignId,
  perms,
}: {
  assets: Asset[];
  type: string;
  campaignId: string;
  perms: Perms;
}) {
  const filtered = assets.filter((a) => a.asset_type === type);
  if (filtered.length === 0) {
    return (
      <div className="panel p-10 text-center text-sm text-muted-foreground">
        Nothing here yet — generate the plan to fill this in.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {filtered.map((asset) => (
        <AssetCard key={asset.id} asset={asset} campaignId={campaignId} perms={perms} />
      ))}
    </div>
  );
}

function AssetCard({
  asset,
  campaignId,
  perms,
}: {
  asset: Asset;
  campaignId: string;
  perms: Perms;
}) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState(asset.content);
  const [dirty, setDirty] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("generated_assets")
        .update({ content })
        .eq("id", asset.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["generated_assets", campaignId] });
      toast.success("Saved.");
    },
  });

  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-base font-semibold">{asset.title}</h3>
        <div className="flex items-start gap-2">
          {perms.isOwner ? (
            <Button
              size="sm"
              variant={dirty ? "default" : "ghost"}
              disabled={!dirty || save.isPending}
              onClick={() => save.mutate()}
            >
              {dirty ? "Save changes" : "Saved"}
            </Button>
          ) : null}
          <ApprovalControls
            kind="asset"
            itemId={asset.id}
            status={asset.status}
            campaignId={campaignId}
            {...perms}
          />
        </div>
      </div>
      <Textarea
        className="mt-3 min-h-32 font-sans text-sm leading-relaxed"
        value={content}
        readOnly={!perms.isOwner}
        onChange={(e) => {
          setContent(e.target.value);
          setDirty(true);
        }}
      />
    </div>
  );
}

type BudgetCampaign = {
  id: string;
  title: string;
  budget: number;
  expected_revenue: number;
  actual_cost: number;
};

function BudgetPanel({
  campaign,
  onExport,
  canExport,
}: {
  campaign: BudgetCampaign;
  onExport: () => void;
  canExport: boolean;
}) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState({
    budget: String(campaign.budget ?? 0),
    expected_revenue: String(campaign.expected_revenue ?? 0),
    actual_cost: String(campaign.actual_cost ?? 0),
  });
  const [dirty, setDirty] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("campaigns")
        .update({
          budget: Number(values.budget) || 0,
          expected_revenue: Number(values.expected_revenue) || 0,
          actual_cost: Number(values.actual_cost) || 0,
        })
        .eq("id", campaign.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["campaign", campaign.id] });
      toast.success("Budget saved.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save."),
  });

  const remaining = (Number(values.budget) || 0) - (Number(values.actual_cost) || 0);

  return (
    <div className="panel mt-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Budget and expected return</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Remaining budget:{" "}
            <span className={remaining < 0 ? "text-destructive" : "text-primary"}>
              {remaining.toLocaleString()}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={!canExport} onClick={onExport}>
            Export calendar
          </Button>
          <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
            {dirty ? "Save budget" : "Saved"}
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {(
          [
            ["budget", "Planned budget"],
            ["actual_cost", "Actual spend"],
            ["expected_revenue", "Expected return"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="space-y-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            <Input
              type="number"
              min="0"
              value={values[key]}
              onChange={(e) => {
                setValues({ ...values, [key]: e.target.value });
                setDirty(true);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function exportCalendarCsv(title: string, items: CalendarItem[]) {
  const header = ["Date", "Title", "Description", "Type", "Channel", "Status"];
  const escape = (value: string) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const rows = items.map((i) =>
    [i.item_date, i.title, i.description, i.item_type, i.channel, i.status].map(escape).join(","),
  );
  const csv = [header.join(","), ...rows].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "campaign"}-calendar.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
