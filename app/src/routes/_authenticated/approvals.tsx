import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ApprovalControls, ApprovalHistory } from "@/components/campaign-workflow";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "Review queue — CampaignForge" },
      { name: "description", content: "Items waiting for your approval and the full approval history." },
      { property: "og:title", content: "Review queue — CampaignForge" },
      { property: "og:description", content: "Items waiting for your approval and the full approval history." },
    ],
  }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const { user } = useAuth();
  const queue = useQuery({
    queryKey: ["review_queue", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: assigned } = await supabase
        .from("campaign_reviewers")
        .select("campaign_id")
        .eq("reviewer_id", user!.id);
      const ids = (assigned ?? []).map((a) => a.campaign_id);
      if (!ids.length) return { items: [], assets: [] };
      const [items, assets] = await Promise.all([
        supabase.from("calendar_items").select("id, title, status, campaign_id, item_date").in("campaign_id", ids).eq("status", "in_review"),
        supabase.from("generated_assets").select("id, title, status, campaign_id").in("campaign_id", ids).eq("status", "in_review"),
      ]);
      return { items: items.data ?? [], assets: assets.data ?? [] };
    },
  });

  const rows = [
    ...(queue.data?.items ?? []).map((i) => ({ ...i, kind: "calendar_item" as const })),
    ...(queue.data?.assets ?? []).map((a) => ({ ...a, kind: "asset" as const })),
  ];

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 p-6">
      <section>
        <h1 className="text-2xl font-semibold">Waiting for your review</h1>
        <div className="mt-4 space-y-3">
          {rows.length === 0 ? (
            <div className="panel p-6 text-sm text-muted-foreground">Nothing waiting on you right now.</div>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="panel flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-medium">{r.title}</p>
                  <Link to="/campaigns/$id" params={{ id: r.campaign_id }} className="text-xs text-primary">
                    Open campaign →
                  </Link>
                </div>
                <ApprovalControls
                  kind={r.kind}
                  itemId={r.id}
                  status={r.status}
                  campaignId={r.campaign_id}
                  isOwner={false}
                  isReviewer
                />
              </div>
            ))
          )}
        </div>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Approval history</h2>
        <div className="mt-4">
          <ApprovalHistory />
        </div>
      </section>
    </main>
  );
}
