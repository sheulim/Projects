import { createFileRoute, Link } from "@tanstack/react-router";
import { useMyRoles } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/compare")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "CampaignForge vs Zoho CRM campaigns" },
      {
        name: "description",
        content:
          "A feature-by-feature comparison of CampaignForge against Zoho CRM's campaign tooling, the gaps it exposed, and which gaps are now closed.",
      },
      { property: "og:title", content: "CampaignForge vs Zoho CRM campaigns" },
      {
        property: "og:description",
        content:
          "A feature-by-feature comparison of CampaignForge against Zoho CRM's campaign tooling, the gaps it exposed, and which gaps are now closed.",
      },
    ],
  }),
  component: Compare,
});

type Row = {
  capability: string;
  zoho: string;
  forge: string;
  verdict: "lead" | "parity" | "gap";
};

const ROWS: Row[] = [
  {
    capability: "Brief to dated plan",
    zoho: "Campaign records hold budget, dates and owner, but the day-by-day plan is built by hand.",
    forge: "One brief produces a dated calendar automatically.",
    verdict: "lead",
  },
  {
    capability: "Creative generation",
    zoho: "AI assists with email copy and subject lines inside the suite.",
    forge: "Content ideas, ad scripts and a full creative brief generated with the calendar.",
    verdict: "lead",
  },
  {
    capability: "Setup time",
    zoho: "Modules, layouts, roles and pipelines to configure before first value.",
    forge: "Sign in, write a brief, get a plan.",
    verdict: "lead",
  },
  {
    capability: "Audience data",
    zoho: "Segments built from real leads, contacts and deal history.",
    forge: "Audience is described in words, not pulled from customer records.",
    verdict: "gap",
  },
  {
    capability: "Execution and sending",
    zoho: "Sends email campaigns and syncs to ad platforms.",
    forge: "Plans the work; sending stays in your existing tools.",
    verdict: "gap",
  },
  {
    capability: "Attribution and ROI",
    zoho: "Ties revenue and deals back to the campaign record.",
    forge: "Budget and expected return recorded per campaign; no revenue attribution.",
    verdict: "gap",
  },
  {
    capability: "Approval workflow",
    zoho: "Approval processes with roles and permissions.",
    forge: "Draft and approved states on every calendar item.",
    verdict: "parity",
  },
  {
    capability: "Team access",
    zoho: "Roles, profiles, territories and sharing rules.",
    forge: "Single owner per workspace; each person sees only their own campaigns.",
    verdict: "gap",
  },
  {
    capability: "Getting data out",
    zoho: "Exports, reports and dashboards.",
    forge: "CSV export of the full campaign calendar.",
    verdict: "parity",
  },
  {
    capability: "Cost to start",
    zoho: "Per-seat subscription across the suite.",
    forge: "A focused planner rather than a suite.",
    verdict: "lead",
  },
];

const CLOSED = [
  {
    title: "Draft and approved states",
    body: "Zoho gates campaign work behind approvals. Every calendar item now carries a draft or approved state you can flip as the plan firms up.",
  },
  {
    title: "Budget and expected return",
    body: "Zoho campaign records track budget, cost and revenue. Each campaign now stores a budget, expected return and actual spend, with the gap shown on the plan.",
  },
  {
    title: "Export the calendar",
    body: "Zoho's strength is getting data out. The full calendar downloads as a spreadsheet file so it drops straight into whatever your team already uses.",
  },
];

const PARKED = [
  "Pulling real audiences from customer records — needs a contact database we deliberately skip.",
  "Sending email and pushing ads — execution stays in the tools you already pay for.",
  "Revenue attribution — needs closed-deal data flowing back in.",
  "Shared team workspaces with roles — parked alongside realtime collaboration.",
];

const VERDICT_STYLE: Record<Row["verdict"], { label: string; className: string }> = {
  lead: { label: "We lead", className: "border-primary/40 bg-primary/15 text-primary" },
  parity: { label: "Matched", className: "border-support/40 bg-support/15 text-support" },
  gap: { label: "Gap", className: "border-warn/40 bg-warn/15 text-warn" },
};

function Compare() {
  const { isAdmin, loading } = useMyRoles();
  if (loading) return null;
  if (!isAdmin)
    return <p className="p-10 text-sm text-muted-foreground">This page is private to workspace admins.</p>;
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-5 py-16">
        <p className="eyebrow">Comparative analysis</p>
        <h1 className="mt-4 text-4xl font-semibold md:text-5xl">
          CampaignForge <span className="text-muted-foreground">vs</span> Zoho CRM
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Zoho CRM is a full customer suite with campaigns attached. CampaignForge is a planner that
          starts from a brief. Comparing them shows exactly where a focused planner wins, where it must
          not pretend to compete, and which gaps were worth closing straight away.
        </p>

        <div className="mt-12 overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface">
              <tr>
                <th className="p-4 font-display font-semibold">Capability</th>
                <th className="p-4 font-display font-semibold">Zoho CRM</th>
                <th className="p-4 font-display font-semibold">CampaignForge</th>
                <th className="p-4 font-display font-semibold">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.capability} className="border-t border-border align-top">
                  <td className="p-4 font-medium">{row.capability}</td>
                  <td className="p-4 text-muted-foreground">{row.zoho}</td>
                  <td className="p-4 text-muted-foreground">{row.forge}</td>
                  <td className="p-4">
                    <Badge variant="outline" className={VERDICT_STYLE[row.verdict].className}>
                      {VERDICT_STYLE[row.verdict].label}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="mt-16">
          <p className="eyebrow">Gaps closed in this build</p>
          <h2 className="mt-3 text-3xl font-semibold">Three things Zoho does that we now do too</h2>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {CLOSED.map((item) => (
              <div key={item.title} className="panel p-6">
                <h3 className="font-display text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <p className="eyebrow">Deliberately parked</p>
          <h2 className="mt-3 text-3xl font-semibold">Gaps we are not chasing yet</h2>
          <ul className="mt-6 space-y-3">
            {PARKED.map((item) => (
              <li key={item} className="panel flex gap-3 p-5 text-sm text-muted-foreground">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <div className="panel mt-16 flex flex-wrap items-center justify-between gap-4 p-7">
          <p className="text-sm text-muted-foreground">See the closed gaps in the product.</p>
          <div className="flex gap-2">
            <Link to="/campaigns">
              <Button>Open campaigns</Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
