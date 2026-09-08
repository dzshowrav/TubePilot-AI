import "reflect-metadata";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  Inject,
  Module,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  Catch,
  type ExceptionFilter,
  type ArgumentsHost,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import type { Request, Response, NextFunction } from "express";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { z } from "zod";
import {
  authInput,
  profileInput,
  projectInput,
  projectPatch,
  taskInput,
} from "@tubepilot/contracts";
import { Store } from "./store.js";
import { GenerationService } from "./generation.js";
import { demoAnalytics } from "./fixtures.js";
import {
  readSessionToken as token,
  SESSION_COOKIE as COOKIE,
} from "./session.js";
import { YoutubeService, type YoutubeOptions } from "./youtube/service.js";
import { YoutubeController } from "./youtube/controller.js";
const scrypt = promisify(scryptCb);
function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success)
    throw new HttpException(
      result.error.issues[0]?.message ?? "Invalid request.",
      400,
    );
  return result.data;
}
function sessionCookieOptions(req: Request) {
  // CHIPS keeps an HTTPS Arena preview usable in a cross-site iframe without sharing cookies
  // across top-level sites. Local development keeps ordinary SameSite=Lax cookies.
  const preview = (req.headers.host ?? "").split(":")[0].endsWith(".e2b.app");
  return {
    httpOnly: true,
    sameSite: preview ? ("none" as const) : ("lax" as const),
    secure: preview || process.env.NODE_ENV === "production",
    partitioned: preview,
    path: "/api",
  };
}
function setSession(req: Request, res: Response, value: string) {
  res.cookie(COOKIE, value, {
    ...sessionCookieOptions(req),
    maxAge: 7 * 86400000,
  });
  return req.headers["x-tubepilot-client"] === "native" ? { token: value } : {};
}

@Catch()
class SafeErrors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (res.headersSent) {
      res.end();
      return;
    }
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const body = error instanceof HttpException ? error.getResponse() : null;
    const message =
      typeof body === "string"
        ? body
        : body && typeof body === "object" && "message" in body
          ? String(body.message)
          : "Something went wrong. Please try again.";
    res.status(status).json({ message });
  }
}

@Controller()
class ApiController {
  constructor(
    @Inject(Store) private store: Store,
    @Inject(GenerationService) private generation: GenerationService,
    @Inject(YoutubeService) private youtube: YoutubeService,
  ) {}
  private user(req: Request) {
    return this.store.authenticate(token(req));
  }
  @Get("health") health() {
    return { ok: true, service: "TubePilot AI", version: "0.3.0" };
  }
  @Get("auth/session") sessionStatus(@Req() req: Request) {
    try {
      this.user(req);
      return { authenticated: true };
    } catch {
      return { authenticated: false };
    }
  }
  @Post("auth/demo") @HttpCode(200) demo(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    let id: string;
    try {
      id = this.user(req);
    } catch {
      id = this.store.createUser().id;
    }
    this.store.signOut(token(req));
    const session = this.store.session(id);
    return {
      profile: this.store.profile(id),
      ...setSession(req, res, session),
    };
  }
  @Post("auth/register") async register(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = parse(authInput, body);
    const salt = randomBytes(16).toString("hex");
    const key = (await scrypt(data.password, salt, 64)) as Buffer;
    let guestId: string | undefined;
    try {
      const id = this.user(req);
      if (this.store.profile(id).guest) guestId = id;
    } catch {}
    const profile = this.store.registerAccount(
      data.email,
      `${salt}:${key.toString("hex")}`,
      data.name ?? data.email.split("@")[0],
      guestId,
    );
    this.store.signOut(token(req));
    const session = this.store.session(profile.id);
    return { profile, ...setSession(req, res, session) };
  }
  @Post("auth/login") @HttpCode(200) async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = parse(authInput, body),
      user = this.store.userByEmail(data.email);
    const [salt, stored] = user?.password_hash?.split(":") ?? [
      "00000000000000000000000000000000",
      "0".repeat(128),
    ];
    const derived = (await scrypt(data.password, salt, 64)) as Buffer;
    const matches = timingSafeEqual(derived, Buffer.from(stored, "hex"));
    if (!user || !matches)
      throw new UnauthorizedException("The email or password is incorrect.");
    this.store.signOut(token(req));
    const session = this.store.session(user.id);
    return {
      profile: this.store.profile(user.id),
      ...setSession(req, res, session),
    };
  }
  @Post("auth/logout") @HttpCode(200) logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.store.signOut(token(req));
    res.clearCookie(COOKIE, sessionCookieOptions(req));
    return { ok: true };
  }
  @Get("bootstrap") bootstrap(@Req() req: Request) {
    const id = this.user(req);
    return {
      profile: this.store.profile(id),
      projects: this.store.projects(id),
      trends: this.store.trends(id),
      analytics: demoAnalytics(),
      notifications: this.store.notices(id),
      integrations: {
        youtube: !this.youtube.config
          ? "not-configured"
          : this.youtube.status(id).state === "not_connected"
            ? "not-connected"
            : this.youtube.status(id).state === "needs_reconnect"
              ? "needs-reconnect"
              : "connected",
        ai: this.generation.modeFor(this.store.profile(id)),
        billing: "not-configured",
      },
      youtube: this.youtube.status(id),
      serverTime: new Date().toISOString(),
    };
  }
  @Patch("me") profile(@Req() req: Request, @Body() body: unknown) {
    return this.store.updateProfile(this.user(req), parse(profileInput, body));
  }
  @Get("me/export") export(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const id = this.user(req);
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="tubepilot-workspace.json"',
    );
    return { ...this.store.exportUser(id), youtube: this.youtube.status(id) };
  }
  @Delete("me") removeUser(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const id = this.user(req);
    this.generation.cancelUser(id);
    const youtube = this.youtube.disconnect(id, true);
    this.store.deleteAccount(id);
    res.clearCookie(COOKIE, sessionCookieOptions(req));
    return { ok: true, youtube };
  }
  @Get("projects") projects(@Req() req: Request) {
    return this.store.projects(this.user(req));
  }
  @Post("projects") createProject(@Req() req: Request, @Body() body: unknown) {
    return this.store.createProject(this.user(req), parse(projectInput, body));
  }
  @Get("projects/:id") project(@Req() req: Request, @Param("id") id: string) {
    return this.store.project(this.user(req), id);
  }
  @Patch("projects/:id") patchProject(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.store.updateProject(
      this.user(req),
      id,
      parse(projectPatch, body),
    );
  }
  @Delete("projects/:id") deleteProject(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    return this.store.deleteProject(this.user(req), id);
  }
  @Get("trends") trends(@Req() req: Request) {
    return this.store.trends(this.user(req));
  }
  @Post("trends/:id/save") @HttpCode(200) saveTrend(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const data = parse(z.object({ saved: z.boolean() }).strict(), body);
    return this.store.saveTrend(this.user(req), id, data.saved);
  }
  @Post("notifications/read") @HttpCode(200) read(@Req() req: Request) {
    return this.store.readNotices(this.user(req));
  }
  @Get("ai/tasks") tasks(@Req() req: Request) {
    return this.store.taskHistory(this.user(req));
  }
  @Post("ai/tasks") @HttpCode(202) createTask(
    @Req() req: Request,
    @Body() body: unknown,
  ) {
    const userId = this.user(req);
    const key = req.headers["idempotency-key"];
    if (typeof key !== "string" || !/^[a-zA-Z0-9:_-]{8,128}$/.test(key))
      throw new HttpException(
        "A valid Idempotency-Key header is required.",
        400,
      );
    return this.generation.submit(userId, parse(taskInput, body), key);
  }
  @Get("ai/tasks/:id") task(@Req() req: Request, @Param("id") id: string) {
    return this.store.task(this.user(req), id);
  }
  @Post("ai/tasks/:id/cancel") @HttpCode(200) cancel(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    return this.generation.cancel(this.user(req), id);
  }
  @Get("ai/tasks/:id/events") events(
    @Req() req: Request,
    @Res() res: Response,
    @Param("id") id: string,
  ) {
    const userId = this.user(req);
    this.store.task(userId, id);
    let cursor = Number(req.headers["last-event-id"] ?? 0);
    if (!Number.isSafeInteger(cursor) || cursor < 0)
      throw new HttpException("Invalid event cursor.", 400);
    res.status(200).set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    });
    res.flushHeaders();
    let timer: ReturnType<typeof setInterval> | undefined;
    let cycles = 0;
    const send = () => {
      try {
        this.user(req);
        for (const event of this.store.events(userId, id, cursor)) {
          const data = JSON.parse(event.payload);
          res.write(
            `id: ${event.sequence}\nevent: ${data.type}\ndata: ${event.payload}\n\n`,
          );
          cursor = event.sequence;
        }
        const task = this.store.task(userId, id);
        if (!["queued", "running"].includes(task.status)) {
          if (timer) clearInterval(timer);
          res.end();
        } else if (++cycles % 20 === 0) res.write(": heartbeat\n\n");
      } catch {
        if (timer) clearInterval(timer);
        res.end();
      }
    };
    send();
    if (!res.writableEnded) timer = setInterval(send, 500);
    res.on("close", () => {
      if (timer) clearInterval(timer);
    });
  }
  @Get("billing/usage") usage(@Req() req: Request) {
    const id = this.user(req);
    return {
      profile: this.store.profile(id),
      ledger: this.store.ledger(id),
      billingConfigured: false,
    };
  }
}

export async function createApplication(
  options: {
    databasePath?: string;
    demoDelay?: number;
    quiet?: boolean;
    youtube?: YoutubeOptions;
  } = {},
) {
  const store = new Store(
    options.databasePath ??
      process.env.DATABASE_PATH ??
      resolve(process.cwd(), "../../.data/tubepilot.sqlite"),
  );
  const generation = new GenerationService(store, options.demoDelay);
  const youtube = new YoutubeService(store, options.youtube);
  @Module({
    controllers: [ApiController, YoutubeController],
    providers: [
      { provide: Store, useValue: store },
      { provide: GenerationService, useValue: generation },
      { provide: YoutubeService, useValue: youtube },
    ],
  })
  class ApiModule {}
  const app = await NestFactory.create(ApiModule, {
    logger: options.quiet ? false : ["error", "warn", "log"],
    bodyParser: false,
  });
  const express = await import("express");
  app.use(express.default.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin
    ) {
      try {
        const origin = new URL(req.headers.origin);
        const allowed = youtube.config?.appOrigin ?? process.env.APP_ORIGIN;
        if (origin.host !== req.headers.host && origin.origin !== allowed)
          return res
            .status(403)
            .json({ message: "Cross-origin writes are not allowed." });
      } catch {
        return res.status(403).json({ message: "Invalid request origin." });
      }
    }
    next();
  });
  const limits = new Map<string, { count: number; reset: number }>();
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "POST" || !req.path.includes("/auth/")) return next();
    const key = req.ip ?? "local";
    const current = Date.now();
    if (limits.size > 2000) {
      for (const [id, entry] of limits)
        if (entry.reset < current) limits.delete(id);
      if (limits.size > 2000)
        return res.status(429).json({ message: "Please try again later." });
    }
    let entry = limits.get(key);
    if (!entry || entry.reset < current) {
      entry = { count: 0, reset: current + 60000 };
      limits.set(key, entry);
    }
    if (++entry.count > 30) {
      res.setHeader("Retry-After", "60");
      return res
        .status(429)
        .json({ message: "Too many sign-in attempts. Try again in a minute." });
    }
    next();
  });
  app.setGlobalPrefix("api/v1");
  app.useGlobalFilters(new SafeErrors());
  app.enableShutdownHooks();
  return {
    app,
    store,
    generation,
    youtube,
    close: async () => {
      generation.shutdown();
      await youtube.close();
      await app.close();
      store.close();
    },
  };
}
