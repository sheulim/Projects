// The guided tour's script. Shared by the tour overlay (browser) and the tour-voice Netlify
// function, which only voices lines listed here. Keep free of "@/..." imports.

export type TourTarget = {
  /** CSS selector, tried first. */
  sel?: string;
  /** Otherwise: the shortest element whose text starts with this. */
  text?: string;
  /** Climb to this ancestor of the text match, e.g. "section". */
  up?: string;
};

export type TourStep = {
  id: string;
  title: string;
  say: string;
  /** Page to show. "sample" means the sample campaign. */
  page: "/dashboard" | "/company-dna" | "/campaigns" | "sample" | "/approvals" | "/team";
  /** Campaign tab to open, on the sample campaign page. */
  tab?: "calendar" | "studio" | "ideas" | "scripts" | "brief" | "strategy" | "review";
  /** Open the new-campaign form first. */
  openBrief?: boolean;
  target?: TourTarget;
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome",
    page: "/dashboard",
    target: { text: "Campaign dashboard", up: "div" },
    say: "Welcome to CampaignForge. I will walk you through the whole website using a sample campaign for a sweet shop called Kesar and Company, planning its festive season push. You can pause, go back or mute me at any time.",
  },
  {
    id: "tiles",
    title: "Your dashboard",
    page: "/dashboard",
    target: { sel: "[data-tour='tiles']" },
    say: "This is your dashboard, the first screen you see after you log in. These tiles show how many campaigns you have, your total budget, how much is spent, the revenue you expect, and how many posts are waiting for review.",
  },
  {
    id: "campaign-table",
    title: "All your campaigns",
    page: "/dashboard",
    target: { sel: "[data-tour='campaign-table']" },
    say: "Every campaign appears in this table, with its status, its dates, how many posts are approved and how much of the budget is used. Click a campaign's name to open it.",
  },
  {
    id: "checklist",
    title: "Where to start",
    page: "/dashboard",
    target: { text: "Setup checklist", up: ".panel" },
    say: "New here? The setup checklist tells you what to do first. Work through it from top to bottom.",
  },
  {
    id: "moments",
    title: "Festivals and key dates",
    page: "/dashboard",
    target: { text: "Upcoming moments", up: ".panel" },
    say: "Upcoming moments lists festivals and important dates, so you can plan your posts well before each one.",
  },
  {
    id: "menu",
    title: "The menu",
    page: "/dashboard",
    target: { sel: "[data-sidebar='sidebar']" },
    say: "The menu on the left takes you to every part of the site. On a phone, open it with the menu button at the top left.",
  },
  {
    id: "dna",
    title: "Step 1: Company DNA",
    page: "/company-dna",
    target: { sel: "form" },
    say: "Your first step is Company DNA. Describe your brand once: how you sound, words to use, words to avoid, and the facts the AI is allowed to state. Every plan and every post will follow these rules. Press Save when you are done.",
  },
  {
    id: "campaigns",
    title: "Step 2: Start a campaign",
    page: "/campaigns",
    target: { text: "Your campaigns", up: "div" },
    say: "Campaigns lists everything you have planned. To start a new campaign, press New campaign.",
  },
  {
    id: "brief",
    title: "Write a short brief",
    page: "/campaigns",
    openBrief: true,
    target: { sel: "[data-tour='brief-form']" },
    say: "Then fill in a short brief: a title, what you sell and your offer, who you want to reach, and your goal. Pick your dates and your channels, such as Instagram, LinkedIn, email or YouTube, and press Save. For now, let's open the sample campaign that is already filled in.",
  },
  {
    id: "sample",
    title: "Step 3: Generate the plan",
    page: "sample",
    target: { sel: "[data-tour='campaign-head']" },
    say: "This is the sample campaign. When you press Generate plan, the AI writes a complete, dated plan for the whole campaign in about a minute.",
  },
  {
    id: "budget",
    title: "Budget and return",
    page: "sample",
    target: { text: "Budget and expected return", up: ".panel" },
    say: "Here you set the budget and the revenue you expect, record what you have spent, and export the calendar to a spreadsheet.",
  },
  {
    id: "calendar",
    title: "Calendar",
    page: "sample",
    tab: "calendar",
    target: { sel: "[data-tour='tabs'] [role='tablist']" },
    say: "The plan is organised in tabs. The Calendar tab lists every post, day by day and channel by channel. You can edit any post and send it for review.",
  },
  {
    id: "studio",
    title: "Step 4: Channel Studio",
    page: "sample",
    tab: "studio",
    target: { sel: "[data-tour='tabs'] [role='tablist']" },
    say: "Channel Studio is where the ready-to-post content is made. Choose your channels and press Generate. Instagram gets a reel script and caption, LinkedIn a professional post, Google Ads its headlines, YouTube a full video script, and you also get blogs and emails.",
  },
  {
    id: "studio-card",
    title: "Images, voice and video",
    page: "sample",
    tab: "studio",
    target: { sel: "[data-tour='channel-card']" },
    say: "Each channel has its own card, with copy buttons for every piece of text. For visual channels you can also create an image, an AI voiceover and a simple video to download and post.",
  },
  {
    id: "ideas",
    title: "Ideas, scripts and brief",
    page: "sample",
    tab: "ideas",
    target: { sel: "[data-tour='tabs'] [role='tablist']" },
    say: "The Ideas, Ad scripts and Creative brief tabs hold the supporting material the AI wrote for your designers and writers.",
  },
  {
    id: "strategy",
    title: "AI strategy",
    page: "sample",
    tab: "strategy",
    target: { sel: "[data-tour='tabs'] [role='tablist']" },
    say: "AI strategy suggests audience segments, the right channel mix and the messages to lead with, based on your brief.",
  },
  {
    id: "review",
    title: "Step 5: Review and approve",
    page: "sample",
    tab: "review",
    target: { sel: "[data-tour='tabs'] [role='tablist']" },
    say: "In Review and history you add reviewers. A post is only approved when a reviewer says yes, and every decision is recorded here.",
  },
  {
    id: "queue",
    title: "Review queue",
    page: "/approvals",
    target: { sel: "main" },
    say: "Reviewers find everything waiting for them in the Review queue, where they approve it or ask for changes.",
  },
  {
    id: "team",
    title: "Team and roles",
    page: "/team",
    target: { sel: "main" },
    say: "Team and roles is where the workspace admin sees everyone and decides who plans campaigns and who reviews them.",
  },
  {
    id: "finish",
    title: "You're ready",
    page: "/dashboard",
    target: { text: "Campaign dashboard", up: "div" },
    say: "That is the whole journey: set up your Company DNA, write a brief, generate the plan, create content for each channel, get it approved, and track your budget. The sample campaign stays in your list so you can explore it at your own pace. Press Guided tour at the top of any page to hear me again.",
  },
];

/** Short text fingerprint so a changed line gets a fresh recording instead of a cached one. */
export function lineVersion(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
