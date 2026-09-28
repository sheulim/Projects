import { Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { TourProvider, useTour } from "@/components/guided-tour";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  "company-dna": "Company DNA",
  campaigns: "Campaigns",
  approvals: "Review queue",
  team: "Team & roles",
};

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const parts = path.split("/").filter(Boolean);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return <div className="px-5 py-24 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <SidebarProvider>
      <TourProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">Workspace</BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    {LABELS[parts[0] ?? ""] ?? "Home"}
                    {parts[1] ? " / Detail" : ""}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <TourButton />
          </header>
          <Outlet />
        </SidebarInset>
      </TourProvider>
    </SidebarProvider>
  );
}

function TourButton() {
  const { start, running } = useTour();
  return (
    <Button size="sm" variant="outline" className="ml-auto" disabled={running} onClick={start}>
      ▶ Guided tour
    </Button>
  );
}
