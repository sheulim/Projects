import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { TOUR_STEPS, type TourStep, type TourTarget } from "@/lib/tour/script";
import { ensureSampleCampaign } from "@/lib/tour/sample";
import { prefetchLine, speakLine, stopVoice, unlockVoice } from "@/lib/tour/voice";

const stepAt = (i: number): TourStep =>
  TOUR_STEPS[Math.min(Math.max(i, 0), TOUR_STEPS.length - 1)]!;

const SEEN_KEY = "cf-tour-seen";
let pendingStart = false;

/** Ask the tour to start when the signed-in area next opens (e.g. from the landing page). */
export function requestTour() {
  unlockVoice();
  pendingStart = true;
}

export function tourSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

type TourApi = { start: () => void; running: boolean };
const TourContext = createContext<TourApi>({ start: () => undefined, running: false });
export const useTour = () => useContext(TourContext);

/** Campaign pages listen for this to switch tabs during the tour. */
export const TOUR_TAB_EVENT = "cf:tour-tab";

function visible(el: Element | null): el is HTMLElement {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function findTarget(t: TourTarget | undefined): HTMLElement | null {
  if (!t) return null;
  if (t.sel) {
    const el = document.querySelector(t.sel);
    if (visible(el)) return el;
  }
  if (t.text) {
    let best: HTMLElement | null = null;
    document.querySelectorAll<HTMLElement>("main *").forEach((n) => {
      if (n.children.length > 3) return;
      const text = (n.textContent ?? "").trim();
      if (text.startsWith(t.text!) && (!best || text.length < (best.textContent ?? "").length))
        best = n;
    });
    if (best) {
      const up = t.up ? (best as HTMLElement).closest<HTMLElement>(t.up) : null;
      const el = up ?? best;
      if (visible(el)) return el;
    }
  }
  // On phones the menu is folded away: point at the menu button instead.
  const trigger = document.querySelector("[data-sidebar='trigger']");
  return t.sel?.includes("sidebar") && visible(trigger) ? trigger : null;
}

async function waitFor<T>(fn: () => T | null, ms = 5000): Promise<T | null> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 120));
  }
  return null;
}

type Hint = null | "blocked" | "silent" | "unsupported";

export function TourProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const pathRef = useRef(path);
  pathRef.current = path;
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [running, setRunning] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [talking, setTalking] = useState(false);
  const [hint, setHint] = useState<Hint>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const sampleId = useRef<string | null>(null);
  const target = useRef<HTMLElement | null>(null);
  const run = useRef(0); // bumps on every step change, so stale async work stops
  const state = useRef({ paused, muted, index, running });
  state.current = { paused, muted, index, running };
  const advance = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const say = useCallback((step: TourStep, my: number) => {
    clearTimeout(advance.current);
    setHint(null);
    const next = () => {
      if (my !== run.current || state.current.paused) return;
      setTalking(false);
      advance.current = setTimeout(() => {
        if (my === run.current && !state.current.paused)
          void goRef.current(state.current.index + 1);
      }, 1200);
    };
    if (state.current.paused) return;
    if (state.current.muted) {
      stopVoice();
      advance.current = setTimeout(next, Math.max(4000, step.say.split(" ").length * 380));
      return;
    }
    speakLine(step, {
      onStart: () => my === run.current && setTalking(true),
      onEnd: next,
      onBlocked: (reason) => {
        if (my !== run.current) return;
        setTalking(false);
        setHint(reason);
      },
    });
  }, []);

  const end = useCallback(() => {
    run.current++;
    clearTimeout(advance.current);
    stopVoice();
    setRunning(false);
    setPreparing(false);
    setTalking(false);
    setRect(null);
    target.current = null;
    markSeen();
  }, []);

  const go = useCallback(
    async (n: number) => {
      if (n >= TOUR_STEPS.length) {
        end();
        toast.success("Tour finished. The sample campaign is in your campaign list.");
        return;
      }
      const i = Math.max(0, n);
      const my = ++run.current;
      clearTimeout(advance.current);
      stopVoice();
      setTalking(false);
      setHint(null);
      setIndex(i);
      target.current = null;
      const step = stepAt(i);
      prefetchLine(TOUR_STEPS[i + 1]);

      const to = step.page === "sample" ? `/campaigns/${sampleId.current}` : step.page;
      if (pathRef.current !== to) void navigate({ to });

      if (step.openBrief) {
        const btn = await waitFor(
          () =>
            [...document.querySelectorAll<HTMLButtonElement>("main button")].find(
              (b) => b.textContent?.trim() === "New campaign",
            ) ?? null,
        );
        if (my !== run.current) return;
        if (btn && !document.querySelector("[data-tour='brief-form']")) btn.click();
      }
      if (step.tab) {
        await waitFor(() => document.querySelector("[data-tour='tabs']"));
        if (my !== run.current) return;
        window.dispatchEvent(new CustomEvent(TOUR_TAB_EVENT, { detail: step.tab }));
      }
      const el = await waitFor(() => findTarget(step.target), 4000);
      if (my !== run.current) return;
      target.current = el;
      el?.scrollIntoView({
        behavior: "smooth",
        block: el.getBoundingClientRect().height > window.innerHeight * 0.7 ? "start" : "center",
      });
      say(step, my);
    },
    [end, navigate, say],
  );
  const goRef = useRef(go);
  goRef.current = go;

  const start = useCallback(() => {
    unlockVoice();
    if (!user) return;
    setRunning(true);
    setPaused(false);
    setIndex(0);
    setPreparing(true);
    const my = ++run.current;
    void (async () => {
      try {
        sampleId.current ??= await ensureSampleCampaign(supabase, user.id);
        void queryClient.invalidateQueries();
      } catch (e) {
        console.error(e);
        toast.error("Could not prepare the sample campaign. The tour will continue without it.");
      }
      if (my !== run.current) return;
      setPreparing(false);
      void goRef.current(0);
    })();
  }, [queryClient, user]);

  // Start when asked from the landing page or the welcome card.
  useEffect(() => {
    if (pendingStart && user) {
      pendingStart = false;
      start();
    }
  }, [start, user]);

  // Keep the spotlight on the target as the page scrolls or resizes.
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const tick = () => {
      const el = target.current;
      setRect((prev) => {
        if (!el || !el.isConnected) return null;
        const r = el.getBoundingClientRect();
        return prev &&
          prev.top === r.top &&
          prev.left === r.left &&
          prev.width === r.width &&
          prev.height === r.height
          ? prev
          : r;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && end();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [end, running]);

  useEffect(() => () => stopVoice(), []);

  function togglePause() {
    if (paused) {
      unlockVoice();
      setPaused(false);
      state.current.paused = false;
      say(stepAt(index), run.current);
    } else {
      setPaused(true);
      state.current.paused = true;
      clearTimeout(advance.current);
      stopVoice();
      setTalking(false);
    }
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    state.current.muted = next;
    if (!next) unlockVoice();
    if (!paused) say(stepAt(index), run.current);
  }

  function playNow() {
    unlockVoice();
    setPaused(false);
    setMuted(false);
    state.current.paused = false;
    state.current.muted = false;
    say(stepAt(index), run.current);
  }

  const step = stepAt(index);
  const pad = 8;

  return (
    <TourContext.Provider value={{ start, running }}>
      {children}
      {running ? (
        <>
          {rect ? (
            <div
              aria-hidden="true"
              className="pointer-events-none fixed z-[60] rounded-xl ring-2 ring-primary transition-all duration-300"
              style={{
                top: rect.top - pad,
                left: rect.left - pad,
                width: rect.width + pad * 2,
                height: rect.height + pad * 2,
                boxShadow: "0 0 0 9999px rgba(5, 7, 12, 0.55)",
              }}
            />
          ) : null}
          <div
            role="dialog"
            aria-label="Guided tour"
            aria-live="polite"
            className="fixed inset-x-3 bottom-3 z-[61] rounded-2xl border border-border bg-background/95 p-4 shadow-2xl backdrop-blur md:inset-x-auto md:bottom-5 md:right-5 md:w-[420px]"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${talking ? "animate-pulse bg-primary" : "bg-muted-foreground/40"}`}
                aria-hidden="true"
              />
              <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                {preparing ? "Getting ready" : `Step ${index + 1} of ${TOUR_STEPS.length}`}
              </span>
              <button
                type="button"
                className="ml-auto min-h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={end}
              >
                End tour
              </button>
            </div>
            {preparing ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Preparing a sample campaign for you to explore…
              </p>
            ) : (
              <>
                <h2 className="mt-2 font-display text-lg font-semibold">{step.title}</h2>
                <p className="mt-1 max-h-[26vh] overflow-auto text-sm leading-relaxed text-muted-foreground">
                  {step.say}
                </p>
              </>
            )}
            {hint ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/50 bg-primary/10 p-3 text-sm">
                <span className="min-w-[180px] flex-1">
                  {hint === "unsupported"
                    ? "This browser can't play the voice guide. Read along here, or open the site in Chrome, Edge or Safari."
                    : hint === "blocked"
                      ? "Your browser blocked the sound. Press Play voice to hear the guide."
                      : "Can't hear the guide? Turn your volume up (on iPhone, switch off silent mode), then press Play voice."}
                </span>
                {hint !== "unsupported" ? (
                  <Button size="sm" onClick={playNow}>
                    ▶ Play voice
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => void go(index + 1)}>
                    Next
                  </Button>
                )}
              </div>
            ) : null}
            <div className="mt-3 h-1 rounded-full bg-secondary">
              <div
                className="h-1 rounded-full bg-primary transition-all"
                style={{ width: `${((index + 1) / TOUR_STEPS.length) * 100}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={preparing || index === 0}
                onClick={() => {
                  unlockVoice();
                  void go(index - 1);
                }}
              >
                Back
              </Button>
              <Button size="sm" variant="outline" disabled={preparing} onClick={togglePause}>
                {paused ? "Resume" : "Pause"}
              </Button>
              <Button size="sm" variant="outline" disabled={preparing} onClick={toggleMute}>
                {muted ? "Unmute" : "Mute"}
              </Button>
              <Button
                size="sm"
                className="ml-auto"
                disabled={preparing}
                onClick={() => {
                  unlockVoice();
                  void go(index + 1);
                }}
              >
                {index === TOUR_STEPS.length - 1 ? "Finish" : "Next"}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </TourContext.Provider>
  );
}

/** Shown on the dashboard until the user has taken or dismissed the tour. */
export function TourWelcome() {
  const { start, running } = useTour();
  const [hidden, setHidden] = useState(true);
  useEffect(() => setHidden(tourSeen()), []);
  if (hidden || running) return null;
  return (
    <div className="panel mb-6 flex flex-wrap items-center gap-4 border-primary/40 p-5">
      <div className="min-w-[220px] flex-1">
        <p className="font-display text-base font-semibold">New here? Take the guided tour</p>
        <p className="mt-1 text-sm text-muted-foreground">
          A voice guide shows you every screen, tab by tab, using a sample campaign. About 4
          minutes. Turn your sound on.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => (markSeen(), setHidden(true))}>
          Not now
        </Button>
        <Button className="shadow-signal" onClick={start}>
          ▶ Start the tour
        </Button>
      </div>
    </div>
  );
}
