
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'reviewer');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Members can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);

-- Admin role management via RPC only
CREATE OR REPLACE FUNCTION public.set_user_role(_user_id uuid, _role public.app_role, _enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only admins can change roles'; END IF;
  IF _enabled THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (_user_id, _role) ON CONFLICT DO NOTHING;
  ELSE
    IF _role = 'admin' AND _user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot remove your own admin role'; END IF;
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_user_role FROM anon;

-- Default roles on signup: first user admin, everyone manager
CREATE OR REPLACE FUNCTION public.assign_default_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'manager') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_profile_created_roles AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.assign_default_roles();

-- Backfill existing users
INSERT INTO public.user_roles(user_id, role) SELECT id, 'manager' FROM public.profiles ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles(user_id, role)
  SELECT id, 'admin' FROM public.profiles ORDER BY created_at LIMIT 1 ON CONFLICT DO NOTHING;

-- Workspace members can see each other's names to assign reviewers
CREATE POLICY "Members can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);

-- Reviewers
CREATE TABLE public.campaign_reviewers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, reviewer_id)
);
GRANT SELECT, INSERT, DELETE ON public.campaign_reviewers TO authenticated;
GRANT ALL ON public.campaign_reviewers TO service_role;
ALTER TABLE public.campaign_reviewers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_campaign_owner(_campaign_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.campaigns WHERE id = _campaign_id AND user_id = _user_id)
$$;
CREATE OR REPLACE FUNCTION public.is_campaign_reviewer(_campaign_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.campaign_reviewers WHERE campaign_id = _campaign_id AND reviewer_id = _user_id)
$$;

CREATE POLICY "Owner or reviewer view reviewers" ON public.campaign_reviewers FOR SELECT TO authenticated
  USING (public.is_campaign_owner(campaign_id, auth.uid()) OR reviewer_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Owner assigns reviewers" ON public.campaign_reviewers FOR INSERT TO authenticated
  WITH CHECK (public.is_campaign_owner(campaign_id, auth.uid()) AND assigned_by = auth.uid()
    AND public.has_role(reviewer_id, 'reviewer'));
CREATE POLICY "Owner removes reviewers" ON public.campaign_reviewers FOR DELETE TO authenticated
  USING (public.is_campaign_owner(campaign_id, auth.uid()));

-- Reviewers can read assigned campaigns
CREATE POLICY "Reviewers view assigned campaigns" ON public.campaigns FOR SELECT TO authenticated
  USING (public.is_campaign_reviewer(id, auth.uid()));
CREATE POLICY "Reviewers view assigned items" ON public.calendar_items FOR SELECT TO authenticated
  USING (public.is_campaign_reviewer(campaign_id, auth.uid()));
CREATE POLICY "Reviewers view assigned assets" ON public.generated_assets FOR SELECT TO authenticated
  USING (public.is_campaign_reviewer(campaign_id, auth.uid()));

-- Approval history
CREATE TABLE public.approval_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  item_kind text NOT NULL CHECK (item_kind IN ('calendar_item','asset')),
  item_id uuid NOT NULL,
  item_title text NOT NULL DEFAULT '',
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('submitted','approved','changes_requested','reopened')),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.approval_events TO authenticated;
GRANT ALL ON public.approval_events TO service_role;
ALTER TABLE public.approval_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner or reviewer view history" ON public.approval_events FOR SELECT TO authenticated
  USING (public.is_campaign_owner(campaign_id, auth.uid()) OR public.is_campaign_reviewer(campaign_id, auth.uid()));
CREATE INDEX approval_events_campaign_idx ON public.approval_events(campaign_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.record_approval(_kind text, _item_id uuid, _action text, _note text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _campaign uuid; _title text; _status text; _owner boolean; _reviewer boolean;
BEGIN
  IF _kind = 'calendar_item' THEN
    SELECT campaign_id, title INTO _campaign, _title FROM public.calendar_items WHERE id = _item_id;
  ELSIF _kind = 'asset' THEN
    SELECT campaign_id, title INTO _campaign, _title FROM public.generated_assets WHERE id = _item_id;
  ELSE RAISE EXCEPTION 'Unknown item kind'; END IF;
  IF _campaign IS NULL THEN RAISE EXCEPTION 'Item not found'; END IF;

  _owner := public.is_campaign_owner(_campaign, auth.uid());
  _reviewer := public.is_campaign_reviewer(_campaign, auth.uid());

  IF _action IN ('submitted','reopened') THEN
    IF NOT _owner THEN RAISE EXCEPTION 'Only the campaign owner can do that'; END IF;
    _status := CASE WHEN _action = 'submitted' THEN 'in_review' ELSE 'draft' END;
  ELSIF _action IN ('approved','changes_requested') THEN
    IF NOT _reviewer THEN RAISE EXCEPTION 'Only assigned reviewers can approve or request changes'; END IF;
    _status := CASE WHEN _action = 'approved' THEN 'approved' ELSE 'changes_requested' END;
  ELSE RAISE EXCEPTION 'Unknown action'; END IF;

  IF _kind = 'calendar_item' THEN
    UPDATE public.calendar_items SET status = _status WHERE id = _item_id;
  ELSE
    UPDATE public.generated_assets SET status = _status WHERE id = _item_id;
  END IF;

  INSERT INTO public.approval_events(campaign_id, item_kind, item_id, item_title, actor_id, action, note)
  VALUES (_campaign, _kind, _item_id, coalesce(_title,''), auth.uid(), _action, left(coalesce(_note,''), 1000));
END $$;
REVOKE EXECUTE ON FUNCTION public.record_approval FROM anon;

-- AI recommendations
CREATE TABLE public.campaign_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brief text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.campaign_recommendations TO authenticated;
GRANT ALL ON public.campaign_recommendations TO service_role;
ALTER TABLE public.campaign_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner or reviewer view recs" ON public.campaign_recommendations FOR SELECT TO authenticated
  USING (public.is_campaign_owner(campaign_id, auth.uid()) OR public.is_campaign_reviewer(campaign_id, auth.uid()));
CREATE POLICY "Owner creates recs" ON public.campaign_recommendations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_campaign_owner(campaign_id, auth.uid()));
CREATE POLICY "Owner deletes recs" ON public.campaign_recommendations FOR DELETE TO authenticated
  USING (public.is_campaign_owner(campaign_id, auth.uid()));
