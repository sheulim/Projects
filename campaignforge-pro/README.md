# CampaignForge Pro — product design

A campaign and portfolio management product that extends [CampaignForge](https://github.com/sheulim/insightful-campaign-buddy): AI planning from one brief, ready-to-post output for every social channel, and a portfolio layer for budget, timeline, risk and executive reporting.

**Live site:** https://campaign-forge.netlify.app

**Interactive design:** https://claude.ai/artifact/2U64oiurGdf6ph7AbK5ABh (private to the owner until shared from the page's Share menu)

> All figures, names and the brand “Kesar & Co.” in the screens are sample data.

## Screens

| # | Screen | File | What it does |
|---|---|---|---|
| 01 | Portfolio command centre | `design/Main.dc.html` | KPIs, pacing alerts, campaign health, this week, content mix by channel, upcoming moments, setup checklist |
| 02 | Company DNA | `design/Brand.dc.html` | Brand voice, words to use and avoid, product facts, persona, colours, languages, disclaimer, guardrail checks |
| 2b | Moments calendar | `design/Dates.dc.html` | Annual festivals, holidays and shopping days for India (national and states) and international markets, with brand fit and lead time |
| + | New campaign | `design/New.dc.html` | Templates, brief with voice input and AI writing help, target markets, channels, tone, language, posts per week, live generation progress |
| 03 | Plan workspace | `design/Plan.dc.html` | Month calendar by channel, moments with “Add content”, target days, filters, approve visible, Refine with AI |
| 04 | Readiness score | `design/Score.dc.html` | Rubric score out of 100, history, quick fixes |
| 05 | Post studio | `design/Studio.dc.html` | Status workflow, copy variants, brand checks, channel previews |
| 5b | Creative brief | `design/Brief.dc.html` | Structured brief, deliverables by platform, concept images, hand-off to video |
| 06 | Video studio | `design/Reel.dc.html` | Storyboard, AI voiceover, captions; reels, Shorts and YouTube from one script |
| 6b | Publish hub | `design/Publish.dc.html` | Every channel's formats, platform checks, auto-post / draft / export package |
| 07 | Budget planner & ROI | `design/Budget.dc.html` | Total, currency, priority → AI split by channel and week; spend, CPL, CAC, pacing, reallocation |
| 08 | Timeline & tasks | `design/Timeline.dc.html` | Gantt with stage gates and dependencies; task board |
| 09 | Prioritise & risks | `design/Prioritise.dc.html` | RICE / WSJF ranking, impact-effort matrix, risk log, team load |
| 10 | Executive status report | `design/Report.dc.html` | One-page leadership report with export |

Channels covered: Instagram, Facebook, YouTube, X, LinkedIn, TikTok (non-India markets), Blog, Google Ads, Email, WhatsApp.

## Proposed phasing

1. **Phase 1:** campaign types, Company DNA, moments calendar, Refine with AI, readiness score, calendar and approvals, budget planner, dashboard, ready-to-post output with export packages for every channel.
2. **Phase 2:** auto-posting through connected accounts (after each platform's app approval), portfolio timeline and tasks, prioritisation, risks, executive report.
3. **Phase 3:** full video generation at scale and live spend feeds from ad platforms (paid APIs; cost before committing).

## Working site

`site/index.html` is a standalone, clickable version of all 14 screens (no build tools or server needed; open it in a browser or host it on GitHub Pages). It reuses the design files directly: `site/build.py` reads `design/*.dc.html` and regenerates `site/index.html`, so after editing a screen run:

```
cd campaignforge-pro/site && python3 build.py
```

## About the files

The `.dc.html` files are Design Component source for the Claude Design canvas; `design/canvas.json` holds the board layout. They render inside the design canvas (linked above), not as standalone web pages.
