import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { user, loading, isGuest } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-signal text-xs font-bold text-primary-foreground">
            CF
          </span>
          <span className="font-display text-base font-semibold tracking-tight">CampaignForge</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {user ? (
            <Link
              to="/dashboard"
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Dashboard
            </Link>
          ) : null}
        </nav>

        <div className="flex items-center gap-2">
          {loading ? null : user ? (
            <>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {isGuest ? "Guest" : user.email}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (
                    isGuest &&
                    !window.confirm(
                      "You're using a guest account. If you sign out, you can't get back to this work. Sign out anyway?",
                    )
                  )
                    return;
                  await supabase.auth.signOut();
                  navigate({ to: "/" });
                }}
              >
                Sign out
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => navigate({ to: "/auth" })}>
              Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
