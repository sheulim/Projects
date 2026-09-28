// A ready-made sample campaign, added to the user's own workspace for the guided tour.
// All names, figures and copy are fictional sample content.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { CHANNELS, isChannelId } from "@/lib/channel-specs";

export const SAMPLE_TITLE = "Festive sweets push — Kesar & Co. (sample)";

function day(offset: number): string {
  return new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
}

const CALENDAR: Array<[number, string, string, string, string, string]> = [
  // [day offset, title, description, type, channel, status]
  [
    0,
    "Teaser reel: the festive box is coming",
    "15-second reel of kesar being folded into kaju katli, ending on 'Coming this week'.",
    "social",
    "Instagram",
    "approved",
  ],
  [
    1,
    "Why we still make sweets by hand",
    "Founder story post on hand-made sweets and pure ghee, with a behind-the-scenes photo.",
    "content",
    "LinkedIn",
    "approved",
  ],
  [
    3,
    "Festive box launch",
    "Launch announcement with the box contents and order link.",
    "social",
    "Instagram",
    "in_review",
  ],
  [
    4,
    "Early-bird email to past customers",
    "Thank-you note and first access to the festive box.",
    "email",
    "Email",
    "in_review",
  ],
  [
    6,
    "Search ads go live",
    "Search campaign on 'diwali sweets delivery' and gifting terms in the city.",
    "ad",
    "Paid search",
    "draft",
  ],
  [
    8,
    "Corporate gifting guide",
    "Blog article: how to choose festive sweets for clients and teams.",
    "content",
    "Blog",
    "draft",
  ],
  [
    10,
    "Kitchen tour video",
    "3-minute YouTube tour of the kitchen and how each sweet is made.",
    "content",
    "YouTube",
    "draft",
  ],
  [
    13,
    "Customer unboxing reel",
    "Reel built from customer unboxing clips (with permission).",
    "social",
    "Instagram",
    "draft",
  ],
  [
    17,
    "Last order date reminder",
    "Email and story reminding customers of the last delivery date.",
    "email",
    "Email",
    "draft",
  ],
  [
    21,
    "Festive greetings",
    "Thank-you post and greetings from the whole team.",
    "social",
    "Instagram",
    "draft",
  ],
];

const IDEAS = [
  "A 'sweet for every relative' carousel: match each classic sweet to a family member's personality.",
  "Behind-the-counter series: one short reel a week showing a sweet being made from start to finish.",
  "Corporate gifting landing page with ready-made boxes for 10, 25 and 50 people.",
];

const SCRIPTS: Array<[string, string]> = [
  [
    "15-second teaser reel",
    "0–2s: Close-up of saffron strands dropping into warm milk. Text: 'Something golden is coming.'\n2–10s: Hands folding kaju katli, silver leaf pressed on. Voiceover: 'Made by hand, the way our grandmothers did.'\n10–15s: The closed festive box. Text: 'Kesar & Co. festive box — this week.'",
  ],
  [
    "Search ad",
    "Headline: Fresh Festive Sweets Delivered | Hand-made in Pure Ghee | Order Your Festive Box\nDescription: Order hand-made kaju katli, laddoos and barfi for the festival. Same-day city delivery.",
  ],
];

const BRIEF = `Big idea: "Made by hand, shared with love."
Tone: warm, proud of tradition, never pushy.
Look: deep saffron and cream, close-up food photography, natural light.
Must show: hands at work, the festive box, families sharing sweets.
Avoid: discount-led messages, stock photos, health claims.`;

const scene = (seconds: number, visual: string, on_screen_text: string, voiceover: string) => ({
  seconds,
  visual,
  on_screen_text,
  voiceover,
});

const CHANNEL_CONTENT: Array<[string, string, Record<string, unknown>]> = [
  [
    "instagram",
    "approved",
    {
      caption:
        "Some things are still best made by hand. ✨\nOur festive box is here: kaju katli, besan laddoo and kesar barfi, made fresh in pure ghee.\nOrder by the last delivery date to share it with the people you love.",
      hashtags: ["#FestiveSweets", "#HandMade", "#KesarAndCo", "#DiwaliGifts", "#IndianSweets"],
      reel_scenes: [
        scene(
          3,
          "Saffron strands falling into warm milk",
          "Something golden…",
          "Every festive box starts with a pinch of kesar.",
        ),
        scene(
          5,
          "Hands rolling besan laddoos",
          "Made by hand",
          "Rolled by hand, the way our grandmothers taught us.",
        ),
        scene(
          5,
          "Silver leaf pressed onto kaju katli",
          "Pure ghee. No shortcuts.",
          "Pure ghee, fresh every morning, no shortcuts.",
        ),
        scene(
          5,
          "The festive box opening on a family table",
          "The festive box is here",
          "Our festive box is here. Order yours today.",
        ),
      ],
      cta: "Order the festive box — link in bio",
      image_prompt:
        "Overhead photo of an open festive sweet box with kaju katli, besan laddoos and saffron barfi on a cream cloth, marigold petals, warm natural light",
    },
  ],
  [
    "linkedin",
    "draft",
    {
      post: "Why we still make every sweet by hand.\n\nWhen we started Kesar & Co., we were told machines would make us faster. They would. They would also make us like everyone else.\n\nSo every laddoo is still rolled by hand, in pure ghee, the same morning it ships.\n\nThis festive season, if you are choosing gifts for clients or your team, choose something made with care.\n\nOur corporate festive boxes are open for orders. Message us for team sizes of 10 or more.",
      carousel_slides: [
        { title: "Made by hand", body: "Every sweet is rolled and cut by hand, every morning." },
        { title: "Pure ghee only", body: "No blends and no shortcuts, whatever the season." },
        { title: "Gifting made simple", body: "Ready boxes for teams of 10, 25 and 50." },
      ],
      image_prompt:
        "Artisan sweet maker's hands shaping laddoos on a steel tray, soft window light, shallow depth of field",
    },
  ],
  [
    "google_ads",
    "draft",
    {
      headlines: [
        "Fresh Festive Sweets",
        "Hand-made in Pure Ghee",
        "Order Your Festive Box",
        "Same-Day City Delivery",
        "Corporate Gift Boxes",
      ],
      descriptions: [
        "Hand-made kaju katli, laddoos and barfi, made fresh every morning. Order today.",
        "Festive boxes for family and teams. Same-day delivery across the city.",
      ],
      keywords: [
        { keyword: "diwali sweets delivery", match: "phrase" },
        { keyword: "festive sweet box", match: "phrase" },
        { keyword: "corporate diwali gifts", match: "broad" },
        { keyword: "kaju katli online", match: "exact" },
      ],
      display_headline_short: "Hand-made Festive Sweets",
      display_headline_long:
        "Kesar & Co. festive boxes, hand-made in pure ghee and delivered fresh",
      image_prompt: "Festive sweet box with diyas and marigolds on a dark wooden table, warm glow",
    },
  ],
  [
    "youtube",
    "draft",
    {
      title: "How Our Festive Sweets Are Made by Hand | Kesar & Co.",
      description:
        "Step inside the Kesar & Co. kitchen before the festive rush and see how kaju katli, besan laddoo and kesar barfi are made by hand in pure ghee.\n\n00:00 Welcome\n00:30 The morning start\n01:30 Kaju katli\n02:15 Packing the festive box",
      tags: ["indian sweets", "how sweets are made", "kaju katli", "festive box", "diwali sweets"],
      chapters: [
        { time: "00:00", title: "Welcome" },
        { time: "00:30", title: "The morning start" },
        { time: "01:30", title: "Kaju katli" },
        { time: "02:15", title: "Packing the festive box" },
      ],
      scenes: [
        scene(
          30,
          "Kitchen at dawn, lights coming on",
          "The morning start",
          "Our day starts before sunrise, when the ghee is warmed and the first batch of besan is roasted.",
        ),
        scene(
          45,
          "Cashew paste being cooked and rolled",
          "Kaju katli",
          "Kaju katli is simple: cashews, sugar and patience. The secret is knowing exactly when to stop stirring.",
        ),
        scene(
          30,
          "Boxes being packed by hand",
          "Packing the festive box",
          "Every box is packed by hand, so it arrives looking the way a gift should.",
        ),
      ],
      shorts_script:
        "Ever wondered how kaju katli gets that perfect diamond shape? It's cut by hand, one sheet at a time. Here's how we do it every morning.",
      image_prompt:
        "Bold YouTube thumbnail: close-up of hands cutting kaju katli into diamonds, bright warm colours, uncluttered",
    },
  ],
  [
    "blog",
    "draft",
    {
      title: "How to Choose Festive Sweets for Clients and Teams",
      meta_description:
        "A simple guide to choosing festive sweet boxes for clients and teams: what to pick, how much to order and when to book.",
      slug: "festive-sweets-corporate-gifting-guide",
      body_markdown:
        "## Start with your list\nCount clients and team members separately. Clients usually get a larger box; teams a shared one.\n\n## Pick sweets that travel well\nKaju katli and barfi hold their shape; soft sweets are best delivered the same day.\n\n## Book early\nFestive weeks fill up fast. Place large orders at least ten days ahead.",
      image_prompt:
        "Stack of elegant festive sweet boxes with ribbons on an office desk, soft daylight",
    },
  ],
  [
    "email",
    "draft",
    {
      subject_a: "Your festive box is ready, a week early",
      subject_b: "First access for our regulars 🪔",
      preview_text: "Hand-made kaju katli, laddoos and barfi, before the festive rush.",
      body_markdown:
        "Dear friend,\n\nThank you for choosing Kesar & Co. over the years. As one of our regulars, you get first access to this year's festive box.\n\nInside: kaju katli, besan laddoo and kesar barfi, made by hand in pure ghee the morning they ship.\n\nOrder this week to be sure of your delivery date.\n\nWarm wishes,\nThe Kesar & Co. family",
      cta_label: "Order the festive box",
    },
  ],
];

type Db = SupabaseClient<Database>;

/** Returns the id of the user's sample campaign, creating it the first time. */
export async function ensureSampleCampaign(db: Db, userId: string): Promise<string> {
  const { data: existing } = await db
    .from("campaigns")
    .select("id")
    .eq("user_id", userId)
    .eq("title", SAMPLE_TITLE)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: campaign, error } = await db
    .from("campaigns")
    .insert({
      title: SAMPLE_TITLE,
      business_brief:
        "Kesar & Co. is a family sweet shop selling hand-made Indian sweets in pure ghee. This season we launch a festive box and corporate gift boxes, with same-day city delivery.",
      target_audience:
        "Families and working professionals in the city, 25–50, who buy sweets to share and gift during festivals; HR and admin teams buying corporate gifts.",
      campaign_goal:
        "Sell festive boxes online and win corporate gifting orders before the festival.",
      channels: ["Instagram", "LinkedIn", "Email", "Paid search", "YouTube", "Blog"],
      start_date: day(0),
      end_date: day(24),
      status: "planned",
      budget: 150000,
      expected_revenue: 600000,
      actual_cost: 42000,
    })
    .select("id")
    .single();
  if (error || !campaign) throw error ?? new Error("Could not create the sample campaign.");
  const id = campaign.id;

  await db.from("calendar_items").insert(
    CALENDAR.map(([offset, title, description, item_type, channel, status], position) => ({
      campaign_id: id,
      user_id: userId,
      item_date: day(offset),
      title,
      description,
      item_type,
      channel,
      status,
      position,
    })),
  );

  await db.from("generated_assets").insert(
    [
      ...IDEAS.map((content, i) => ({
        asset_type: "idea",
        title: `Content idea ${i + 1}`,
        content,
      })),
      ...SCRIPTS.map(([title, content]) => ({ asset_type: "script", title, content })),
      { asset_type: "creative_brief", title: "Creative brief", content: BRIEF },
    ].map((a) => ({ ...a, campaign_id: id, user_id: userId, status: "draft" })),
  );

  await db.from("channel_assets").insert(
    CHANNEL_CONTENT.map(([channel, status, content]) => ({
      campaign_id: id,
      user_id: userId,
      channel,
      status,
      title: `${isChannelId(channel) ? CHANNELS[channel].label : channel} content`,
      content: content as Json,
    })),
  );

  return id;
}
