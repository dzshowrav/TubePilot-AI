export const requestCredentials: RequestCredentials = "include";
export async function getApiOrigin(): Promise<string> {
  return window.location.origin;
}
export async function getApiBaseUrl(): Promise<string> {
  return "/api/v1";
}
export async function sessionHeaders(
  _apiBase: string,
): Promise<Record<string, string>> {
  return {};
}
export async function saveToken(_token: string, _apiBase: string) {}
export async function clearToken() {}
export async function configureApiOrigin(_input: string) {
  throw new Error("Web API routing is managed by the server.");
}
export async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}
export function downloadText(
  name: string,
  text: string,
  type = "text/markdown",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
