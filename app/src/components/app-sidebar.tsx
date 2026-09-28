import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  ChevronsUpDown,
  ClipboardCheck,
  Dna,
  Folder,
  GitCompare,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Megaphone,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyRoles } from "@/hooks/useWorkspace";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { user, isGuest } = useAuth();
  const displayName = isGuest ? "Guest" : user?.email;
  const { roles, isAdmin } = useMyRoles();
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const recent = useQuery({
    queryKey: ["campaigns", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, title, status")
        .order("updated_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const initials = isGuest ? "G" : (user?.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-signal text-xs font-bold text-primary-foreground">
                  CF
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-display font-semibold">CampaignForge</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {isAdmin
                      ? "Workspace admin"
                      : roles.includes("reviewer")
                        ? "Reviewer"
                        : "Campaign manager"}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Dashboard" isActive={path === "/dashboard"}>
                <Link to="/dashboard">
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Company DNA" isActive={path === "/company-dna"}>
                <Link to="/company-dna">
                  <Dna />
                  <span>Company DNA</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <Collapsible asChild defaultOpen className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip="Campaigns" isActive={path.startsWith("/campaigns")}>
                    <Megaphone />
                    <span>Campaigns</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={path === "/campaigns"}>
                        <Link to="/campaigns">All campaigns</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={path === "/approvals"}>
                        <Link to="/approvals">Approvals</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Approvals" isActive={path === "/approvals"}>
                <Link to="/approvals">
                  <ClipboardCheck />
                  <span>Review queue</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Team & roles" isActive={path === "/team"}>
                <Link to="/team">
                  <Users />
                  <span>Team & roles</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {isAdmin && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="vs Zoho CRM" isActive={path === "/compare"}>
                  <Link to="/compare">
                    <GitCompare />
                    <span>vs Zoho CRM</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Recent campaigns</SidebarGroupLabel>
          <SidebarMenu>
            {(recent.data ?? []).map((c) => (
              <SidebarMenuItem key={c.id}>
                <SidebarMenuButton asChild isActive={path === `/campaigns/${c.id}`}>
                  <Link to="/campaigns/$id" params={{ id: c.id }}>
                    <Folder />
                    <span>{c.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            <SidebarMenuItem>
              <SidebarMenuButton asChild className="text-muted-foreground">
                <Link to="/campaigns">
                  <LayoutGrid />
                  <span>View all</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{displayName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {roles.join(" · ")}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-56 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  {isGuest ? "Guest — your work is saved in this browser" : user?.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
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
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
