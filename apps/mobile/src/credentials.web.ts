export const baseUrl = "/api/v1";
export async function sessionHeaders(): Promise<Record<string, string>> {
  return {};
}
export async function saveToken(_token?: string) {}
export async function clearToken() {}
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
