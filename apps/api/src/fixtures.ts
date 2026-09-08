import type { Trend, ProjectInput, Analytics } from "@tubepilot/contracts";

/** Fictional product-demo fixtures; not fetched YouTube data or verified opportunities. */
export const trends: Trend[] = [
  {
    id: "trend-ai-agents",
    title: "The AI agents everyone will be using",
    summary:
      "Move beyond chatbots. Show your audience what an autonomous AI workflow actually looks like.",
    category: "AI & Technology",
    format: "Tutorial",
    score: 94,
    growth: 128,
    state: "Emerging",
    visual: "tools",
    tags: ["AI agents", "Productivity", "Tutorial"],
    why: "In this sample dataset, practical AI tutorials align with the channel’s educational voice. Validate real demand before publishing.",
    source: "demo",
  },
  {
    id: "trend-solo",
    title: "The one-person business is having a moment",
    summary:
      "An honest look at the tools, systems, and small experiments behind independent creators.",
    category: "Creator economy",
    format: "Long-form",
    score: 89,
    growth: 86,
    state: "Rising",
    visual: "creator",
    tags: ["Creator economy", "Business", "Behind the scenes"],
    why: "An accessible behind-the-scenes format creates an opportunity to share your own experience, not unverified income claims.",
    source: "demo",
  },
  {
    id: "trend-workflow",
    title: "Build a calmer, smarter creative workflow",
    summary:
      "Less tab switching, more creating. A practical system your audience can put to work today.",
    category: "Productivity",
    format: "Tutorial",
    score: 87,
    growth: 64,
    state: "Rising",
    visual: "workflow",
    tags: ["Workflow", "Notion", "Productivity"],
    why: "A clear before-and-after demonstration gives viewers something tangible to try. Sample fit score only.",
    source: "demo",
  },
  {
    id: "trend-design",
    title: "Good design without the big budget",
    summary:
      "Test approachable design tools and show the results, including where they fall short.",
    category: "Design",
    format: "Tutorial",
    score: 84,
    growth: 52,
    state: "Emerging",
    visual: "design",
    tags: ["Design", "Creative tools", "Review"],
    why: "Transparent comparisons can be useful to early-stage creators. Do not invent benchmark results.",
    source: "demo",
  },
  {
    id: "trend-code",
    title: "I built my first app with an AI copilot",
    summary:
      "Document the whole process: what worked, what broke, and what you actually learned.",
    category: "AI & Technology",
    format: "Long-form",
    score: 91,
    growth: 105,
    state: "Hot",
    visual: "coding",
    tags: ["Build in public", "Coding", "AI"],
    why: "A real project offers an original narrative. Show actual outcomes instead of claiming any tool guarantees success.",
    source: "demo",
  },
  {
    id: "trend-studio",
    title: "Your tiny desk can be a great studio",
    summary:
      "Make a low-cost creator setup feel intentional with light, framing, and better sound.",
    category: "Creator economy",
    format: "Short",
    score: 81,
    growth: 43,
    state: "Emerging",
    visual: "studio",
    tags: ["Creator setup", "Shorts", "Filmmaking"],
    why: "Visual before-and-after content can fit a short format. Verify costs and disclose sponsorships.",
    source: "demo",
  },
];
export function seedProjects(): ProjectInput[] {
  const next = new Date();
  next.setDate(next.getDate() + 3);
  return [
    {
      title: "I tested 7 AI tools so you don’t have to",
      topic: "A hands-on comparison of practical AI tools for creators",
      format: "Long-form",
      stage: "ready",
      visual: "tools",
      scheduledFor: next.toISOString().slice(0, 10),
      titles: ["I Tested 7 AI Tools. Here’s What I Actually Use."],
      thumbnail:
        "A clean split composition: creator on the left, three tool icons on the right. Minimal text: “Worth it?”",
      description:
        "An honest, hands-on comparison of AI tools for creators. Demo draft: verify every claim before publishing.",
      script:
        "# Hook\nSeven tools. One week. Which ones actually earned a place in my workflow?\n\n# The experiment\nPick a real creative task and show the baseline before using any AI tools.\n\n# The results\nWalk through your own observations. Show the screen recordings and discuss the trade-offs.\n\n# Takeaway\nChoose the tool that solves your actual problem, not the one with the loudest launch.",
    },
    {
      title: "The quiet rise of one-person businesses",
      topic: "A realistic look at independent creative work",
      format: "Long-form",
      stage: "scripting",
      visual: "creator",
      scheduledFor: null,
      titles: [],
      thumbnail: "",
      description: "",
      script:
        "# Opening\nWhat does it really take to build a sustainable one-person business?\n\n# Outline\n1. Start with a specific problem.\n2. Build a repeatable workflow.\n3. Share a real experiment.\n4. Discuss the limitations honestly.",
    },
    {
      title: "Your entire workflow. One AI assistant.",
      topic: "Building a simple creative workflow with an AI assistant",
      format: "Tutorial",
      stage: "idea",
      visual: "workflow",
      scheduledFor: null,
      titles: [],
      thumbnail: "",
      description: "",
      script: "",
    },
  ];
}
export function demoAnalytics(): Analytics {
  const series = Array.from({ length: 28 }, (_, i) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 27 + i);
    const views = Math.round(
      3400 +
        i * 155 +
        Math.sin(i * 0.65) * 1100 +
        (i > 14 ? 2300 : 0) +
        (i > 23 ? 2100 : 0),
    );
    return {
      date: date.toISOString().slice(0, 10),
      views,
      subscribers: Math.round(views / 138),
      watchHours: Math.round(views * 0.069),
    };
  });
  // Keep totals, period filters, charts and CSV exports internally consistent.
  for (const [key, target] of [
    ["views", 248620],
    ["watchHours", 18420],
    ["subscribers", 1248],
  ] as const) {
    const total = series.reduce((sum, item) => sum + item[key], 0);
    for (const item of series)
      item[key] = Math.round((item[key] * target) / total);
    series[series.length - 1][key] +=
      target - series.reduce((sum, item) => sum + item[key], 0);
  }
  return {
    views: 248620,
    watchHours: 18420,
    subscribers: 1248,
    ctr: 6.8,
    series,
    source: "demo",
    sources: [
      { name: "Browse features", value: 42, color: "#b5a0fa" },
      { name: "Suggested videos", value: 28, color: "#d2f580" },
      { name: "YouTube search", value: 19, color: "#efb988" },
      { name: "Other", value: 11, color: "#66697c" },
    ],
    videos: [
      {
        title: "5 AI tools I actually use every day",
        views: 42680,
        ctr: 8.4,
        retention: 62,
        visual: "tools",
      },
      {
        title: "A simpler way to organize your creative life",
        views: 28420,
        ctr: 7.2,
        retention: 58,
        visual: "workflow",
      },
      {
        title: "My desk setup for a more focused day",
        views: 21900,
        ctr: 6.9,
        retention: 54,
        visual: "studio",
      },
      {
        title: "The honest truth about working for yourself",
        views: 17340,
        ctr: 6.1,
        retention: 51,
        visual: "creator",
      },
    ],
  };
}
