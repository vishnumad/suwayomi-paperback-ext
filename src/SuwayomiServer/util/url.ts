export function formatURL(url: string): string {
  if (url.endsWith("/")) {
    url = url.slice(0, -1);
  }
  return url;
}
