# BudgetSense Voice — working prototype

A voice-first version of the BudgetSense MVP (see *05_BudgetSense_MVP_Playbook*). Every input is a voice note; typing exists only as a fallback.

## How to open it

1. Download `index.html` and open it in **Google Chrome or Microsoft Edge** (desktop or Android). Safari works for recording; transcription quality varies.
2. Allow microphone access when asked.
3. New users: start with **Take the 2-minute voice tour**. It narrates each screen on sample figures and saves nothing. Then choose **Speak my plan** or **Build it by hand**. **Me → Guided voice demo** plays a full month by voice without a microphone.

On this repo's Netlify site, BudgetSense is served at `/budgetsense/` (CampaignForge Pro stays at the root). To share it elsewhere, host the single file on any static host (Netlify, GitHub Pages). The microphone needs an `https://` address or a local file.

## What it does

| Area | Voice-first behaviour | Fallback |
|---|---|---|
| Setup | One ~60-second note ("I take home 1.5 lakh, rent 32,000, saving for Goa 60,000 by December") → drafted plan to check | Single-page plan builder |
| Plan check | Live meter: needs / wants / free money, and whether the savings target is affordable. Correct by voice: "rent is 30,000" | Edit any number |
| Logging | "Four fifty at Swiggy" → AI picks the budget → "yes" / "make it groceries" | "Fix what I heard", "Type instead" |
| Budgets | "Groceries limit 8,000", "pet care limit 2,000" (creates a new budget) | ＋ New form with icon picker |
| Savings goals | "New goal laptop 80,000 by March", "put 5,000 in Goa trip" → on-time or top-up forecast | ＋ New form |
| Questions | "How much is left for eating out?", "Safe to spend today?", "Can I afford 3,000 shoes?", "What did I spend on coffee?" | Tap an example question |
| Reflection | "Regret it" / "happy with it" on wants; feeds the monthly read-out | 😊 / 😕 buttons |
| Monthly read-out | "Explain my month" → spoken summary + next step | 🔊 Listen |
| Tracking over time | Plan, limits, savings goals, entries and voice notes are saved on the device as you go. Each month keeps its own limits; **Me → Month by month** shows every month's in, out, savings and overdrawn budgets | — |
| Note-taking visual | A looping visual with “Taking notes” plays while a note is recorded, and “Waiting for your answer” while BudgetSense waits for a confirmation. Silent, so it never reaches the microphone | — |
| Missed spends | Evening check-in (default 9 pm): “10 to a beggar, 5 for the cobbler and 40 on chai” saves all three at once | “Nothing today” |
| Bank alerts | Paste one or many bank, UPI or card alert messages or emails; amount, payee, date and account are read, duplicates and OTPs skipped | Untick any line before adding |
| Automatic payments | Repeating charges and AutoPay / e-mandate alerts are listed with monthly and yearly cost; mark “Keep” or “Cancel it”. Ask: “What are my automatic payments?” | — |
| Spending alarm | Beep, vibration and a spoken warning when the month's spending crosses 50%, 75%, 90% and 100% of income | Switch off in Me |
| Before you buy | “Should I buy a 45,000 phone?” → month-end before/after, budget impact, goal slip in months, verdict (Go ahead / Possible / Not this month) and actions: move budget & buy, save for it, not now | Form on Overview |
| Move money | “Move 2,000 from shopping to eating out” shifts money between budgets | ↔ Move form on Budgets |
| Forecast & pace | Month-end forecast after bills, goals and usual spending; pace badge (“spending 1.4× faster than the month”) | — |
| Statement upload | Choose this month's bank statement (PDF, including password-protected, CSV or Excel). Every UPI payment is read, payee named from the narration, ATM and ACH/NACH mandates recognised, duplicates skipped. Read on the device only | — |
| Connect bank or UPI | Account Aggregator consent flow: choose bank or UPI app, review exactly what is shared (transactions only, period, purpose, revoke any time), confirm. Runs on sample data; live linking needs an RBI-regulated partner | Upload statement / paste alerts |
| Spending log tools | Filter money in/out, by budget, search; edit budget or amount, delete (two taps); each entry shows its source and account (e.g. "statement · UPI ··1234"); a note shows the last import | — |
| Month header | Income this month and days left, always at the top | — |
| Sign-in and sync | Email sign-in (link or 6-digit code) with Supabase. Plan, budgets, goals, entries and transcripts sync between devices; entries are merged by id, so a phone and a PC never overwrite each other. Voice audio stays on the device | Works fully offline without signing in |
| Automatic capture | Bank SMS (Android, via MacroDroid) and bank emails (Gmail, via a ready-filled Apps Script) are posted to a private inbox; the app reads them every minute while open, adds the payments, then deletes the messages from the server. The same payment arriving by SMS and by email is counted once; two identical payments with different bank references are both kept | Paste alerts, upload statement |
| Record keeping | Every note kept with audio, transcript, time (IST) and result; CSV export | — |

Additional features beyond the reference app: safe-to-spend today, spoken limit alerts at 75% and 100%, a daily voice streak, voice Q&A, and Indian number handling (lakh, "four fifty", ₹ formatting).

## Screens

**Overview** (the month at a glance), **Budgets** (monthly limits, grouped as *Needs*, *Wants* and *Savings goals*), **Spending log** (every entry, day by day) and **Me** (account, settings, month history, voice diary).

## Sign-in, sync and automatic capture: one-time setup

1. **Supabase project** → SQL Editor → New query → paste `supabase/setup.sql` → Run.
2. **Authentication → URL Configuration**: set the Site URL to the address where BudgetSense runs (for this repo, `https://campaign-forge.netlify.app/budgetsense/`) and add the same address under Redirect URLs.
3. *Optional, recommended:* **Authentication → Email Templates** → *Magic Link* and *Confirm signup*: add `Your code: {{ .Token }}`, so the 6-digit code works when the emailed link opens in a different browser.
4. In BudgetSense: **Me → Sign in and sync** → paste the project address and publishable (anon) key from **Project Settings → API** → email yourself a link → sign in.
5. **Me → Set up automatic capture**, then follow the two guides shown there: *Bank SMS on Android (MacroDroid)* and *Bank emails from Gmail*. **Send a test** confirms the path works.

Security: every table has row-level security; the publishable key and the capture key can only add messages to your inbox, never read anything. SMS and email text is deleted from the server as soon as the app reads it.

To spare other users step 4's connection details, put the project address and publishable key in `SB_DEFAULT` near the top of the account section in `index.html`.

## Gaps against the playbook, still to close for production

| Playbook item | Prototype today | Production build |
|---|---|---|
| Supabase sign-in and storage | Done: email sign-in, sync of the whole plan as one row per person, capture inbox | Split into `transactions`, `budgets`, `goals` tables if reporting across users is needed; voice audio to Supabase Storage |
| OpenAI categorisation | On-device keyword rules | OpenAI call on each note; keep the rules as an offline fallback |
| OpenAI spending summary | Rule-based read-out | OpenAI call with month totals, over-limit budgets and regrets |
| Speech-to-text | Browser speech recognition (Chrome/Edge) | OpenAI transcription for consistent accuracy and Hinglish support |

## Updated starting prompt for Bolt

> Build BudgetSense, a voice-first personal finance app for Indian users (INR, IST). Users sign in with Supabase. Onboarding: the user records one voice note describing take-home pay, monthly bills, lifestyle spends and one savings goal; transcribe it with OpenAI, extract a draft plan as JSON, and show it on a single editable page with a live income split. Everyday use: a persistent "Speak a money note" button records audio, stores it in Supabase Storage, transcribes it, and classifies it as an expense, income, limit change, goal top-up or question. For expenses, OpenAI suggests a budget; the user confirms or corrects by voice ("yes", "make it groceries"). Show an Overview screen (income split ring, safe-to-spend today, alerts at 75%/100% of a limit, savings goals with forecasts), a Budgets screen (filter by savings goals, needs, wants), a day-grouped Spending log with playback of each voice note, and a Me screen with the full voice diary and CSV export. "Explain my month" returns a short OpenAI summary with one suggestion, read aloud. Provide typed fallbacks, but keep voice as the primary input. Sync through Supabase; capture bank SMS and emails into a per-user inbox. No direct bank linking.

## Where data is saved

Everything is saved automatically in the browser on the device you use: the plan and limits, a snapshot of each month's limits, savings goals, every entry, and every voice note (audio and transcript). It survives closing and reopening the page. Without signing in it is **not** shared between devices or browsers, and clearing the browser's site data removes it. After signing in, everything except voice audio is also kept in your Supabase account and synced to your other devices.

## Testing

`node budgetsense/tests/account.js` runs 11 checks against an in-memory stand-in for Supabase: plain tab names, sign-in by code and by emailed link, automatic capture (SMS and email of one payment counted once, chats ignored, repeat payments kept), sync up and merge across two devices, the test button, the Gmail script, expired sign-in, and phone layout. `supabase/setup.sql` was checked on PostgreSQL 16 with stand-ins for Supabase's `auth` schema and roles.

`node budgetsense/tests/e2e.js` runs 45 end-to-end checks (set `BS_LIBS` to a folder holding `pdfjs-dist-3.11.174/` and `xlsx-0.18.5/` from npm if the machine cannot reach cdnjs) in Chromium with a simulated microphone and speech engine: the voice tour, the note-taking visual, multi-item notes, the evening check-in, bank alert import with duplicate detection, automatic payments, the spending alarm, before-you-buy verdicts, moving money between envelopes, statement upload (CSV, Excel, PDF), the connect-bank consent flow, timeline edit/delete/filter, voice and manual setup, every voice command, typed fallbacks, envelopes, milestones, questions, month history and per-month limits, persistence of data and audio after reload, the guided demo, a refused microphone, and layout at 360px, 390px and desktop widths.
