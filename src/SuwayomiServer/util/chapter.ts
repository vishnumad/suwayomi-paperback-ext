export function parseChapterTitle(title: string) {
  return title
    .replace(/^((Chapter|Episode|Ch\.?)\s*[\d.]+|#\s*[\d.]+)\s*(\bS\d+\b)?\s*[-:]?\s*/i, "")
    .trim();
}
