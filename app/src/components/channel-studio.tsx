import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  CHANNELS,
  CHANNEL_IDS,
  isChannelId,
  matchChannel,
  videoScenes,
  type ChannelId,
} from "@/lib/channel-specs";
import { startJob } from "@/lib/jobs/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];
type Asset = Database["public"]["Tables"]["channel_assets"]["Row"];
type Media = { image?: string; voice?: string };
type Content = Record<string, unknown> & { _media?: Media; _error?: string };

const BUCKET = "campaign-media";

function isBusy(a: Asset) {
  const media = (a.content as Content)?._media ?? {};
  return a.status === "generating" || Object.values(media).includes("generating");
}

export function ChannelStudio({ campaign, canEdit }: { campaign: Campaign; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const suggested = useMemo(() => {
    const ids = (campaign.channels ?? []).map(matchChannel).filter((x): x is ChannelId => !!x);
    return ids.length
      ? Array.from(new Set(ids))
      : (["instagram", "linkedin", "email"] as ChannelId[]);
  }, [campaign.channels]);
  const [picked, setPicked] = useState<ChannelId[]>(suggested);

  const assets = useQuery({
    queryKey: ["channel_assets", campaign.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channel_assets")
        .select("*")
        .eq("campaign_id", campaign.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: (q) => ((q.state.data ?? []).some(isBusy) ? 3000 : false),
  });

  // Latest version per channel, in the order of the channel list.
  const latest = useMemo(() => {
    const map = new Map<ChannelId, Asset>();
    for (const a of assets.data ?? [])
      if (isChannelId(a.channel) && !map.has(a.channel)) map.set(a.channel, a);
    return CHANNEL_IDS.filter((id) => map.has(id)).map((id) => map.get(id)!);
  }, [assets.data]);

  const generate = useMutation({
    mutationFn: async (channels: ChannelId[]) => {
      for (const channel of channels) {
        const { data, error } = await supabase
          .from("channel_assets")
          .insert({
            campaign_id: campaign.id,
            channel,
            status: "generating",
            title: `${CHANNELS[channel].label} content`,
          })
          .select("id")
          .single();
        if (error) throw error;
        await startJob({ job: "channel", assetId: data.id });
      }
    },
    onSuccess: (_d, channels) => {
      toast.message(
        `Writing ${channels.length} channel${channels.length > 1 ? "s" : ""}. Results appear here as they finish.`,
      );
      queryClient.invalidateQueries({ queryKey: ["channel_assets", campaign.id] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Could not start generation.");
      queryClient.invalidateQueries({ queryKey: ["channel_assets", campaign.id] });
    },
  });

  const toggle = (id: ChannelId) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="space-y-6">
      <div className="panel p-5">
        <p className="eyebrow">Channel Studio</p>
        <h2 className="mt-2 font-display text-xl font-semibold">
          Ready-to-post content for every channel
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each channel gets its own content in its own format, written from this campaign's brief
          and your Company DNA. Then create images, voiceovers and videos where the channel needs
          them.
        </p>
        {canEdit ? (
          <>
            <div
              className="mt-4 flex flex-wrap gap-2"
              role="group"
              aria-label="Channels to generate"
            >
              {CHANNEL_IDS.map((id) => {
                const on = picked.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(id)}
                    className={`min-h-10 rounded-full border px-4 text-sm transition-colors ${
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-secondary"
                    }`}
                  >
                    {CHANNELS[id].label}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                disabled={!picked.length || generate.isPending}
                onClick={() => generate.mutate(picked)}
              >
                {generate.isPending
                  ? "Starting…"
                  : `Generate ${picked.length} channel${picked.length === 1 ? "" : "s"}`}
              </Button>
              <span className="text-xs text-muted-foreground">
                Each channel takes up to a minute. Regenerating keeps earlier versions.
              </span>
            </div>
          </>
        ) : null}
      </div>

      {assets.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : latest.length === 0 ? (
        <div className="panel p-8 text-center text-sm text-muted-foreground">
          No channel content yet{canEdit ? ". Pick channels above and generate." : "."}
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {latest.map((a) => (
            <ChannelCard
              key={a.id}
              asset={a}
              canEdit={canEdit}
              onRegenerate={() => generate.mutate([a.channel as ChannelId])}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  return (
    <button
      type="button"
      className="min-h-8 rounded-md border border-border px-2.5 text-xs text-muted-foreground hover:text-foreground"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast.success("Copied.");
        } catch {
          toast.error("Copy failed. Select the text and copy it manually.");
        }
      }}
    >
      {label}
    </button>
  );
}

function Limit({ text, max }: { text: string; max: number }) {
  const over = text.length > max;
  return (
    <span
      className={`font-mono text-[11px] ${over ? "text-destructive" : "text-muted-foreground"}`}
    >
      {text.length}/{max}
    </span>
  );
}

function Block({
  title,
  text,
  max,
  children,
}: {
  title: string;
  text?: string;
  max?: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        <span className="flex items-center gap-2">
          {text !== undefined && max ? <Limit text={text} max={max} /> : null}
          {text ? <CopyButton text={text} /> : null}
        </span>
      </div>
      {text !== undefined ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
      ) : null}
      {children}
    </div>
  );
}

function List({ title, items, max }: { title: string; items: string[]; max?: number }) {
  return (
    <Block title={title}>
      <div className="flex justify-end">
        <CopyButton text={items.join("\n")} label="Copy all" />
      </div>
      <ol className="space-y-1.5 text-sm">
        {items.map((t, i) => (
          <li
            key={i}
            className="flex items-start justify-between gap-3 rounded-md bg-secondary/40 px-2.5 py-1.5"
          >
            <span className="whitespace-pre-wrap">{t}</span>
            {max ? <Limit text={t} max={max} /> : null}
          </li>
        ))}
      </ol>
    </Block>
  );
}

type Scene = { seconds: number; visual: string; on_screen_text: string; voiceover: string };

function Scenes({ scenes }: { scenes: Scene[] }) {
  return (
    <Block title={`Video script · ${scenes.length} scenes`}>
      <div className="flex justify-end">
        <CopyButton
          text={scenes
            .map(
              (s, i) =>
                `Scene ${i + 1} (${s.seconds}s)\nVisual: ${s.visual}\nOn screen: ${s.on_screen_text}\nVoiceover: ${s.voiceover}`,
            )
            .join("\n\n")}
          label="Copy script"
        />
      </div>
      <ol className="space-y-2 text-sm">
        {scenes.map((s, i) => (
          <li key={i} className="rounded-md bg-secondary/40 p-2.5">
            <p className="font-mono text-[11px] text-muted-foreground">
              Scene {i + 1} · {s.seconds}s
            </p>
            <p className="mt-1">
              <span className="text-muted-foreground">Visual:</span> {s.visual}
            </p>
            <p>
              <span className="text-muted-foreground">On screen:</span> {s.on_screen_text}
            </p>
            <p>
              <span className="text-muted-foreground">Voiceover:</span> {s.voiceover}
            </p>
          </li>
        ))}
      </ol>
    </Block>
  );
}

function ChannelContent({ channel, c }: { channel: ChannelId; c: Content }) {
  const s = (k: string) => String(c[k] ?? "");
  const arr = (k: string) => ((c[k] as string[] | undefined) ?? []).map(String);
  switch (channel) {
    case "instagram":
    case "tiktok":
      return (
        <>
          <Block title="Caption" text={s("caption")} max={channel === "tiktok" ? 150 : 2200} />
          <Block
            title="Hashtags"
            text={arr("hashtags")
              .map((h) => (h.startsWith("#") ? h : `#${h}`))
              .join(" ")}
          />
          <Scenes scenes={(c["reel_scenes"] as Scene[]) ?? []} />
          <Block title="Call to action" text={s("cta")} />
        </>
      );
    case "facebook":
      return (
        <>
          <Block title="Post" text={s("post")} />
          <Block title="Link headline" text={s("link_headline")} max={40} />
        </>
      );
    case "linkedin":
      return (
        <>
          <Block title="Post" text={s("post")} max={3000} />
          <List
            title="Document carousel"
            items={((c["carousel_slides"] as Array<{ title: string; body: string }>) ?? []).map(
              (x, i) => `${i + 1}. ${x.title}\n${x.body}`,
            )}
          />
        </>
      );
    case "x":
      return (
        <>
          <List title="Posts" items={arr("posts")} max={280} />
          <List title="Thread" items={arr("thread")} max={280} />
        </>
      );
    case "youtube":
      return (
        <>
          <Block title="Title" text={s("title")} max={70} />
          <Block title="Description" text={s("description")} max={5000} />
          <Block title="Tags" text={arr("tags").join(", ")} />
          <List
            title="Chapters"
            items={((c["chapters"] as Array<{ time: string; title: string }>) ?? []).map(
              (x) => `${x.time} ${x.title}`,
            )}
          />
          <Scenes scenes={(c["scenes"] as Scene[]) ?? []} />
          <Block title="Shorts script" text={s("shorts_script")} />
        </>
      );
    case "google_ads":
      return (
        <>
          <List title="Headlines" items={arr("headlines")} max={30} />
          <List title="Descriptions" items={arr("descriptions")} max={90} />
          <List
            title="Keywords"
            items={((c["keywords"] as Array<{ keyword: string; match: string }>) ?? []).map((k) =>
              k.match === "exact"
                ? `[${k.keyword}]`
                : k.match === "phrase"
                  ? `"${k.keyword}"`
                  : k.keyword,
            )}
          />
          <Block title="Display headline (short)" text={s("display_headline_short")} max={30} />
          <Block title="Display headline (long)" text={s("display_headline_long")} max={90} />
        </>
      );
    case "blog":
      return (
        <>
          <Block title="SEO title" text={s("title")} max={60} />
          <Block title="Meta description" text={s("meta_description")} max={160} />
          <Block title="URL slug" text={s("slug")} />
          <Block title="Article (Markdown)" text={s("body_markdown")} />
        </>
      );
    case "email":
      return (
        <>
          <Block title="Subject A" text={s("subject_a")} max={60} />
          <Block title="Subject B" text={s("subject_b")} max={60} />
          <Block title="Preview text" text={s("preview_text")} max={90} />
          <Block title="Email body" text={s("body_markdown")} />
          <Block title="Button label" text={s("cta_label")} />
        </>
      );
    case "whatsapp":
      return <Block title="Message" text={s("message")} max={700} />;
  }
}

function useSignedUrl(path: string | null) {
  return useQuery({
    queryKey: ["signed", path],
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

function ChannelCard({
  asset,
  canEdit,
  onRegenerate,
}: {
  asset: Asset;
  canEdit: boolean;
  onRegenerate: () => void;
}) {
  const queryClient = useQueryClient();
  const channel = asset.channel as ChannelId;
  const spec = CHANNELS[channel];
  const c = useMemo(() => (asset.content ?? {}) as Content, [asset.content]);
  const media = c._media ?? {};
  const image = useSignedUrl(asset.image_path);
  const audio = useSignedUrl(asset.audio_path);

  const startMedia = useMutation({
    mutationFn: async (kind: "image" | "voice") => {
      await supabase
        .from("channel_assets")
        .update({ content: { ...c, _media: { ...media, [kind]: "generating" } } })
        .eq("id", asset.id);
      await startJob({ job: kind, assetId: asset.id });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["channel_assets", asset.campaign_id] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not start."),
  });

  const approve = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("channel_assets").update({ status }).eq("id", asset.id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["channel_assets", asset.campaign_id] }),
  });

  const allText = useMemo(() => {
    const { _media, _error, ...rest } = c;
    return JSON.stringify(rest, null, 2);
  }, [c]);

  return (
    <article data-tour="channel-card" className="panel flex flex-col gap-4 p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-semibold">{spec.label}</h3>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              asset.status === "approved"
                ? "default"
                : asset.status === "error"
                  ? "destructive"
                  : "outline"
            }
          >
            {asset.status === "generating" ? "Writing…" : asset.status}
          </Badge>
          <span className="font-mono text-[11px] text-muted-foreground">
            {new Date(asset.created_at).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        </div>
      </header>

      {asset.status === "generating" ? (
        <p className="text-sm text-muted-foreground">
          Writing {spec.label} content… this usually takes under a minute.
        </p>
      ) : asset.status === "error" ? (
        <div className="space-y-3">
          <p className="text-sm text-destructive">{c._error ?? "Generation failed."}</p>
          {canEdit ? (
            <Button size="sm" onClick={onRegenerate}>
              Try again
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="space-y-4">
            <ChannelContent channel={channel} c={c} />
          </div>

          {spec.media.length ? (
            <section className="space-y-3 border-t border-border pt-4">
              <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                Media
              </p>
              {spec.media.includes("image" as never) ? (
                <div className="space-y-2">
                  <Block title="Image prompt" text={String(c["image_prompt"] ?? "")} />
                  {image.data ? (
                    <div className="space-y-2">
                      <img
                        src={image.data}
                        alt={`${spec.label} visual`}
                        className="max-h-80 w-full rounded-lg object-contain"
                      />
                      <a href={image.data} download className="text-xs text-primary underline">
                        Download image
                      </a>
                    </div>
                  ) : null}
                  {canEdit ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={media.image === "generating" || startMedia.isPending}
                      onClick={() => startMedia.mutate("image")}
                    >
                      {media.image === "generating"
                        ? "Creating image…"
                        : asset.image_path
                          ? "Recreate image"
                          : "Create image"}
                    </Button>
                  ) : null}
                  {media.image === "error" ? (
                    <p className="text-xs text-destructive">
                      Image failed. Check the OpenAI key and try again.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {spec.media.includes("voice" as never) ? (
                <div className="space-y-2">
                  {audio.data ? (
                    <div className="space-y-1">
                      <audio controls src={audio.data} className="w-full" />
                      <a href={audio.data} download className="text-xs text-primary underline">
                        Download voiceover (MP3)
                      </a>
                    </div>
                  ) : null}
                  {canEdit ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={media.voice === "generating" || startMedia.isPending}
                      onClick={() => startMedia.mutate("voice")}
                    >
                      {media.voice === "generating"
                        ? "Recording voiceover…"
                        : asset.audio_path
                          ? "Re-record voiceover"
                          : "Create voiceover"}
                    </Button>
                  ) : null}
                  {media.voice === "error" ? (
                    <p className="text-xs text-destructive">
                      Voiceover failed. Check the OpenAI key and try again.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {spec.media.includes("video" as never) ? (
                image.data && audio.data ? (
                  <VideoMaker
                    imageUrl={image.data}
                    audioUrl={audio.data}
                    scenes={videoScenes(channel, c)}
                    vertical={channel !== "youtube"}
                    name={`${spec.label.toLowerCase()}-video`}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Create the image and the voiceover to build the video.
                  </p>
                )
              ) : null}
            </section>
          ) : null}

          <footer className="flex flex-wrap gap-2 border-t border-border pt-4">
            <CopyButton text={allText} label="Copy everything (JSON)" />
            {canEdit ? (
              <>
                <Button size="sm" variant="outline" onClick={onRegenerate}>
                  Regenerate
                </Button>
                {asset.status === "approved" ? (
                  <Button size="sm" variant="ghost" onClick={() => approve.mutate("draft")}>
                    Move back to draft
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => approve.mutate("approved")}>
                    Approve
                  </Button>
                )}
              </>
            ) : null}
          </footer>
        </>
      )}
    </article>
  );
}

/** Builds a video in the browser: the generated image with a slow zoom, scene captions and the voiceover. */
function VideoMaker({
  imageUrl,
  audioUrl,
  scenes,
  vertical,
  name,
}: {
  imageUrl: string;
  audioUrl: string;
  scenes: Scene[];
  vertical: boolean;
  name: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"idle" | "recording" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [video, setVideo] = useState<{ url: string; ext: string } | null>(null);
  const W = vertical ? 1080 : 1920;
  const H = vertical ? 1920 : 1080;

  async function build() {
    const canvas = canvasRef.current;
    if (!canvas || typeof MediaRecorder === "undefined") {
      setState("error");
      return;
    }
    setState("recording");
    setProgress(0);
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageUrl;
      await img.decode();

      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.src = audioUrl;
      await new Promise<void>((res, rej) => {
        audio.onloadedmetadata = () => res();
        audio.onerror = () => rej(new Error("audio"));
      });
      const duration = audio.duration || 20;

      const ctx = canvas.getContext("2d")!;
      const actx = new AudioContext();
      const source = actx.createMediaElementSource(audio);
      const dest = actx.createMediaStreamDestination();
      source.connect(dest);
      const stream = new MediaStream([
        ...canvas.captureStream(30).getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);
      const mime = [
        "video/mp4;codecs=avc1,mp4a.40.2",
        "video/mp4",
        "video/webm;codecs=vp9,opus",
        "video/webm",
      ].find((m) => MediaRecorder.isTypeSupported(m))!;
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

      // Scene timings scaled to the actual voiceover length.
      const total = scenes.reduce((n, s) => n + (s.seconds || 1), 0) || 1;
      let t = 0;
      const marks = scenes.map((s) => {
        const start = (t / total) * duration;
        t += s.seconds || 1;
        return { start, end: (t / total) * duration, text: s.on_screen_text };
      });

      const draw = () => {
        const now = audio.currentTime;
        const k = 1 + 0.08 * (now / duration);
        const scale = Math.max(W / img.width, H / img.height) * k;
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
        const cap = marks.find((m) => now >= m.start && now < m.end)?.text ?? "";
        if (cap) {
          const fs = vertical ? 64 : 56;
          ctx.font = `700 ${fs}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          const words = cap.split(" ");
          const lines: string[] = [];
          let line = "";
          for (const word of words) {
            const test = line ? `${line} ${word}` : word;
            if (ctx.measureText(test).width > W * 0.84 && line) {
              lines.push(line);
              line = word;
            } else line = test;
          }
          if (line) lines.push(line);
          const y0 = H * (vertical ? 0.74 : 0.8);
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          ctx.fillRect(W * 0.05, y0 - fs * 1.2, W * 0.9, lines.length * fs * 1.25 + fs * 0.6);
          ctx.fillStyle = "#fff";
          lines.forEach((l, i) => ctx.fillText(l, W / 2, y0 + i * fs * 1.25));
        }
        setProgress(Math.min(100, Math.round((now / duration) * 100)));
        if (!audio.ended) requestAnimationFrame(draw);
      };

      recorder.start(250);
      await audio.play();
      draw();
      await new Promise<void>((res) => (audio.onended = () => res()));
      recorder.stop();
      await new Promise<void>((res) => (recorder.onstop = () => res()));
      await actx.close();
      const blob = new Blob(chunks, { type: mime.split(";")[0] ?? "video/webm" });
      setVideo({ url: URL.createObjectURL(blob), ext: mime.includes("mp4") ? "mp4" : "webm" });
      setState("done");
    } catch (e) {
      console.error(e);
      setState("error");
    }
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className={state === "recording" ? "w-full max-w-xs rounded-lg" : "hidden"}
      />
      {state === "recording" ? (
        <p className="text-xs text-muted-foreground">
          Building the video in real time… {progress}%
        </p>
      ) : null}
      {video ? (
        <div className="space-y-1">
          <video src={video.url} controls className="max-h-96 w-full rounded-lg" />
          <a
            href={video.url}
            download={`${name}.${video.ext}`}
            className="text-xs text-primary underline"
          >
            Download video ({video.ext.toUpperCase()})
          </a>
          {video.ext === "webm" ? (
            <p className="text-xs text-muted-foreground">
              This browser saves WebM. Some platforms need MP4; use Chrome or Edge for MP4, or
              convert before uploading.
            </p>
          ) : null}
        </div>
      ) : null}
      {state === "error" ? (
        <p className="text-xs text-destructive">
          This browser could not build the video. Try Chrome or Edge on a computer.
        </p>
      ) : null}
      <Button size="sm" variant="outline" disabled={state === "recording"} onClick={build}>
        {state === "done" ? "Rebuild video" : state === "recording" ? "Building…" : "Build video"}
      </Button>
    </div>
  );
}
