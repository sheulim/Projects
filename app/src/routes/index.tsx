import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { requestTour } from "@/components/guided-tour";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CampaignForge — plan, publish and track every campaign" },
      {
        name: "description",
        content:
          "CampaignForge turns a short brief into a dated campaign plan with content ideas, ad scripts and a creative brief, then tracks approvals, budget and results for every campaign.",
      },
      { property: "og:title", content: "CampaignForge — plan, publish and track every campaign" },
      {
        property: "og:description",
        content:
          "CampaignForge turns a short brief into a dated campaign plan with content ideas, ad scripts and a creative brief, then tracks approvals, budget and results for every campaign.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    title: "Plan from one brief",
    body: "Goal, audience, channels and dates in. A dated calendar, content ideas, ad scripts and a creative brief out.",
  },
  {
    title: "Channel Studio",
    body: "Separate, ready-to-post content for each channel you pick: reels, LinkedIn posts, search ads, YouTube scripts, blogs and emails.",
  },
  {
    title: "Images, voiceover and video",
    body: "Generate visuals from each post's image prompt, record an AI voiceover and build a downloadable video in the browser.",
  },
  {
    title: "Company DNA",
    body: "Save your voice, banned words and approved facts once. Every plan and post follows them.",
  },
  {
    title: "Review and approve",
    body: "Assign reviewers, approve content and keep the full history before anything is published.",
  },
  {
    title: "Budget and returns",
    body: "Set a budget and expected revenue for each campaign, record spend and see return across every campaign.",
  },
];

const STEPS = [
  { title: "Write a short brief", body: "Business, audience, goal, channels and dates." },
  {
    title: "Generate the plan",
    body: "A dated calendar with ideas, scripts and a creative brief.",
  },
  { title: "Review and approve", body: "Refine what needs work and send posts to reviewers." },
  { title: "Publish and track", body: "Export the calendar and follow spend and returns." },
];

const CHANNELS = [
  "Instagram",
  "Facebook",
  "YouTube",
  "X",
  "LinkedIn",
  "Blog",
  "Google Ads",
  "Email",
  "WhatsApp",
];

function Landing() {
  const { user } = useAuth();
  const primaryTo = user ? "/dashboard" : "/auth";
  const primaryLabel = user ? "Open your dashboard" : "Create your account";
  const navigate = useNavigate();
  const [startingTour, setStartingTour] = useState(false);

  // One tap: sign in as a guest if needed, then the voice guide tours the real app.
  async function startTour() {
    requestTour(); // unlocks sound inside this tap
    if (!isSupabaseConfigured()) {
      window.location.href = "/demo/";
      return;
    }
    setStartingTour(true);
    try {
      if (!user) {
        const { error } = await supabase.auth.signInAnonymously({
          options: { data: { full_name: "Guest" } },
        });
        if (error) throw error;
      }
      await navigate({ to: "/dashboard" });
    } catch (e) {
      console.error(e);
      toast.message("Opening the demo version of the tour.");
      window.location.href = "/demo/";
    } finally {
      setStartingTour(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-14 md:grid-cols-[1.15fr_1fr] md:pt-24">
          <div>
            <p className="eyebrow">Campaign planning and tracking</p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.05] text-balance md:text-6xl">
              Plan every campaign. <span className="text-gradient-signal">Track every rupee.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Write a short brief and get a dated plan, then ready-to-post content for every channel
              you choose: Instagram reels, LinkedIn posts, Google Ads, YouTube videos with
              voiceover, blogs and emails. Approve, publish and track every rupee.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={primaryTo}>
                <Button size="lg" className="shadow-signal">
                  {primaryLabel}
                </Button>
              </Link>
              <Button size="lg" variant="outline" disabled={startingTour} onClick={startTour}>
                {startingTour ? "Starting the tour…" : "▶ Take the guided tour"}
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              No sign-up needed. A voice guide walks you through every screen with a sample
              campaign. Turn your sound on.
            </p>
          </div>

          <div className="panel flex flex-col gap-4 p-5" aria-hidden="true">
            <div className="flex items-center justify-between">
              <span className="font-display font-semibold">Festive season push</span>
              <span className="font-mono text-xs text-support">PLAN READY</span>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 21 }).map((_, i) => (
                <span
                  key={i}
                  className={`h-7 rounded-md border border-border ${
                    [1, 3, 5, 8, 10, 12, 15, 17, 19].includes(i) ? "bg-primary/30" : "bg-surface"
                  }`}
                />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["Approved", "12 / 16"],
                ["Budget used", "58%"],
                ["Next moment", "5 days"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-border bg-background p-3">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                    {k}
                  </p>
                  <p className="mt-1 font-display text-lg font-semibold">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <p className="eyebrow">What you get</p>
            <h2 className="mt-3 max-w-xl text-3xl font-semibold text-balance md:text-4xl">
              Everything between the brief and the results
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="panel p-6">
                  <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <p className="eyebrow">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold md:text-4xl">
              From brief to results in four steps
            </h2>
            <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <div key={s.title} className="bg-surface p-6">
                  <p className="font-mono text-xs text-primary">Step {i + 1}</p>
                  <h3 className="mt-3 font-display text-base font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <p className="eyebrow">Channels</p>
            <h2 className="mt-3 text-3xl font-semibold md:text-4xl">
              Plan content for the channels you use
            </h2>
            <div className="mt-8 flex flex-wrap gap-2">
              {CHANNELS.map((c) => (
                <span key={c} className="rounded-full border border-border px-4 py-2 text-sm">
                  {c}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <div className="panel flex flex-wrap items-center justify-between gap-6 p-8">
              <h2 className="text-2xl font-semibold md:text-3xl">
                Start planning your next campaign
              </h2>
              <Link to={primaryTo}>
                <Button size="lg" className="shadow-signal">
                  {primaryLabel}
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-5 text-xs text-muted-foreground">
          <span>CampaignForge — campaign planning and tracking.</span>
          <span>© 2026 CampaignForge</span>
        </div>
      </footer>
    </div>
  );
}
