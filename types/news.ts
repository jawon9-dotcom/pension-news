export type Category = "domestic" | "overseas";
export type Sentiment = "bullish" | "neutral" | "risk";

export interface NewsItem {
  id: number;
  category: Category;
  agency: string;
  title: string;
  summary: string;
  sentiment: Sentiment;
  date: string;
  source: string;
  sourceUrl: string;
}

export interface NewsApiResponse {
  items: NewsItem[];
  count: number;
  fetchedAt: string;
  cacheSeconds: number;
}
