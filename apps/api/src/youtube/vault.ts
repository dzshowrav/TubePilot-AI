import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
/** AES-GCM envelopes are bound to purpose + owner + record. Keys are supplied only by the operator. */
export class TokenVault {
  constructor(private readonly key: Buffer) {
    if (key.length !== 32) throw new Error("Invalid token-vault key.");
  }
  seal(value: unknown, context: string): string {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from("tubepilot.youtube.v1:" + context));
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(value), "utf8"),
      cipher.final(),
    ]);
    return [
      "v1",
      iv.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      encrypted.toString("base64url"),
    ].join(".");
  }
  open<T>(value: string, context: string): T {
    try {
      if (value.length > 100_000) throw new Error();
      const [version, nonce, tag, payload, ...extra] = value.split(".");
      if (version !== "v1" || extra.length || !nonce || !tag || !payload)
        throw new Error();
      const iv = Buffer.from(nonce, "base64url"),
        authTag = Buffer.from(tag, "base64url");
      if (iv.length !== 12 || authTag.length !== 16) throw new Error();
      const cipher = createDecipheriv("aes-256-gcm", this.key, iv);
      cipher.setAAD(Buffer.from("tubepilot.youtube.v1:" + context));
      cipher.setAuthTag(authTag);
      return JSON.parse(
        Buffer.concat([
          cipher.update(Buffer.from(payload, "base64url")),
          cipher.final(),
        ]).toString("utf8"),
      ) as T;
    } catch {
      throw new Error(
        "Stored YouTube credentials could not be decrypted. Check the server key or reconnect.",
      );
    }
  }
}
