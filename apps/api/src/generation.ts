import { BadRequestException } from "@nestjs/common";
import {
  AiGateway,
  ModelRegistry,
  buildGatewayPayload,
  GatewayError,
  formatGatewayError,
} from "@tubepilot/ai-gateway";
import type { ChatRequest, ModelDefinition } from "@tubepilot/ai-gateway";
import { z } from "zod";
import type { Generation, Profile, TaskInput } from "@tubepilot/contracts";
import { toolLabels } from "@tubepilot/contracts";
import { Store } from "./store.js";

export function demoGeneration(input: TaskInput, profile: Profile): Generation {
  const topic = input.topic
    .replace(/\s+/g, " ")
    .slice(0, 180)
    .replace(/[.!?]+$/, "");
  const bengali = profile.language === "bn";
  const heading = bengali
    ? `${topic} — আপনার পরবর্তী ভিডিও`
    : `A fresh take on ${topic}`;
  if (input.tool === "ideas") {
    const angles = [
      [
        "The beginner’s guide to",
        "Make the first step feel possible.",
        "Walk through a real example from start to finish.",
      ],
      [
        "I put this to the test:",
        "Start with a question, not a promise.",
        "Plan an honest, on-camera experiment and document what happens.",
      ],
      [
        "A simpler approach to",
        "Show the before and the after.",
        "Replace an overly complicated process with three practical steps.",
      ],
      [
        "What I wish I knew about",
        "Lead with a relatable learning moment.",
        "Share mistakes you actually made and what you would change.",
      ],
      [
        "Behind the scenes of",
        "Invite your audience into your process.",
        "Build in public and explain your decisions along the way.",
      ],
      [
        "Is it worth your time?",
        "Answer the question your viewer is asking.",
        "Compare the experience, trade-offs, and real costs.",
      ],
      [
        "Start here:",
        "Create one small, useful win.",
        "Make an approachable checklist with an original demonstration.",
      ],
      [
        "A creator’s honest take on",
        "Explain what matters for your niche.",
        "Separate first-hand observations from claims that still need verification.",
      ],
      [
        "Let’s build something with",
        "Turn theory into a tangible result.",
        "Build a small example your viewers can follow.",
      ],
      [
        "Your next step with",
        "Give your audience a clear next action.",
        "Design a practical follow-up based on a question from your own community.",
      ],
    ];
    const ideas = angles.slice(0, input.count).map((a, i) => ({
      title: (bengali
        ? `${topic}: ${["সহজ শুরু", "একটি বাস্তব পরীক্ষা", "আরও সহজ উপায়", "আমার শেখা বিষয়", "কাজের পেছনের গল্প", "সময়ের সঠিক ব্যবহার", "নতুন একটি দৃষ্টিভঙ্গি", "সুবিধা ও সীমাবদ্ধতা", "ধাপে ধাপে একটি উদাহরণ", "আপনার পরবর্তী পদক্ষেপ"][i]}`
        : `${a[0]} ${topic}`
      ).slice(0, 180),
      hook: bengali ? "একটি বাস্তব উদাহরণ দিয়ে শুরু করুন।" : a[1],
      angle: bengali
        ? "নিজের অভিজ্ঞতা ও যাচাই করা তথ্য ব্যবহার করে দর্শককে একটি কাজে সাহায্য করুন।"
        : a[2],
      format: input.format,
    }));
    return {
      heading,
      content: ideas
        .map(
          (idea, i) => `${i + 1}. ${idea.title}\n${idea.hook}\n${idea.angle}`,
        )
        .join("\n\n"),
      ideas,
      source: "demo",
    };
  }
  if (input.tool === "titles") {
    const titles = bengali
      ? [
          `${topic}: শুরু করুন এখান থেকে`,
          `${topic} — সহজ একটি গাইড`,
          `আমি যেভাবে ${topic} ব্যবহার করি`,
          `${topic}: আসল সুবিধা ও সীমাবদ্ধতা`,
          `${topic} নিয়ে আপনার পরবর্তী পদক্ষেপ`,
          `${topic}: ছোট একটি ধারণা থেকে শুরু`,
          `চলুন ${topic} নিয়ে কিছু তৈরি করি`,
          `${topic}: কাজের পেছনের গল্প`,
          `${topic} নিয়ে একটি বাস্তব উদাহরণ`,
          `${topic}: নতুন একটি দৃষ্টিভঙ্গি`,
        ]
      : [
          `The Beginner’s Guide to ${topic}`,
          `${topic}: A Simpler Way to Get Started`,
          `What I Wish I Knew About ${topic}`,
          `A Creator’s Honest Guide to ${topic}`,
          `Is ${topic} Actually Worth Your Time?`,
          `Let’s Build Something With ${topic}`,
          `${topic}, Without the Overwhelm`,
          `A Practical Approach to ${topic}`,
          `Behind the Scenes: ${topic}`,
          `Start Here: ${topic}`,
        ];
    return {
      heading: "Give your idea a great first impression",
      content: titles
        .slice(0, input.count)
        .map((t) => t.slice(0, 180))
        .map((t, i) => `${i + 1}. ${t}`)
        .join("\n\n"),
      titles: titles.slice(0, input.count).map((t) => t.slice(0, 180)),
      source: "demo",
    };
  }
  if (bengali)
    return {
      heading,
      source: "demo",
      content: `# শুরু\n${topic} নিয়ে কাজ শুরু করতে চান? চলুন একটি সহজ, বাস্তব উদাহরণ দেখি।\n\n# সমস্যা\nদর্শকের নির্দিষ্ট সমস্যাটি নিজের ভাষায় তুলে ধরুন।\n\n# মূল অংশ\n১. আপনার উদ্দেশ্য ও প্রেক্ষাপট ব্যাখ্যা করুন।\n২. ধাপে ধাপে একটি আসল উদাহরণ দেখান।\n৩. কী কাজ করেছে এবং কী করেনি, তা সততার সঙ্গে বলুন।\n\n# শেষ কথা\nআজই করার মতো একটি ছোট কাজ দিন। পরবর্তী ভিডিওতে কী দেখতে চান, তা জিজ্ঞেস করুন।\n\nনমুনা খসড়া: প্রকাশের আগে নিজের অভিজ্ঞতা যোগ করুন এবং সব তথ্য যাচাই করুন।`,
    };
  const outputs: Record<string, string> = {
    script: `# Hook · 0:00–0:20\nWhat if ${topic.toLowerCase()} could feel a little less complicated? Today, we’re taking one real example and working through it together.\n\n# Set the scene · 0:20–1:00\nIntroduce the specific problem your audience is trying to solve. Explain why it matters to you, and show your current approach on screen.\n\n# The walkthrough · 1:00–4:00\nStep 1 — Start with one clear outcome. Show the actual task before introducing any tools.\n\nStep 2 — Walk through your process. Record the screen, explain your decisions, and keep the parts where things don’t go as planned.\n\nStep 3 — Compare the result to your starting point. Use your own observations, not invented benchmarks.\n\n# The honest takeaway · 4:00–5:00\nShare what worked for you, what you would change, and who this approach might not suit. Add real examples and verify any factual claims.\n\n# Close · 5:00–5:20\nYour next step: try one small part of this process today. What would you like me to test next? Leave your question in the comments.\n\nProduction note: this is a template draft, not a completed factual script. Add your own experience, footage, and verified sources.`,
    description: `A practical, honest guide to ${topic.toLowerCase()} — made for curious creators who want to spend less time figuring things out and more time making things.\n\nIn this video:\n• The problem we’re trying to solve\n• A real, step-by-step walkthrough\n• What worked, what didn’t, and the next step\n\nCHAPTERS — replace with your actual edit timings\n00:00 Let’s get started\n00:20 The problem\n01:00 The walkthrough\n04:00 The takeaways\n\nRESOURCES\nAdd links to sources and tools you actually used. Disclose affiliate links or sponsorships where applicable.\n\n#CreatorTools #CreativeWorkflow #Tutorial\n\nKeywords help describe your video; they do not guarantee placement.`,
    shorts: `# 0–3 seconds · The hook\n“Here’s a simpler way to approach ${topic.toLowerCase()}.”\nVisual: show the outcome first.\n\n# 3–12 seconds · The setup\nShow the original problem in one short shot. Keep captions concise and readable.\n\n# 12–35 seconds · The useful part\nDemonstrate one real step. Use a screen recording or close-up, not a list of promises.\n\n# 35–50 seconds · The payoff\nShow what changed and explain the limitation in one sentence.\n\n# 50–60 seconds · Close the loop\nReturn to the opening shot. Invite viewers to try the step and share their experience.\n\nCaption: One small change. A more intentional workflow.\nDraft timing is a suggestion; verify Shorts eligibility for your actual upload.`,
    thumbnail: `# Concept A · The clear outcome\nSubject: a close-up of the real result of ${topic.toLowerCase()}.\nComposition: one focal point on the right, clean negative space on the left.\nText: “A simpler way” — three words, large and high-contrast.\nPalette: deep charcoal, soft lavender, one lime accent.\n\n# Concept B · Before / After\nShow an authentic before-and-after comparison from your video. Avoid misleading transformations. Keep the split obvious at mobile size.\n\n# Concept C · The honest question\nOne expressive portrait, one recognizable object, and the words “Worth it?” Use your own photos or properly licensed assets.\n\n# Mobile check\nPreview at 160 pixels wide. Can you identify the subject and read the text? Remove anything that competes for attention.\n\nThese are concept briefs, not generated images or measured CTR predictions.`,
    assistant: `Here’s a practical starting point for your ${profile.niche.toLowerCase()} channel.\n\n## Your question\n${topic}\n\n## My suggestion\nStart with one specific viewer problem rather than a broad topic. Choose an original example you can actually demonstrate, then build the video around a clear before-and-after.\n\n## A small plan for this week\n1. Pick a question you can answer with first-hand experience.\n2. Draft the hook before writing the rest of the script.\n3. Record a small test and review the opening on your phone.\n4. Save your idea in Projects and give it a realistic calendar slot.\n\n## Keep in mind\nThis workspace currently uses sample channel data and a template-powered assistant. I can help you practice the workflow, but I haven’t analyzed a connected YouTube channel or live trends.`,
  };
  return {
    heading: toolLabels[input.tool],
    content:
      outputs[
        input.tool === "script" && input.format === "Short"
          ? "shorts"
          : input.tool
      ] ?? "",
    source: "demo",
  };
}

const resultSchema = z
  .object({
    heading: z.string().max(200),
    content: z.string().min(1).max(30000),
    ideas: z
      .array(
        z.object({
          title: z.string().max(180),
          hook: z.string().max(500),
          angle: z.string().max(1000),
          format: z.string().max(60),
        }),
      )
      .max(10)
      .optional(),
    titles: z.array(z.string().max(180)).max(10).optional(),
  })
  .strict();
export class GenerationService {
  private gateway: AiGateway | null = null;
  private model: ModelDefinition | null = null;
  private controllers = new Map<string, AbortController>();
  private priceIn = 0;
  private priceOut = 0;
  readonly dailyBudget: number;
  constructor(
    private store: Store,
    private demoDelay = 250,
  ) {
    this.dailyBudget = Math.round(
      Number(process.env.AI_DAILY_BUDGET_USD ?? "2") * 1e6,
    );
    if (process.env.AI_ENABLE_LIVE === "true") {
      if (process.env.NODE_ENV === "production")
        throw new Error(
          "Production live inference is blocked until account verification and moderation are implemented.",
        );
      const key = process.env.HF_TOKEN,
        upstream = process.env.HF_MODEL;
      this.priceIn = Number(process.env.AI_INPUT_PRICE_PER_MILLION);
      this.priceOut = Number(process.env.AI_OUTPUT_PRICE_PER_MILLION);
      if (
        !key ||
        !upstream ||
        process.env.AI_MODEL_VERIFIED !== "true" ||
        ![this.priceIn, this.priceOut, this.dailyBudget].every(
          (n) => Number.isFinite(n) && n > 0,
        )
      )
        throw new Error(
          "Live AI requires a verified model, backend token, positive prices and daily budget.",
        );
      this.model = {
        id: "creator-model",
        providerId: "huggingface",
        upstreamModel: upstream,
        name: "Creator model",
        category: "Configured",
        enabled: true,
        contextWindowTokens: Number(process.env.AI_CONTEXT_TOKENS ?? 16384),
        maxOutputTokens: 2048,
        capabilities: {
          streaming: true,
          streamUsage: false,
          vision: false,
          sampling: [],
          outputTokenParameter: "max_tokens",
        },
      };
      this.gateway = new AiGateway({
        providers: [
          { id: "huggingface", getApiKey: () => process.env.HF_TOKEN ?? "" },
        ],
        models: new ModelRegistry([this.model]),
        retry: { maxRetries: 0 },
      });
    }
  }
  get mode(): "demo" | "provider" {
    return this.gateway ? "provider" : "demo";
  }
  modeFor(profile: Profile): "demo" | "provider" {
    return profile.guest ? "demo" : this.mode;
  }
  request(input: TaskInput, profile: Profile): ChatRequest {
    const project = input.projectId
      ? this.store.project(profile.id, input.projectId)
      : null;
    return {
      modelId: "creator-model",
      instructions: `You are the ${toolLabels[input.tool]} tool. Respond ONLY as JSON with heading and content strings.${input.tool === "ideas" ? " Also return ideas: [{title,hook,angle,format}]." : ""}${input.tool === "titles" ? " Also return titles: [string]." : ""} Generate at most ${input.count} options. Never invent metrics. Return useful editable draft content, not a claim that research or filming has happened.`,
      context: [
        ...(project
          ? [
              {
                id: project.id,
                source: "User-owned project draft",
                updatedAt: project.updatedAt,
                text: JSON.stringify({
                  title: project.title,
                  topic: project.topic,
                  script: project.script.slice(0, 8000),
                }),
              },
            ]
          : []),
        {
          id: "profile",
          source: "User-provided brand voice",
          updatedAt: profile.createdAt,
          text: JSON.stringify({
            niche: profile.niche,
            language: profile.language,
            voice: profile.voice,
            goal: profile.goal,
          }),
        },
      ],
      messages: [{ role: "user", content: input.topic }],
      settings: { maxOutputTokens: 2048 },
    };
  }
  quote(input: TaskInput, profile: Profile) {
    if (!this.model || this.modeFor(profile) === "demo") return 0;
    const built = buildGatewayPayload(
      this.request(input, profile),
      this.model,
      false,
    );
    return Math.ceil(
      built.context.estimatedInputTokens * this.priceIn +
        built.context.maxOutputTokens * this.priceOut,
    );
  }
  submit(userId: string, input: TaskInput, key: string) {
    const profile = this.store.profile(userId);
    const prepared =
      this.modeFor(profile) === "provider"
        ? this.request(input, profile)
        : undefined;
    const admission = this.store.admitTask(
      userId,
      input,
      key,
      this.modeFor(profile),
      this.quote(input, profile),
      this.dailyBudget,
    );
    if (admission.fresh)
      setImmediate(
        () =>
          void this.run(admission.task.id, userId, input, profile, prepared),
      );
    return admission.task;
  }
  private async pause(signal: AbortSignal) {
    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(new Error("cancelled"));
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", abort);
        resolve();
      }, this.demoDelay);
      const abort = () => {
        clearTimeout(timer);
        reject(new Error("cancelled"));
      };
      signal.addEventListener("abort", abort, { once: true });
    });
  }
  private async run(
    id: string,
    userId: string,
    input: TaskInput,
    profile: Profile,
    prepared?: ChatRequest,
  ) {
    if (!this.store.startTask(id)) return;
    const controller = new AbortController();
    this.controllers.set(id, controller);
    try {
      this.store.profile(userId); // Recheck account access; context itself is the admission-time snapshot.
      if (input.projectId) this.store.project(userId, input.projectId);
      let result: Generation;
      if (this.gateway && prepared) {
        this.store.progress(id, 35);
        const response = await this.gateway.chat(prepared, {
          signal: controller.signal,
          timeoutMs: 90000,
        });
        if (response.finishReason !== "stop")
          throw new BadRequestException(
            "The AI response was incomplete. Try a smaller request.",
          );
        const clean = response.content
          .replace(/^```(?:json)?\s*/, "")
          .replace(/\s*```$/, "");
        const parsed = resultSchema.parse(JSON.parse(clean));
        if (
          (input.tool === "ideas" && !parsed.ideas?.length) ||
          (input.tool === "titles" && !parsed.titles?.length)
        )
          throw new Error("Invalid feature output");
        result = { ...parsed, source: "provider" };
      } else {
        for (const progress of [28, 52, 78]) {
          await this.pause(controller.signal);
          this.store.progress(id, progress);
        }
        result = demoGeneration(input, profile);
      }
      if (!controller.signal.aborted)
        this.store.finishTask(id, "completed", result, null);
    } catch (error) {
      if (!controller.signal.aborted)
        this.store.finishTask(
          id,
          "failed",
          null,
          error instanceof GatewayError
            ? formatGatewayError(error)
            : "The generation could not be completed. Please try a new request.",
        );
    } finally {
      this.controllers.delete(id);
    }
  }
  cancel(userId: string, id: string) {
    const task = this.store.task(userId, id);
    if (["queued", "running"].includes(task.status)) {
      this.store.finishTask(
        id,
        "cancelled",
        null,
        this.store.taskRow(id)?.mode === "provider"
          ? "Cancelled. Accepted provider work may still use credits."
          : "Cancelled. Reserved demo credits were returned.",
      );
      this.controllers.get(id)?.abort();
    }
    return this.store.task(userId, id);
  }
  cancelUser(userId: string) {
    for (const task of this.store.activeTasks(userId))
      if (["queued", "running"].includes(task.status))
        this.cancel(userId, task.id);
  }
  shutdown() {
    for (const controller of this.controllers.values()) controller.abort();
  }
}
