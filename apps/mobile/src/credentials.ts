import * as SecureStore from "expo-secure-store";
import * as Clipboard from "expo-clipboard";
import { Share } from "react-native";
export const baseUrl = process.env.EXPO_PUBLIC_API_URL
  ? `${process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "")}/api/v1`
  : "";
export async function sessionHeaders(): Promise<Record<string, string>> {
  const token = await SecureStore.getItemAsync("tubepilot_session");
  return {
    "x-tubepilot-client": "native",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
export async function saveToken(token?: string) {
  if (token) await SecureStore.setItemAsync("tubepilot_session", token);
}
export async function clearToken() {
  await SecureStore.deleteItemAsync("tubepilot_session");
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
