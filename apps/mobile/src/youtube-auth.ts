import * as WebBrowser from "expo-web-browser";
import type { YoutubeFlow } from "@tubepilot/contracts";
export async function authorizeYoutube(
  start: () => Promise<YoutubeFlow>,
  signal: AbortSignal,
): Promise<{ flowId: string; receipt: string }> {
  const flow = await start(),
    redirect = "tubepilot://oauth/youtube";
  const cancel = () => {
    try {
      WebBrowser.dismissAuthSession();
    } catch {}
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    if (signal.aborted) throw new Error("Authorization cancelled.");
    const result = await WebBrowser.openAuthSessionAsync(
      flow.authorizationUrl,
      redirect,
    );
    if (signal.aborted) throw new Error("Authorization cancelled.");
    if (result.type !== "success")
      throw new Error("Google authorization was cancelled.");
    const url = new URL(result.url),
      receipt = new URLSearchParams(url.hash.slice(1)).get("receipt");
    if (
      url.protocol !== "tubepilot:" ||
      url.host !== "oauth" ||
      url.pathname !== "/youtube" ||
      url.searchParams.get("flow") !== flow.id ||
      !receipt ||
      !/^[A-Za-z0-9_-]{43}$/.test(receipt)
    )
      throw new Error(
        "Google did not return a matching authorization receipt.",
      );
    return { flowId: flow.id, receipt };
  } finally {
    signal.removeEventListener("abort", cancel);
  }
}
