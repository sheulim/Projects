# BudgetSense Voice — working prototype

A voice-first version of the BudgetSense MVP (see *05_BudgetSense_MVP_Playbook*). Every input is a voice note; typing exists only as a fallback.

## How to open it

1. Download `index.html` and open it in **Google Chrome or Microsoft Edge** (desktop or Android). Safari works for recording; transcription quality varies.
2. Allow microphone access when asked.
3. Choose **Speak my plan**, **Build it by hand**, or **Open with sample data**. **Me → Guided voice demo** plays the full scenario without a microphone.

To share it with others, host the single file on any static host (Netlify, GitHub Pages). The microphone needs an `https://` address or a local file.

## What it does

| Area | Voice-first behaviour | Fallback |
|---|---|---|
| Setup | One ~60-second note ("I take home 1.5 lakh, rent 32,000, saving for Goa 60,000 by December") → drafted plan to check | Single-page plan builder |
| Plan check | Live meter: must-pay / lifestyle / free money, and whether the savings target is affordable. Correct by voice: "rent is 30,000" | Edit any number |
| Logging | "Four fifty at Swiggy" → AI picks the envelope → "yes" / "make it groceries" | "Fix what I heard", "Type instead" |
| Envelopes | "Groceries limit 8,000", "pet care limit 2,000" (creates a new envelope) | ＋ New form with icon picker |
| Milestones | "New goal laptop 80,000 by March", "put 5,000 in Goa trip" → on-time or top-up forecast | ＋ New form |
| Questions | "How much is left for eating out?", "Safe to spend today?", "Can I afford 3,000 shoes?", "What did I spend on coffee?" | Tap an example question |
| Reflection | "Regret it" / "happy with it" on lifestyle spends; feeds the monthly read-out | 😊 / 😕 buttons |
| Monthly read-out | "Explain my month" → spoken summary + next step | 🔊 Listen |
| Record keeping | Every note kept with audio, transcript, time (IST) and result; CSV export | — |

Additional features beyond the reference app: safe-to-spend today, spoken limit alerts at 75% and 100%, a daily voice streak, voice Q&A, and Indian number handling (lakh, "four fifty", ₹ formatting).

## Gaps against the playbook, still to close for production

| Playbook item | Prototype today | Production build |
|---|---|---|
| Supabase sign-in and storage | Data stays in the browser on one device | Supabase auth; tables `users`, `transactions`, `budgets`, plus `goals` and `voice_notes` (audio in Supabase Storage) |
| OpenAI categorisation | On-device keyword rules | OpenAI call on each note; keep the rules as an offline fallback |
| OpenAI spending summary | Rule-based read-out | OpenAI call with month totals, over-limit envelopes and regrets |
| Speech-to-text | Browser speech recognition (Chrome/Edge) | OpenAI transcription for consistent accuracy and Hinglish support |

## Updated starting prompt for Bolt

> Build BudgetSense, a voice-first personal finance app for Indian users (INR, IST). Users sign in with Supabase. Onboarding: the user records one voice note describing take-home pay, monthly bills, lifestyle spends and one savings goal; transcribe it with OpenAI, extract a draft plan as JSON, and show it on a single editable page with a live income split. Everyday use: a persistent "Speak a money note" button records audio, stores it in Supabase Storage, transcribes it, and classifies it as an expense, income, limit change, goal top-up or question. For expenses, OpenAI suggests an envelope; the user confirms or corrects by voice ("yes", "make it groceries"). Show a Pulse screen (income split ring, safe-to-spend today, alerts at 75%/100% of a limit, milestones with forecasts), an Envelopes screen (filter by milestones, must-pay, lifestyle), a day-grouped Timeline with playback of each voice note, and a Me screen with the full voice diary and CSV export. "Explain my month" returns a short OpenAI summary with one suggestion, read aloud. Provide typed fallbacks, but keep voice as the primary input. No bank linking.
