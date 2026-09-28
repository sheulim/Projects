# CampaignForge — setup

CampaignForge is one app, hosted on Netlify. The Lovable app has been merged into it.
Follow these steps once. No coding is needed.

## 1. Create the database (Supabase)

1. Sign in at supabase.com and create a new project. Keep the database password private.
2. Open **SQL Editor → New query**, paste the whole of `app/supabase/setup.sql`, and click **Run**.
   This creates the tables, the security rules and the private `campaign-media` storage bucket.
3. Open **Project Settings → API** and copy two values:
   - **Project URL**
   - **Publishable (anon) key** — this key is designed to be public.
4. Open **Authentication → URL Configuration**:
   - Site URL: `https://campaign-forge.netlify.app`
   - Redirect URLs: add `https://campaign-forge.netlify.app/**` and `https://*--campaign-forge.netlify.app/**` (deploy previews).

5. Make sign-in easy (recommended while CampaignForge is an MVP):
   - **Authentication → Sign In / Providers → Email**: switch **Confirm email** off. New users are signed in straight after sign-up, with no email to wait for.
   - **Authentication → Sign In / Providers**: switch **Allow anonymous sign-ins** on. This powers the "Try it now — no sign-up needed" button.
   Turn email confirmation back on later, once you have your own email sender (SMTP) set up.

## 2. Add the keys to Netlify

Netlify → **Site configuration → Environment variables → Add a variable**. Never paste keys into chat or code.

| Variable | Value | Needed for |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase Project URL | Sign-in and data |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key | Sign-in and data |
| `SUPABASE_URL` | Same Project URL | AI jobs |
| `SUPABASE_PUBLISHABLE_KEY` | Same publishable key | AI jobs |
| `ANTHROPIC_API_KEY` | From console.anthropic.com | Plans, strategy, all channel text |
| `OPENAI_API_KEY` | From platform.openai.com | Images and voiceover |

Optional: `OPENAI_IMAGE_MODEL` (default `gpt-image-1`), `OPENAI_TTS_MODEL` (default `gpt-4o-mini-tts`), `OPENAI_TTS_VOICE` (default `alloy`), `OPENAI_TOUR_VOICE` (the guided tour's voice; defaults to `OPENAI_TTS_VOICE`).

The guided tour uses `OPENAI_API_KEY` for a natural voice. Each line is recorded once and then served from Netlify's cache. Without the key, the tour uses the browser's built-in voice.

After adding variables, trigger a new deploy: **Deploys → Trigger deploy → Deploy site**.

## 3. Optional: Google sign-in

Supabase → **Authentication → Providers → Google**: enable it and add a Google OAuth client ID and secret.
Until then, email sign-up works and the Google button shows a friendly message.

## 4. Test

1. Open the site and press **Try it now — no sign-up needed**, or create an account.
2. Fill in **Company DNA**.
3. Create a campaign, click **Generate plan** (about 1–2 minutes).
4. Open **Channel Studio**, pick channels and click **Generate**. Then try **Generate image**, **Generate voiceover** and **Make video** on Instagram or YouTube.

On the home page, **▶ Take the guided tour** signs the visitor in as a guest, adds a sample campaign and walks through every screen with a voice guide. Signed-in users can replay it with **▶ Guided tour** at the top of any page. Before Supabase is connected, the button opens the older demo at `/demo/` instead.
