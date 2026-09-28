import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Recommendation } from "@/lib/strategy-spec";
import { startJob } from "@/lib/jobs/client";
import { memberName, useMembers } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  changes_requested: "Changes requested",
};

export function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "approved"
      ? "default"
      : status === "changes_requested"
        ? "destructive"
        : status === "in_review"
          ? "secondary"
          : "outline";
  return <Badge variant={variant}>{STATUS_LABEL[status] ?? status}</Badge>;
}

export function ApprovalControls({
  kind,
  itemId,
  status,
  campaignId,
  isOwner,
  isReviewer,
}: {
  kind: "calendar_item" | "asset";
  itemId: string;
  status: string;
  campaignId: string;
  isOwner: boolean;
  isReviewer: boolean;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [asking, setAsking] = useState(false);
  const act = useMutation({
    mutationFn: async (action: string) => {
      const { error } = await supabase.rpc("record_approval", {
        _kind: kind,
        _item_id: itemId,
        _action: action,
        _note: note,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNote("");
      setAsking(false);
      qc.invalidateQueries({ queryKey: ["calendar_items", campaignId] });
      qc.invalidateQueries({ queryKey: ["generated_assets", campaignId] });
      qc.invalidateQueries({ queryKey: ["approval_events"] });
      qc.invalidateQueries({ queryKey: ["review_queue"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Action failed."),
  });

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <StatusBadge status={status} />
        {isOwner && (status === "draft" || status === "changes_requested") && (
          <Button
            size="sm"
            variant="secondary"
            disabled={act.isPending}
            onClick={() => act.mutate("submitted")}
          >
            Submit for review
          </Button>
        )}
        {isOwner && (status === "approved" || status === "in_review") && (
          <Button
            size="sm"
            variant="ghost"
            disabled={act.isPending}
            onClick={() => act.mutate("reopened")}
          >
            Reopen
          </Button>
        )}
        {isReviewer && status === "in_review" && (
          <>
            <Button size="sm" disabled={act.isPending} onClick={() => act.mutate("approved")}>
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAsking((v) => !v)}>
              Request changes
            </Button>
          </>
        )}
      </div>
      {asking && (
        <div className="flex w-full max-w-sm flex-col gap-2">
          <Textarea
            rows={2}
            placeholder="What needs to change?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            size="sm"
            variant="destructive"
            disabled={!note.trim() || act.isPending}
            onClick={() => act.mutate("changes_requested")}
          >
            Send feedback
          </Button>
        </div>
      )}
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  submitted: "submitted for review",
  approved: "approved",
  changes_requested: "requested changes on",
  reopened: "reopened",
};

export function ApprovalHistory({ campaignId }: { campaignId?: string }) {
  const members = useMembers();
  const events = useQuery({
    queryKey: ["approval_events", campaignId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("approval_events")
        .select("*, campaigns(title)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (campaignId) q = q.eq("campaign_id", campaignId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
  const list = events.data ?? [];
  if (!list.length)
    return <div className="panel p-6 text-sm text-muted-foreground">No approval activity yet.</div>;
  return (
    <ol className="panel divide-y divide-border">
      {list.map((e) => {
        const actor = members.data?.find((m) => m.id === e.actor_id);
        return (
          <li key={e.id} className="flex flex-col gap-1 p-4 text-sm">
            <p>
              <span className="font-medium">{memberName(actor)}</span>{" "}
              <span className="text-muted-foreground">{ACTION_LABEL[e.action] ?? e.action}</span>{" "}
              <span className="font-medium">{e.item_title}</span>
              {!campaignId && e.campaigns ? (
                <span className="text-muted-foreground">
                  {" "}
                  · {(e.campaigns as { title: string }).title}
                </span>
              ) : null}
            </p>
            {e.note ? <p className="text-muted-foreground">“{e.note}”</p> : null}
            <p className="font-mono text-xs text-muted-foreground">
              {new Date(e.created_at).toLocaleString()}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

export function ReviewersPanel({ campaignId, isOwner }: { campaignId: string; isOwner: boolean }) {
  const qc = useQueryClient();
  const members = useMembers();
  const [pick, setPick] = useState("");
  const reviewers = useQuery({
    queryKey: ["campaign_reviewers", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_reviewers")
        .select("*")
        .eq("campaign_id", campaignId);
      if (error) throw error;
      return data;
    },
  });
  const add = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("campaign_reviewers")
        .insert({ campaign_id: campaignId, reviewer_id: pick, assigned_by: u.user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      setPick("");
      qc.invalidateQueries({ queryKey: ["campaign_reviewers", campaignId] });
      toast.success("Reviewer assigned.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not assign."),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaign_reviewers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaign_reviewers", campaignId] }),
  });

  const assignedIds = new Set((reviewers.data ?? []).map((r) => r.reviewer_id));
  const eligible = (members.data ?? []).filter(
    (m) => m.roles.includes("reviewer") && !assignedIds.has(m.id),
  );

  return (
    <div className="panel p-5">
      <p className="eyebrow">Reviewers</p>
      <ul className="mt-3 space-y-2">
        {(reviewers.data ?? []).map((r) => (
          <li key={r.id} className="flex items-center justify-between text-sm">
            <span>{memberName(members.data?.find((m) => m.id === r.reviewer_id))}</span>
            {isOwner && (
              <Button size="sm" variant="ghost" onClick={() => remove.mutate(r.id)}>
                Remove
              </Button>
            )}
          </li>
        ))}
        {!reviewers.data?.length && (
          <li className="text-sm text-muted-foreground">No reviewers assigned.</li>
        )}
      </ul>
      {isOwner && (
        <div className="mt-4 flex gap-2">
          <Select value={pick} onValueChange={setPick}>
            <SelectTrigger className="flex-1">
              <SelectValue
                placeholder={
                  eligible.length
                    ? "Choose a reviewer"
                    : "No reviewers available — add the role in Team"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {eligible.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {memberName(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button disabled={!pick || add.isPending} onClick={() => add.mutate()}>
            Assign
          </Button>
        </div>
      )}
    </div>
  );
}

export function RecommendationsPanel({
  campaignId,
  defaultBrief,
  isOwner,
}: {
  campaignId: string;
  defaultBrief: string;
  isOwner: boolean;
}) {
  const qc = useQueryClient();
  const [brief, setBrief] = useState(defaultBrief);
  const [waitingSince, setWaitingSince] = useState<string | null>(null);
  const recs = useQuery({
    queryKey: ["campaign_recommendations", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_recommendations")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: waitingSince ? 4000 : false,
  });
  // A background job writes the result; stop waiting once a newer row appears (or after 3 minutes).
  const newest = recs.data?.[0]?.created_at;
  useEffect(() => {
    if (!waitingSince) return;
    if (newest && newest > waitingSince) {
      setWaitingSince(null);
      toast.success("Recommendations ready.");
    } else if (Date.now() - Date.parse(waitingSince) > 180_000) {
      setWaitingSince(null);
      toast.error("Recommendation is taking too long. Try again.");
    }
  }, [newest, waitingSince, recs.dataUpdatedAt]);
  const go = useMutation({
    mutationFn: async () => {
      const started = new Date().toISOString();
      await startJob({ job: "strategy", campaignId, brief });
      return started;
    },
    onSuccess: (started) => {
      setWaitingSince(started);
      qc.invalidateQueries({ queryKey: ["campaign_recommendations", campaignId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Recommendation failed."),
  });
  const latest = recs.data?.[0];
  const r = latest?.result as Recommendation | undefined;

  return (
    <div className="space-y-6">
      {isOwner && (
        <div className="panel p-5">
          <p className="eyebrow">Strategy brief</p>
          <Textarea
            className="mt-3 min-h-28"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Product, offer, who buys today, competitors, constraints…"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              At least 20 characters. Takes up to a minute.
            </p>
            <Button
              disabled={brief.trim().length < 20 || go.isPending || !!waitingSince}
              onClick={() => go.mutate()}
            >
              {go.isPending || waitingSince ? "Thinking…" : "Recommend strategy"}
            </Button>
          </div>
        </div>
      )}

      {!r ? (
        <div className="panel p-8 text-center text-sm text-muted-foreground">
          No recommendations yet{isOwner ? " — describe the campaign above." : "."}
        </div>
      ) : (
        <>
          <div className="panel p-5">
            <p className="eyebrow">Summary</p>
            <p className="mt-2 text-sm">{r.summary}</p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              {new Date(latest!.created_at).toLocaleString()} · {recs.data!.length} run(s)
            </p>
          </div>
          <section>
            <h3 className="font-display text-lg font-semibold">Audience segments</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {r.segments.map((s) => (
                <div key={s.name} className="panel p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{s.name}</p>
                    <Badge variant="outline">{s.size_estimate}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Why: {s.why}</p>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h3 className="font-display text-lg font-semibold">Channel mix</h3>
            <div className="panel mt-3 divide-y divide-border">
              {r.channel_mix.map((c) => (
                <div key={c.channel} className="p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{c.channel}</span>
                    <span className="font-mono text-primary">{Math.round(c.share_percent)}%</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-secondary">
                    <div
                      className="h-1.5 rounded-full bg-gradient-signal"
                      style={{ width: `${Math.min(100, c.share_percent)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {c.role} — {c.rationale}
                  </p>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h3 className="font-display text-lg font-semibold">Messaging angles</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {r.messaging_angles.map((m) => (
                <div key={m.headline} className="panel p-4">
                  <p className="eyebrow">{m.angle}</p>
                  <p className="mt-2 font-display text-base font-semibold">“{m.headline}”</p>
                  <p className="mt-2 text-xs text-muted-foreground">For: {m.target_segment}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Proof: {m.proof_point}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
