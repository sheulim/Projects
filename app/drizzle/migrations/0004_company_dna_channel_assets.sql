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
