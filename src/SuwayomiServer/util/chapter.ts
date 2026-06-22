export function parseChapterTitle(title: string) {
  return title
    .replace(/^((Chapter|Episode|Ch\.?)\s*[\d.]+|#\s*[\d.]+)\s*(\bS\d+\b)?\s*[-:]?\s*/i, "")
    .trim();
}

export function parseChapterVolume(title: string) {
  return Number(title.match(/\bS(\d+)\b/i)?.[1] ?? 0);
}
