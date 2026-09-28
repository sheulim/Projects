import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AppRole = "admin" | "manager" | "reviewer";

export function useMyRoles() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["my_roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      if (error) throw error;
      return data.map((r) => r.role as AppRole);
    },
  });
  const roles = q.data ?? [];
  return { roles, isAdmin: roles.includes("admin"), isReviewer: roles.includes("reviewer"), loading: q.isLoading };
}

export function useMembers() {
  return useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_members");
      if (error) throw error;
      return (data ?? []).map((m) => ({ ...m, roles: (m.roles ?? []) as AppRole[] }));
    },
  });
}

export function memberName(m?: { full_name: string | null; email: string | null } | null) {
  return m?.full_name || m?.email || "Unknown";
}
