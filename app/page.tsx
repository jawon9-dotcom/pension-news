import { headers } from "next/headers";
import PensionNewsDashboard from "@/components/PensionNewsDashboard";
import type { NewsApiResponse, NewsItem } from "@/types/news";

async function fetchInitialNews(): Promise<NewsItem[]> {
  try {
    const headersList = await headers();
    const host = headersList.get("host") ?? "localhost:3000";
    const protocol = process.env.NODE_ENV === "development" ? "http" : "https";

    const response = await fetch(`${protocol}://${host}/api/news`, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as NewsApiResponse;
    return data.items ?? [];
  } catch {
    return [];
  }
}

export default async function Home() {
  const initialNews = await fetchInitialNews();

  return <PensionNewsDashboard initialNews={initialNews} />;
}
