DROP POLICY IF EXISTS "Members can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Members can view roles" ON public.user_roles;
CREATE POLICY "View own roles or admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.list_members()
RETURNS TABLE(id uuid, full_name text, email text, created_at timestamptz, roles public.app_role[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id,
    coalesce(nullif(p.full_name,''), split_part(p.email,'@',1)),
    CASE WHEN p.id = auth.uid() OR public.has_role(auth.uid(),'admin') THEN p.email ELSE NULL END,
    p.created_at,
    coalesce(ARRAY(SELECT r.role FROM public.user_roles r WHERE r.user_id = p.id
      AND (p.id = auth.uid() OR public.has_role(auth.uid(),'admin') OR r.role = 'reviewer')), '{}')
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
  ORDER BY p.created_at;
$$;
REVOKE ALL ON FUNCTION public.list_members() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_members() TO authenticated;