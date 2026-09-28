# CampaignForge app

This app is deployed on Netlify (see `/netlify.toml` at the repository root) and is no longer connected to Lovable.

- Build: `npm run build` (Nitro `netlify` preset, output in `dist/` and `.netlify/functions-internal/`).
- Server-side secrets (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) live in Netlify environment variables, never in code.
- Database: Supabase. Run `supabase/setup.sql` once in the Supabase SQL editor for a new project.
