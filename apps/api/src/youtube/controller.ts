import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  youtubeStartInput,
  youtubeReceiptInput,
  youtubeConfirmInput,
  youtubeDisconnectInput,
} from "@tubepilot/contracts";
import { Store } from "../store.js";
import { readSessionToken } from "../session.js";
import { YoutubeService, callbackDocument } from "./service.js";
function parse<T>(schema: z.ZodType<T>, data: unknown) {
  const result = schema.safeParse(data);
  if (!result.success)
    throw new HttpException(
      result.error.issues[0]?.message ?? "Invalid connection request.",
      400,
    );
  return result.data;
}
@Controller("youtube")
export class YoutubeController {
  constructor(
    @Inject(Store) private store: Store,
    @Inject(YoutubeService) private youtube: YoutubeService,
  ) {}
  private actor(req: Request) {
    const token = readSessionToken(req);
    return { id: this.store.authenticate(token), token: token! };
  }
  @Get() status(@Req() req: Request) {
    return this.youtube.status(this.actor(req).id);
  }
  @Post("flows") @HttpCode(201) start(
    @Req() req: Request,
    @Body() body: unknown,
  ) {
    const actor = this.actor(req);
    return this.youtube.start(
      actor.id,
      actor.token,
      parse(youtubeStartInput, body),
      req.headers.origin,
    );
  }
  @Post("flows/:id/review") @HttpCode(200) review(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const actor = this.actor(req),
      input = parse(youtubeReceiptInput, body);
    return this.youtube.review(actor.id, actor.token, id, input.receipt);
  }
  @Post("flows/:id/confirm") @HttpCode(200) confirm(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const actor = this.actor(req),
      input = parse(youtubeConfirmInput, body);
    return this.youtube.confirm(
      actor.id,
      actor.token,
      id,
      input.receipt,
      input.channelId,
    );
  }
  @Delete("flows/:id") cancel(@Req() req: Request, @Param("id") id: string) {
    return this.youtube.cancel(this.actor(req).id, id);
  }
  @Post("sync") @HttpCode(202) sync(@Req() req: Request) {
    return this.youtube.sync(this.actor(req).id);
  }
  @Delete() disconnect(@Req() req: Request, @Body() body: unknown) {
    return this.youtube.disconnect(
      this.actor(req).id,
      parse(youtubeDisconnectInput, body).revoke,
    );
  }
  @Get("oauth/callback") async callback(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const input = parse(
      z.object({
        state: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
        code: z.string().max(4096).optional(),
        error: z.string().max(200).optional(),
      }),
      req.query,
    );
    const result = await this.youtube.callback(
        input.state,
        input.code,
        input.error,
      ),
      document = callbackDocument(result);
    res.set({
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      "Referrer-Policy": "no-referrer",
      "Cross-Origin-Opener-Policy": "unsafe-none",
      "Content-Security-Policy": `default-src 'none'; base-uri 'none'; frame-ancestors 'none'; script-src 'nonce-${document.nonce}'; style-src 'nonce-${document.nonce}'; form-action 'none'`,
    });
    if (result.client === "native") {
      res.redirect(303, document.nativeUrl);
      return;
    }
    res.type("html").send(document.html);
  }
}
