import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { upcomingMoments } from "@/lib/moments";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Campaign dashboard — CampaignForge" },
      {
        name: "description",
        content: "Every campaign's budget, content and upcoming moments at a glance.",
      },
    ],
  }),
  component: DashboardPage,
});

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const dayFmt = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const shortFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

function isoDay(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function DashboardPage() {
  const campaigns = useQuery({
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

  const items = useQuery({
    queryKey: ["calendar_items", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_items")
        .select("id, campaign_id, item_date, title, channel, status")
        .order("item_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  if (campaigns.isLoading || items.isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-12 text-sm text-muted-foreground">
        Loading your campaigns…
      </main>
    );
  }

  const list = campaigns.data ?? [];
  const all = items.data ?? [];
  const budget = list.reduce((s, c) => s + Number(c.budget ?? 0), 0);
  const spent = list.reduce((s, c) => s + Number(c.actual_cost ?? 0), 0);
  const revenue = list.reduce((s, c) => s + Number(c.expected_revenue ?? 0), 0);
  const inReview = all.filter((i) => i.status === "in_review").length;
  const approved = all.filter((i) => i.status === "approved").length;

  const today = new Date();
  const todayIso = isoDay(today);
  const weekEndIso = isoDay(new Date(today.getTime() + 6 * 86_400_000));
  const thisWeek = all.filter((i) => i.item_date >= todayIso && i.item_date <= weekEndIso);

  const byChannel = Object.entries(
    all.reduce<Record<string, number>>((acc, i) => {
      const key = i.channel || "Other";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const maxChannel = byChannel[0]?.[1] ?? 1;

  const moments = upcomingMoments(today, 5);
  const titleById = new Map(list.map((c) => [c.id, c.title]));

  const setup = [
    { label: "Create a campaign", done: list.length > 0, to: "/campaigns" as const },
    { label: "Generate a plan", done: all.length > 0, to: "/campaigns" as const },
    {
      label: "Set a campaign budget",
      done: list.some((c) => Number(c.budget) > 0),
      to: "/campaigns" as const,
    },
    { label: "Approve 5 posts", done: approved >= 5, to: "/approvals" as const },
  ];
  const setupDone = setup.filter((s) => s.done).length;

  const tiles = [
    {
      label: "Campaigns",
      value: String(list.length),
      note: `${list.filter((c) => c.status === "planned").length} with a plan`,
    },
    { label: "Total budget", value: inr.format(budget), note: "Across all campaigns" },
    {
      label: "Spent to date",
      value: inr.format(spent),
      note: budget > 0 ? `${Math.round((spent / budget) * 100)}% of budget` : "No budget set",
    },
    {
      label: "Expected revenue",
      value: inr.format(revenue),
      note: budget > 0 ? `${(revenue / budget).toFixed(1)}× budget` : "Add a budget to see return",
    },
    { label: "Waiting on review", value: String(inReview), note: "Posts and assets" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">All campaigns</p>
          <h1 className="mt-2 text-3xl font-semibold">Campaign dashboard</h1>
        </div>
        <Link to="/campaigns">
          <Button>New campaign</Button>
        </Link>
      </div>

      <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className="panel p-4">
            <p className="eyebrow">{t.label}</p>
            <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{t.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t.note}</p>
          </div>
        ))}
      </section>

      <section className="panel mt-6 overflow-x-auto p-2">
        <h2 className="px-3 pb-2 pt-3 font-display text-lg font-semibold">Campaigns</h2>
        {list.length === 0 ? (
          <p className="px-3 pb-4 text-sm text-muted-foreground">
            No campaigns yet.{" "}
            <Link to="/campaigns" className="text-primary underline">
              Create your first one
            </Link>
            .
          </p>
        ) : (
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="text-left font-mono text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Campaign</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Dates</th>
                <th className="px-3 py-2 font-medium">Approved</th>
                <th className="px-3 py-2 font-medium">Budget used</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const mine = all.filter((i) => i.campaign_id === c.id);
                const ok = mine.filter((i) => i.status === "approved").length;
                const b = Number(c.budget ?? 0);
                const used =
                  b > 0 ? Math.min(100, Math.round((Number(c.actual_cost ?? 0) / b) * 100)) : null;
                return (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-3 py-3 font-medium">
                      <Link
                        to="/campaigns/$id"
                        params={{ id: c.id }}
                        className="hover:text-primary"
                      >
                        {c.title}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="outline">{c.status}</Badge>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-muted-foreground">
                      {shortFmt.format(new Date(c.start_date))} –{" "}
                      {shortFmt.format(new Date(c.end_date))}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {ok} / {mine.length}
                    </td>
                    <td className="px-3 py-3">
                      {used === null ? (
                        <span className="text-muted-foreground">Not set</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 rounded-full bg-secondary">
                            <div
                              className="h-1.5 rounded-full bg-primary"
                              style={{ width: `${used}%` }}
                            />
                          </div>
                          <span className="tabular-nums text-muted-foreground">{used}%</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="panel p-5">
          <h3 className="font-display text-base font-semibold">Next 7 days</h3>
          {thisWeek.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nothing scheduled this week.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {thisWeek.slice(0, 6).map((i) => (
                <li key={i.id} className="flex flex-col">
                  <span className="font-mono text-xs text-muted-foreground">
                    {dayFmt.format(new Date(i.item_date))} · {i.channel}
                  </span>
                  <span>{i.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {titleById.get(i.campaign_id)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel p-5">
          <h3 className="font-display text-base font-semibold">Content mix by channel</h3>
          {byChannel.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Generate a plan to see your channel mix.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {byChannel.slice(0, 6).map(([ch, n]) => (
                <li key={ch} className="grid grid-cols-[88px_1fr_28px] items-center gap-2">
                  <span className="truncate">{ch}</span>
                  <div className="h-2 rounded-full bg-secondary">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${(n / maxChannel) * 100}%` }}
                    />
                  </div>
                  <span className="text-right tabular-nums text-muted-foreground">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel p-5">
          <h3 className="font-display text-base font-semibold">Upcoming moments</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {moments.map((m) => (
              <li key={m.name} className="flex items-baseline justify-between gap-2">
                <span>
                  {m.name}
                  <span className="ml-1 font-mono text-xs text-muted-foreground">{m.market}</span>
                </span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {m.daysAway === 0 ? "Today" : `${shortFmt.format(m.date)} · ${m.daysAway}d`}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Fixed-date moments. Festivals with changing dates arrive with the moments calendar.
          </p>
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold">Setup checklist</h3>
            <span className="font-mono text-xs text-muted-foreground">
              {setupDone} of {setup.length}
            </span>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-secondary">
            <div
              className="h-1.5 rounded-full bg-primary"
              style={{ width: `${(setupDone / setup.length) * 100}%` }}
            />
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {setup.map((s) => (
              <li key={s.label}>
                {s.done ? (
                  <span className="text-muted-foreground line-through">✓ {s.label}</span>
                ) : (
                  <Link to={s.to} className="text-primary hover:underline">
                    ○ {s.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
