import type { NewsItem } from "@/types/news";

export function parseNewsDate(date: string): number {
  const parsed = new Date(date.replace(/\./g, "-")).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function isNationalPensionNews(item: NewsItem): boolean {
  const text = `${item.agency} ${item.title}`;
  return /국민연금|\bNPS\b/i.test(text);
}

export function compareNewsByDateAndPriority(
  left: NewsItem,
  right: NewsItem,
): number {
  const dateDiff = parseNewsDate(right.date) - parseNewsDate(left.date);
  if (dateDiff !== 0) return dateDiff;

  const leftIsNps = isNationalPensionNews(left);
  const rightIsNps = isNationalPensionNews(right);

  if (leftIsNps && !rightIsNps) return -1;
  if (!leftIsNps && rightIsNps) return 1;

  return 0;
}

export function sortNewsByDateAndPriority(items: NewsItem[]): NewsItem[] {
  return [...items].sort(compareNewsByDateAndPriority);
}
