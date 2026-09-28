import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
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

type Mode = "signin" | "signup" | "forgot" | "reset" | "check-email";

/** Supabase messages rewritten in plain language, with the next step. */
function friendlyAuthError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const m = raw.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "That email and password don't match. Check them, or use “Forgot password?”.";
  if (m.includes("email not confirmed"))
    return "Your email isn't confirmed yet. Use “Resend confirmation email” below, or try as a guest.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "This email already has an account. Sign in instead.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes"))
    return "Too many attempts in a short time. Wait a minute and try again, or continue as a guest.";
  if (m.includes("password should be") || m.includes("weak password"))
    return "Choose a password of at least 6 characters.";
  if (m.includes("anonymous sign-ins are disabled"))
    return "Guest access is switched off. Create a free account with your email instead.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled"))
    return "New sign-ups are paused right now. Try again later.";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "We couldn't reach the server. Check your internet connection and try again.";
  return raw || "Something went wrong. Try again.";
}

function AuthPage() {
  const initialMode = (): Mode => {
    if (typeof window === "undefined") return "signin";
    const q = new URLSearchParams(window.location.search).get("mode");
    return q === "signup" || q === "reset" ? q : "signin";
  };
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showResend, setShowResend] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const ready = isSupabaseConfigured();

  useEffect(() => {
    if (!loading && user && mode !== "reset") navigate({ to: "/dashboard" });
  }, [loading, user, mode, navigate]);

  useEffect(() => {
    if (!ready) return;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("reset");
    });
    return () => sub.subscription.unsubscribe();
  }, [ready]);

  function switchMode(next: Mode) {
    setMode(next);
    setNotice(null);
    setShowResend(false);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      const message = friendlyAuthError(error);
      if (/isn.t confirmed/i.test(message)) setShowResend(true);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    void run(async () => {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName.trim(), company: company.trim() },
          },
        });
        if (error) throw error;
        if (data.user && (data.user.identities?.length ?? 0) === 0) {
          toast.error("This email already has an account. Sign in instead.");
          switchMode("signin");
          return;
        }
        if (data.session) {
          toast.success("Account created. Welcome!");
          navigate({ to: "/dashboard" });
          return;
        }
        setMode("check-email");
        return;
      }
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth?mode=reset`,
        });
        if (error) throw error;
        setNotice(
          "If an account exists for this email, a reset link is on its way. Check your inbox and spam folder.",
        );
        return;
      }
      if (mode === "reset") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast.success("Password updated.");
        navigate({ to: "/dashboard" });
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      navigate({ to: "/dashboard" });
    });
  }

  function onGuest() {
    void run(async () => {
      const { error } = await supabase.auth.signInAnonymously({
        options: { data: { full_name: "Guest" } },
      });
      if (error) throw error;
      toast.success("You're in as a guest. Your work is saved in this browser.");
      navigate({ to: "/dashboard" });
    });
  }

  function onResend() {
    void run(async () => {
      if (!email.trim()) throw new Error("Enter your email above first.");
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
      setNotice("Confirmation email sent again. Check your inbox and spam folder.");
    });
  }

  async function onGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error)
      toast.error("Google sign-in isn't available yet. Use email, or continue as a guest.");
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
          {!ready ? (
            <NotReady />
          ) : mode === "check-email" ? (
            <div className="panel p-6">
              <h1 className="text-2xl font-semibold">Check your email</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                We sent a confirmation link to <strong className="text-foreground">{email}</strong>.
                Open it to finish creating your account. It can take a minute, so check spam too.
              </p>
              {notice ? <p className="mt-3 text-sm text-support">{notice}</p> : null}
              <div className="mt-5 space-y-2">
                <Button variant="outline" className="w-full" disabled={busy} onClick={onResend}>
                  Resend confirmation email
                </Button>
                <Button className="w-full" disabled={busy} onClick={onGuest}>
                  Explore now as a guest
                </Button>
                <button
                  className="min-h-11 w-full text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => switchMode("signin")}
                >
                  Back to sign in
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-semibold">{TITLES[mode]}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{SUBTITLES[mode]}</p>

              {mode === "signin" || mode === "signup" ? (
                <Button
                  size="lg"
                  className="mt-6 w-full shadow-signal"
                  disabled={busy}
                  onClick={onGuest}
                >
                  Try it now — no sign-up needed
                </Button>
              ) : null}

              <div className="panel mt-5 p-6">
                <form className="space-y-4" onSubmit={onSubmit}>
                  {isSignup ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="full-name">Full name</Label>
                        <Input
                          id="full-name"
                          autoComplete="name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Your name (optional)"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="company">Company</Label>
                        <Input
                          id="company"
                          autoComplete="organization"
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          placeholder="Company or brand (optional)"
                        />
                      </div>
                    </>
                  ) : null}
                  {mode !== "reset" ? (
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
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
                  ) : null}
                  {mode !== "forgot" ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">
                          {mode === "reset" ? "New password" : "Password"}
                        </Label>
                        {mode === "signin" ? (
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => switchMode("forgot")}
                          >
                            Forgot password?
                          </button>
                        ) : null}
                      </div>
                      <Input
                        id="password"
                        type="password"
                        autoComplete={mode === "signin" ? "current-password" : "new-password"}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                      />
                    </div>
                  ) : null}
                  {notice ? <p className="text-sm text-support">{notice}</p> : null}
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? "Working…" : SUBMIT[mode]}
                  </Button>
                  {showResend ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={busy}
                      onClick={onResend}
                    >
                      Resend confirmation email
                    </Button>
                  ) : null}
                </form>

                {mode === "signin" || mode === "signup" ? (
                  <>
                    <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="h-px flex-1 bg-border" />
                      or
                      <span className="h-px flex-1 bg-border" />
                    </div>
                    <Button variant="outline" className="w-full" onClick={onGoogle}>
                      Continue with Google
                    </Button>
                  </>
                ) : null}
              </div>

              <button
                className="mt-5 min-h-11 w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
                onClick={() =>
                  switchMode(isSignup ? "signin" : mode === "signin" ? "signup" : "signin")
                }
              >
                {isSignup
                  ? "Already have an account? Sign in"
                  : mode === "signin"
                    ? "No account yet? Create one"
                    : "Back to sign in"}
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

const TITLES: Record<Mode, string> = {
  signin: "Welcome back",
  signup: "Create your account",
  forgot: "Reset your password",
  reset: "Choose a new password",
  "check-email": "Check your email",
};

const SUBTITLES: Record<Mode, string> = {
  signin: "Sign in, or try CampaignForge straight away as a guest.",
  signup: "Only an email and a password. Name and company are optional.",
  forgot: "Enter your email and we will send you a reset link.",
  reset: "Enter a new password for your account.",
  "check-email": "",
};

const SUBMIT: Record<Mode, string> = {
  signin: "Sign in",
  signup: "Create account",
  forgot: "Send reset link",
  reset: "Save new password",
  "check-email": "",
};

function NotReady() {
  return (
    <div className="panel p-6">
      <h1 className="text-2xl font-semibold">Accounts open very soon</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        We're finishing the set-up of sign-in. Meanwhile, the guided demo shows everything
        CampaignForge does, with a voice guide.
      </p>
      <a href="/demo/" className="mt-5 block">
        <Button className="w-full">Take the guided demo</Button>
      </a>
    </div>
  );
}
