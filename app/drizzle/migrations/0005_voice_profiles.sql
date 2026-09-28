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
