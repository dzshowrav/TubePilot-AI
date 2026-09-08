import type { YoutubeFlow } from "@tubepilot/contracts";
export async function authorizeYoutube(
  start: () => Promise<YoutubeFlow>,
  signal: AbortSignal,
): Promise<{ flowId: string; receipt: string }> {
  const popup = window.open(
    "about:blank",
    "tubepilot-youtube-authorization",
    "popup,width=540,height=740",
  );
  if (!popup)
    throw new Error("Allow pop-ups for TubePilot, then try connecting again.");
  try {
    const flow = await start();
    const authorization = new URL(flow.authorizationUrl);
    if (
      authorization.origin !== "https://accounts.google.com" ||
      authorization.pathname !== "/o/oauth2/v2/auth"
    )
      throw new Error(
        "The server did not return an approved Google authorization URL.",
      );
    if (signal.aborted) {
      popup.close();
      throw new Error("Authorization cancelled.");
    }
    return await new Promise((resolve, reject) => {
      let timeout: ReturnType<typeof setTimeout>,
        watch: ReturnType<typeof setInterval>;
      const cleanup = () => {
        window.removeEventListener("message", receive);
        signal.removeEventListener("abort", cancel);
        clearTimeout(timeout);
        clearInterval(watch);
      };
      const fail = (message: string) => {
        cleanup();
        popup.close();
        reject(new Error(message));
      };
      const cancel = () => fail("Authorization cancelled.");
      const receive = (event: MessageEvent) => {
        if (event.origin !== window.location.origin || event.source !== popup)
          return;
        const data = event.data;
        if (
          !data ||
          data.type !== "tubepilot.youtube.authorization" ||
          data.flowId !== flow.id
        )
          return;
        if (
          typeof data.receipt === "string" &&
          /^[A-Za-z0-9_-]{43}$/.test(data.receipt)
        ) {
          cleanup();
          popup.close();
          resolve({ flowId: flow.id, receipt: data.receipt });
        } else
          fail(
            "Google authorization was not completed. Your existing channel is unchanged.",
          );
      };
      window.addEventListener("message", receive);
      signal.addEventListener("abort", cancel, { once: true });
      timeout = setTimeout(
        () =>
          fail("This authorization expired. Start a fresh connection attempt."),
        10 * 60_000,
      );
      watch = setInterval(() => {
        if (popup.closed)
          fail(
            "The Google window closed. Try again, or enter its one-time confirmation code below if it provided one.",
          );
      }, 1000);
      popup.location.href = flow.authorizationUrl;
    });
  } catch (error) {
    popup.close();
    throw error;
  }
}
