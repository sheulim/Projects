import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { memberName, useMembers, useMyRoles, type AppRole } from "@/hooks/useWorkspace";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team & roles — CampaignForge" },
      { name: "description", content: "Manage workspace roles: admins, campaign managers and reviewers." },
      { property: "og:title", content: "Team & roles — CampaignForge" },
      { property: "og:description", content: "Manage workspace roles: admins, campaign managers and reviewers." },
    ],
  }),
  component: TeamPage,
});

const ROLES: { role: AppRole; label: string; hint: string }[] = [
  { role: "admin", label: "Admin", hint: "Manages roles" },
  { role: "manager", label: "Manager", hint: "Owns campaigns" },
  { role: "reviewer", label: "Reviewer", hint: "Approves items" },
];

function TeamPage() {
  const members = useMembers();
  const { isAdmin } = useMyRoles();
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: async (v: { user: string; role: AppRole; on: boolean }) => {
      const { error } = await supabase.rpc("set_user_role", { _user_id: v.user, _role: v.role, _enabled: v.on });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["my_roles"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update role."),
  });

  return (
    <main className="mx-auto w-full max-w-5xl p-6">
      <h1 className="text-2xl font-semibold">Team & roles</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isAdmin ? "Turn roles on or off for each member." : "Only admins can change roles."}
      </p>
      <div className="panel mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="p-4 font-medium">Member</th>
              {ROLES.map((r) => (
                <th key={r.role} className="p-4 font-medium">
                  {r.label}
                  <span className="block text-xs font-normal text-muted-foreground">{r.hint}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(members.data ?? []).map((m) => (
              <tr key={m.id} className="border-b border-border last:border-0">
                <td className="p-4">
                  <p className="font-medium">{memberName(m)}</p>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                </td>
                {ROLES.map((r) => (
                  <td key={r.role} className="p-4">
                    <Switch
                      checked={m.roles.includes(r.role)}
                      disabled={!isAdmin || toggle.isPending}
                      onCheckedChange={(on) => toggle.mutate({ user: m.id, role: r.role, on })}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
