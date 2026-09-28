-- CampaignForge: full database setup for a NEW Supabase project.
-- Paste this whole file into Supabase > SQL Editor > New query, then Run. Run it once.

-- ===== 0000_campaignforge_core.sql =====
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Campaigns
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  title TEXT NOT NULL,
  business_brief TEXT NOT NULL DEFAULT '',
  target_audience TEXT NOT NULL DEFAULT '',
  campaign_goal TEXT NOT NULL DEFAULT '',
  channels TEXT[] NOT NULL DEFAULT '{}',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own campaigns" ON public.campaigns FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX campaigns_user_idx ON public.campaigns (user_id, created_at DESC);

-- Calendar items
CREATE TABLE public.calendar_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  item_date DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  item_type TEXT NOT NULL DEFAULT 'content',
  channel TEXT NOT NULL DEFAULT 'social',
  status TEXT NOT NULL DEFAULT 'draft',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_items TO authenticated;
GRANT ALL ON public.calendar_items TO service_role;
ALTER TABLE public.calendar_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own calendar items" ON public.calendar_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX calendar_items_campaign_idx ON public.calendar_items (campaign_id, item_date);

-- Generated assets
CREATE TABLE public.generated_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  asset_type TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_assets TO authenticated;
GRANT ALL ON public.generated_assets TO service_role;
ALTER TABLE public.generated_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own assets" ON public.generated_assets FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX generated_assets_campaign_idx ON public.generated_assets (campaign_id, asset_type);

-- ===== 0001_campaign_budget_fields.sql =====
ALTER TABLE public.campaigns
  ADD COLUMN budget NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN expected_revenue NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN actual_cost NUMERIC NOT NULL DEFAULT 0;
-- ===== 0002_roles_approvals_recommendations.sql =====

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

-- ===== 0003_restrict_member_visibility.sql =====
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
-- ===== 0004_company_dna_channel_assets.sql =====
-- Company DNA: one brand profile per user, applied to every AI generation.
CREATE TABLE public.brand_dna (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name text NOT NULL DEFAULT '',
  voice text NOT NULL DEFAULT '',
  phrases_use text NOT NULL DEFAULT '',
  words_avoid text NOT NULL DEFAULT '',
  facts text NOT NULL DEFAULT '',
  persona text NOT NULL DEFAULT '',
  example_post text NOT NULL DEFAULT '',
  disclaimer text NOT NULL DEFAULT '',
  languages text NOT NULL DEFAULT 'English',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_dna TO authenticated;
GRANT ALL ON public.brand_dna TO service_role;
ALTER TABLE public.brand_dna ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own brand dna" ON public.brand_dna FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Channel Studio: ready-to-post content generated for each channel of a campaign.
CREATE TABLE public.channel_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  channel text NOT NULL,
  title text NOT NULL DEFAULT '',
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  image_path text,
  audio_path text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_assets TO authenticated;
GRANT ALL ON public.channel_assets TO service_role;
ALTER TABLE public.channel_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own channel assets" ON public.channel_assets FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Reviewers view assigned channel assets" ON public.channel_assets FOR SELECT TO authenticated
  USING (public.is_campaign_reviewer(campaign_id, auth.uid()));
CREATE INDEX channel_assets_campaign_idx ON public.channel_assets (campaign_id, channel, created_at DESC);

-- Private storage for generated images and voiceovers, one folder per user.
INSERT INTO storage.buckets (id, name, public) VALUES ('campaign-media', 'campaign-media', false)
  ON CONFLICT (id) DO NOTHING;
CREATE POLICY "own media read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'campaign-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own media insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'campaign-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own media update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'campaign-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own media delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'campaign-media' AND (storage.foldername(name))[1] = auth.uid()::text);


-- ===== 0005_voice_profiles.sql =====
-- One cloned voice per user (Fish Audio), created only from the user's own recording with consent.
CREATE TABLE public.voice_profiles (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'fish_audio',
  model_id text,
  title text NOT NULL DEFAULT '',
  sample_path text,
  test_audio_path text,
  status text NOT NULL DEFAULT 'none',
  error text,
  consent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_profiles TO authenticated;
GRANT ALL ON public.voice_profiles TO service_role;
ALTER TABLE public.voice_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own voice profile" ON public.voice_profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
