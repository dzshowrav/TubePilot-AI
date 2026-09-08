import type { Request } from "express";
export const SESSION_COOKIE = "tubepilot_session";
export function readSessionToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  const cookie = req.cookies?.[SESSION_COOKIE];
  return typeof cookie === "string" ? cookie : undefined;
}
