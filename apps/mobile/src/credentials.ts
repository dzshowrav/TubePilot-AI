import * as SecureStore from "expo-secure-store";
import * as Clipboard from "expo-clipboard";
import { Share } from "react-native";
import { normalizeApiOrigin, readScopedSession } from "@tubepilot/contracts";
const ORIGIN_KEY = "tubepilot_api_origin";
const SESSION_KEY = "tubepilot_scoped_session";
export const requestCredentials: RequestCredentials = "omit";
export async function getApiOrigin(): Promise<string> {
  const configured =
    (await SecureStore.getItemAsync(ORIGIN_KEY)) ||
    process.env.EXPO_PUBLIC_API_URL ||
    "";
  return configured ? normalizeApiOrigin(configured) : "";
}
export async function getApiBaseUrl(): Promise<string> {
  const origin = await getApiOrigin();
  return origin ? origin + "/api/v1" : "";
}
export async function sessionHeaders(
  apiBase: string,
): Promise<Record<string, string>> {
  const token = readScopedSession(
    await SecureStore.getItemAsync(SESSION_KEY),
    apiBase,
  );
  return {
    "x-tubepilot-client": "native",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
export async function saveToken(token: string, apiBase: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new Error("The backend returned an invalid app session.");
  await SecureStore.setItemAsync(
    SESSION_KEY,
    JSON.stringify({ apiBase, token }),
  );
  // v0.3 sessions were not origin-bound. Never migrate them onto an unknown server.
  await SecureStore.deleteItemAsync("tubepilot_session");
}
export async function clearToken() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
  await SecureStore.deleteItemAsync("tubepilot_session");
}
export async function configureApiOrigin(input: string) {
  const origin = normalizeApiOrigin(input);
  await clearToken();
  await SecureStore.setItemAsync(ORIGIN_KEY, origin);
}
export async function copyText(text: string) {
  await Clipboard.setStringAsync(text);
}
export function downloadText(
  _name: string,
  text: string,
  _type = "text/markdown",
) {
  void Share.share({ message: text });
}
