import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — CampaignForge" },
      {
        name: "description",
        content: "Sign in to CampaignForge to create and save AI-generated campaign plans.",
      },
      { property: "og:title", content: "Sign in — CampaignForge" },
      {
        property: "og:description",
        content: "Sign in to CampaignForge to create and save AI-generated campaign plans.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName.trim(), company: company.trim() },
          },
        });
        if (error) throw error;
        if (data.user && (data.user.identities?.length ?? 0) === 0) {
          toast.error(
            "This email already has an account (maybe via Google). Use “Continue with Google” or sign in instead.",
          );
          setMode("signin");
          return;
        }
        if (data.session) {
          toast.success("Account created — welcome!");
          navigate({ to: "/dashboard" });
          return;
        }
        toast.success("Account created. Check your inbox (and spam) to confirm your email.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) toast.error("Google sign-in isn't available yet. Use email and password.");
  }

  const isSignup = mode === "signup";

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <aside className="flex flex-col gap-6 border-b border-border bg-surface px-5 py-8 md:border-b-0 md:border-r md:px-12 md:py-12">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-signal text-xs font-bold text-primary-foreground">
            CF
          </span>
          <span className="font-display text-base font-semibold tracking-tight">CampaignForge</span>
        </Link>
        <h2 className="max-w-md text-2xl font-semibold text-balance md:text-4xl">
          Plan, publish and track every campaign in one place.
        </h2>
        <ul className="hidden max-w-md space-y-3 text-sm text-muted-foreground md:block">
          <li>
            ✓ A dated plan, content ideas, ad scripts and a creative brief from one short brief
          </li>
          <li>✓ Reviewer approvals with a full history</li>
          <li>✓ Budget, spend and expected return for every campaign</li>
        </ul>
        <p className="mt-auto hidden text-xs text-muted-foreground md:block">
          Your campaigns, calendars and assets stay private to your workspace.
        </p>
      </aside>

      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-semibold">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isSignup
              ? "Start planning your first campaign in a few minutes."
              : "Sign in to pick up where you left off."}
          </p>

          <div className="panel mt-7 p-6">
            <form className="space-y-4" onSubmit={onSubmit}>
              {isSignup ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="full-name">Full name</Label>
                    <Input
                      id="full-name"
                      autoComplete="name"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      autoComplete="organization"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Company or brand"
                    />
                  </div>
                </>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Working…" : isSignup ? "Create account" : "Sign in"}
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button variant="outline" className="w-full" onClick={onGoogle}>
              Continue with Google
            </Button>
          </div>

          <button
            className="mt-5 min-h-11 w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setMode(isSignup ? "signin" : "signup")}
          >
            {isSignup ? "Already have an account? Sign in" : "No account yet? Create one"}
          </button>
        </div>
      </div>
    </main>
  );
}
