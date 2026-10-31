---
name: bold-premium-ui
description: Use when designing, building or restyling any web page, landing page, portfolio site, product page or UI screen in this project — Apple-grade restraint and polish, Nike-style bold condensed display type and punchy copy, award-site (Awwwards-calibre) immersive motion, built to Figma design-system principles (8pt grid, auto layout, tokens/variables, components and variants). Also use when asked for a "bold", "premium", "immersive" or "award-worthy" web interface, or for a Figma-ready UI spec.
---

# Bold Premium UI (project skill)

Three ingredients, one system:

| Ingredient | Borrow | Never borrow |
|---|---|---|
| **Apple** | Restraint, whitespace, one accent, real product shown, calm chrome | Logos, product names, SF Pro files, real Apple imagery or taglines |
| **Nike** | Huge condensed uppercase headlines, imperative 2–5 word copy, athletic energy, full-bleed imagery | Swoosh, "Just Do It", Nike Futura / Helvetica Now files, real Nike campaigns |
| **Award sites** (user's Awwwards picks — see `references/inspirations.md`) | One cinematic scroll scene, cursor/hover micro-interactions, smooth page transitions, editorial grids | Scroll-jacking, auto-playing audio, loading screens > 2 s |

**Base layer:** if the account-level `apple-design` skill is available, load it first for tokens, restraint pass and accessibility rules. This skill *overrides* it only where stated below (type, copy, contrast of sections, motion budget).

## 1. Decide before designing (ask only if not inferable)
1. **Surface:** Flagship (landing, portfolio, launch) → full recipe below. Utility (dashboard, form, admin) → Apple restraint only; use bold type for page titles at most, no cinematic motion.
2. **Audience:** C-level / client / recruiter / consumer. Formal audiences get bold *type*, not slangy *copy*.
3. **Real content:** collect the real product screenshots, numbers and names. Never invent stats, logos or testimonials — use clearly marked placeholders (`[Client logo]`, `[Metric — source needed]`).

## 2. Typography (overrides apple-design §5)
| Role | Font (free, Google Fonts) | Size (desktop → mobile) | Weight / case | Line-height / tracking |
|---|---|---|---|---|
| Display / hero | **Anton** or **Bebas Neue** or **Archivo Black** (pick one per project) | `clamp(56px, 11vw, 168px)` | 400–900, UPPERCASE | 0.88–0.95 / -0.01em to 0 |
| Section heading | Same display font | `clamp(36px, 6vw, 88px)` | UPPERCASE | 0.95 / 0 |
| Sub-heading | **Inter Tight** | 24–32px | 600 | 1.15 / -0.015em |
| Body | **Inter** | 17–19px | 400 | 1.55 / 0 |
| Label / eyebrow | Inter | 12–14px | 600, UPPERCASE | 1.2 / +0.08em |

- Max **2 families** per page. Max **3 sizes** visible in one viewport.
- Display type is allowed to bleed off-edge, overlap imagery, or run full-width — that is the Nike signature. Body text never does.
- Use `font-display: swap`; preload the display font only.

## 3. Copy rules (Nike punch × Apple clarity)
- Hero headline **2–6 words**, imperative or declarative: "BUILD WHAT'S NEXT." / "REPORTS THAT RUN THEMSELVES."
- Sub-line ≤ 18 words, plain sentence case, says the concrete benefit.
- One idea per section. Section headings ≤ 4 words.
- Rhythm rule: big claim → proof (a real number with source) → one CTA.
- CTA verbs: Start, See, Explore, Get, Book. Never "Click here", "Submit", "Learn more" twice on a page.
- Count words before output; rewrite if over limit.
- Formal/executive audience: keep the brevity and caps, drop slang, every number still needs a source.

## 4. Colour & surfaces
- Default palette: **white `#FFFFFF` / near-black `#0A0A0A` / one accent** (e.g. volt `#D7FF3A`, signal orange `#FF4F00`, or electric blue `#2E5BFF` — pick one, define as `--accent`).
- Unlike apple-design, this skill permits **alternating black and white chapters** (max 3 dark sections per page) — this is the athletic/editorial contrast. Hero may be dark *if* it holds full-bleed imagery or video.
- Accent is used on ≤ 10% of any viewport: CTA, one highlighted word, progress indicator.
- No gradients on text. No glow. Glass only on the sticky nav.
- WCAG AA contrast everywhere; check accent-on-white (volt on white fails — use it on black only).

## 5. Layout (Figma-ready)
- **8pt grid**: all spacing is a multiple of 8 (4 allowed for icon/label nudges). Tokens: `--space-1:8px … --space-16:128px`.
- **Columns:** 12 col desktop (≥1280, 24px gutter, 80px margin), 8 col tablet (≥768, 24px gutter, 40px margin), 4 col mobile (16px gutter, 16px margin).
- **Section rhythm:** 120–160px vertical padding desktop, 72–96px mobile.
- **Page formula (flagship):**
  1. Slim sticky nav (56–64px, logo left, ≤5 links, one CTA pill right).
  2. **Hero:** full-bleed image/video + giant display headline + one sub-line + one CTA.
  3. **Statement band:** one sentence in display type, black background.
  4. **Feature chapters:** alternating split (image 7 col / text 5 col), one idea each.
  5. **Cinematic moment (exactly one):** pinned scroll scene, horizontal gallery, or image-reveal mask.
  6. **Proof:** 3 big numerals with labels and sources, or logos (real only).
  7. **Closing CTA:** display headline + button, then a minimal footer.
- Editorial asymmetry is encouraged on flagship pages (offset images, overlapping headline over image) — but every element still snaps to the grid.

## 6. Motion budget (award-site layer)
| Allowed (pick ≤ 3 per page) | Spec |
|---|---|
| Headline reveal | Line-mask slide-up, 700–900ms, `cubic-bezier(0.16,1,0.3,1)`, 60–80ms stagger per line |
| Scroll reveal | Fade + translateY 24–40px via IntersectionObserver or `animation-timeline: view()` with `@supports` fallback |
| Pinned scene | `position: sticky` chapter where image scales/clips on scroll progress |
| Image hover | Scale 1.03–1.05, 400ms; cursor-follow label ("VIEW") optional |
| Marquee | Infinite horizontal display-type strip, pauses on hover |
| Page transition | View Transitions API cross-fade, ≤ 400ms |

- Always honour `prefers-reduced-motion` (disable transforms, keep opacity fades ≤ 200ms).
- No scroll-jacking, no forced smooth-scroll libraries unless asked, no WebGL unless the user asks for it (it is what the Immersive Garden-style sites use, but it is costly — offer it, do not default to it).
- Utility surfaces: transitions ≤ 200ms, nothing else.

## 7. Figma design principles (apply and document)
When producing a design or a spec, structure it so it maps 1:1 to Figma:
1. **Variables / tokens first:** colour, spacing, radius, type are named tokens (`color/bg/primary`, `space/4`, `type/display/xl`). Code uses the same names as CSS custom properties.
2. **Auto layout everywhere:** every component is a stack (direction, gap, padding) — describe components that way; no absolute positioning except intentional overlaps.
3. **Components + variants:** Button (primary / secondary / ghost × default / hover / pressed / disabled), Card, Nav, Section header, Stat. One source, many instances.
4. **Constraints & responsiveness:** specify fill / hug / fixed for each layer; provide frames at 1440, 768 and 390 widths.
5. **Naming:** `Page / Section / Component / Element`, no "Frame 237".
6. **Hierarchy via scale, weight, space** — not borders and boxes.
7. **Consistency & alignment:** every edge on the grid; same thing looks the same everywhere.
8. **Accessibility:** contrast AA, 44px min touch targets, focus states designed (not default), text ≥ 16px on mobile.
9. **Hand-off:** list tokens, component specs and motion specs in a short table so a developer (or Figma Dev Mode) can implement without guessing.

## 8. Output format
- Default deliverable: a single responsive **HTML/CSS** page (vanilla, no framework) with tokens on `:root`, light/dark handled, mobile-first, at 16px side gutter on phones and no horizontal scroll.
- When the user asks for a design spec: produce the token table, component list (with variants), page section map and motion table from §7 — that is the "Figma-ready" spec.
- For this user (non-coder): present the result visually (artifact / screenshot), explain decisions in plain language, keep code out of the chat unless asked.

## 9. Final check (run before delivering)
- [ ] Hero headline ≤ 6 words, display font, uppercase
- [ ] Exactly one accent colour, ≤ 10% of any viewport
- [ ] Max 2 font families, max 3 sizes per viewport
- [ ] All spacing on the 8pt grid
- [ ] Exactly one cinematic moment; ≤ 3 motion types total
- [ ] `prefers-reduced-motion` respected; AA contrast passes
- [ ] No borrowed brand assets, taglines, logos or fonts
- [ ] No invented numbers, logos or testimonials — placeholders marked
- [ ] Works at 390px, 768px, 1440px
- [ ] At least one decorative element removed since the first draft (Apple restraint pass)

## 10. Automatic quality gate (hook)
A project hook (`.claude/hooks/web_quality_gate.py`, wired in `.claude/settings.json`) runs after every Write/Edit of an `.html` file. BLOCKERS must be fixed before the page is presented; WARNINGS should be fixed or the reason for keeping them stated to the user. Do not disable or bypass the hook to get a clean result.
