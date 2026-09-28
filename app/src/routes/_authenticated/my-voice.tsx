import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { startJob } from "@/lib/jobs/client";
import { toMonoWav } from "@/lib/audio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/my-voice")({
  head: () => ({
    meta: [
      { title: "My voice — CampaignForge" },
      {
        name: "description",
        content: "Clone your own voice once and use it for every voiceover and video.",
      },
    ],
  }),
  component: MyVoicePage,
});

const BUCKET = "campaign-media";
const MIN_SECONDS = 10;
const MAX_SECONDS = 180;

const READING = `Hello, and thank you for being here. I want to share something that has guided my own life for many years.
Every one of us carries patterns: in the numbers that mark our days, in the stars we were born under, and in the choices we make each morning.
When we pay attention to these patterns, we begin to see why some doors open easily and others stay closed.
Today, I will walk you through one simple idea you can use this week. Take a slow breath, keep a pen nearby, and let's begin.`;

function MyVoicePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const profile = useQuery({
    queryKey: ["voice_profile"],
    queryFn: async () => {
      const { data, error } = await supabase.from("voice_profiles").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: (q) => (q.state.data?.status === "cloning" ? 3000 : false),
  });
  const p = profile.data;

  const testUrl = useQuery({
    queryKey: ["signed", p?.test_audio_path],
    enabled: !!p?.test_audio_path,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(p!.test_audio_path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });

  // Tell the user when cloning finishes.
  const lastStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    const s = p?.status;
    if (lastStatus.current === "cloning" && s === "ready")
      toast.success("Your voice is ready. Listen to the test below.");
    if (lastStatus.current === "cloning" && s === "error")
      toast.error(p?.error ?? "Voice cloning failed.");
    lastStatus.current = s;
  }, [p?.status, p?.error]);

  // Recording
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [sample, setSample] = useState<Blob | null>(null);
  const [sampleUrl, setSampleUrl] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  function pickSample(b: Blob | null) {
    if (sampleUrl) URL.revokeObjectURL(sampleUrl);
    setSample(b);
    setSampleUrl(b ? URL.createObjectURL(b) : null);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const r = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        pickSample(new Blob(chunks, { type: r.mimeType || "audio/webm" }));
      };
      recorder.current = r;
      r.start();
      setRecording(true);
      setElapsed(0);
      const started = Date.now();
      timer.current = setInterval(() => {
        const s = Math.floor((Date.now() - started) / 1000);
        setElapsed(s);
        if (s >= MAX_SECONDS) stopRecording();
      }, 250);
    } catch {
      toast.error("Microphone access was blocked. Allow the microphone, or upload a recording.");
    }
  }

  function stopRecording() {
    clearInterval(timer.current);
    recorder.current?.stop();
    recorder.current = null;
    setRecording(false);
  }

  useEffect(() => () => clearInterval(timer.current), []);

  const [title, setTitle] = useState("My voice");
  const [consent, setConsent] = useState(false);

  const clone = useMutation({
    mutationFn: async () => {
      if (!user || !sample) throw new Error("Record or upload your voice first.");
      if (!consent) throw new Error("Tick the consent box first.");
      const { wav, seconds } = await toMonoWav(sample).catch(() => {
        throw new Error("This file could not be read. Try an MP3, WAV or M4A recording.");
      });
      if (seconds < MIN_SECONDS)
        throw new Error(`The recording is too short. Record at least ${MIN_SECONDS} seconds.`);
      if (seconds > MAX_SECONDS + 5)
        throw new Error("The recording is too long. Use 30 to 90 seconds of clear speech.");
      const path = `${user.id}/voice/sample-${Date.now()}.wav`;
      const up = await supabase.storage
        .from(BUCKET)
        .upload(path, wav, { contentType: "audio/wav", upsert: true });
      if (up.error) throw up.error;
      const { error } = await supabase.from("voice_profiles").upsert(
        {
          user_id: user.id,
          title: title.trim() || "My voice",
          sample_path: path,
          consent_at: new Date().toISOString(),
          status: "cloning",
          error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
      try {
        await startJob({ job: "clone" });
      } catch (e) {
        await supabase.from("voice_profiles").update({ status: "none" }).eq("user_id", user.id);
        throw e;
      }
    },
    onSuccess: () => {
      toast.message("Creating your voice. This usually takes under a minute.");
      pickSample(null);
      void queryClient.invalidateQueries({ queryKey: ["voice_profile"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not start."),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from("voice_profiles")
        .update({ status: "none", model_id: null, test_audio_path: null, error: null })
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Your cloned voice is switched off. Voiceovers use the standard AI voice.");
      void queryClient.invalidateQueries({ queryKey: ["voice_profile"] });
    },
  });

  const ready = p?.status === "ready";
  const cloning = p?.status === "cloning" || clone.isPending;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <p className="eyebrow">Voice cloning</p>
      <h1 className="mt-2 text-3xl font-semibold">My voice</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Record yourself once. Every voiceover and video you make in CampaignForge, including{" "}
        <Link to="/daily-video" className="text-primary underline">
          daily videos
        </Link>
        , will then speak in your voice.
      </p>

      <section className="panel mt-8 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Status</h2>
          <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {ready
              ? "Ready"
              : cloning
                ? "Creating your voice…"
                : p?.status === "error"
                  ? "Failed"
                  : "Not set up"}
          </span>
        </div>
        {ready ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Your cloned voice <strong className="text-foreground">{p?.title}</strong> is on. Here
              is a test line in your voice:
            </p>
            {testUrl.data ? <audio controls src={testUrl.data} className="w-full" /> : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => remove.mutate()}>
                Switch off my cloned voice
              </Button>
              <span className="self-center text-xs text-muted-foreground">
                Not happy with it? Record a new sample below to replace it.
              </span>
            </div>
          </div>
        ) : p?.status === "error" ? (
          <p className="mt-3 text-sm text-destructive">{p.error}</p>
        ) : cloning ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Your recording is being turned into a voice. You can leave this page; it keeps going.
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Until you set this up, voiceovers use a standard AI voice.
          </p>
        )}
      </section>

      <section className="panel mt-6 space-y-5 p-6">
        <div>
          <h2 className="font-display text-lg font-semibold">
            {ready ? "Replace your voice" : "Create your voice"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Best results: a quiet room, phone or laptop 20 cm from your mouth, your natural speaking
            pace, 30 to 90 seconds. Read the passage below or speak freely.
          </p>
        </div>

        <blockquote className="rounded-lg border border-border bg-background p-4 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
          {READING}
        </blockquote>

        <div className="flex flex-wrap items-center gap-3">
          {recording ? (
            <Button variant="destructive" onClick={stopRecording}>
              ■ Stop recording ({elapsed}s)
            </Button>
          ) : (
            <Button onClick={startRecording} disabled={cloning}>
              ● Record my voice
            </Button>
          )}
          <span className="text-xs text-muted-foreground">or</span>
          <label className="cursor-pointer text-sm text-primary underline">
            upload a recording
            <input
              type="file"
              accept="audio/*"
              className="sr-only"
              onChange={(e) => pickSample(e.target.files?.[0] ?? null)}
            />
          </label>
          {recording && elapsed < 30 ? (
            <span className="text-xs text-muted-foreground">Keep going: at least 30 seconds</span>
          ) : null}
        </div>

        {sampleUrl ? (
          <div className="space-y-2">
            <p className="text-sm">Listen back before you continue:</p>
            <audio controls src={sampleUrl} className="w-full" />
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="voice-title">Name for this voice</Label>
          <Input id="voice-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            This is <strong>my own voice</strong>, and I agree to CampaignForge creating an AI copy
            of it with Fish Audio, for use in my own content. I will not upload anyone else's voice.
          </span>
        </label>

        <Button
          className="shadow-signal"
          disabled={!sample || !consent || cloning || recording}
          onClick={() => clone.mutate()}
        >
          {cloning ? "Creating your voice…" : "Create my voice"}
        </Button>
      </section>
    </main>
  );
}
