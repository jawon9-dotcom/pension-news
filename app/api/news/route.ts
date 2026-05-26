import Parser from "rss-parser";
import { NextResponse } from "next/server";
import type { Category, NewsItem, Sentiment } from "@/types/news";
import { sortNewsByDateAndPriority } from "@/lib/news/sort";

export const revalidate = 3600;
export const runtime = "nodejs";

export type { NewsItem } from "@/types/news";

interface RssSource {
  category: Category;
  url: string;
  defaultAgency: string;
  defaultSource: string;
  limit?: number;
}

interface ParsedRssItem {
  title: string;
  link: string;
  pubDate?: string;
  isoDate?: string;
  content?: string;
  contentSnippet?: string;
  creator?: string;
}

const MOCK_NEWS: NewsItem[] = [
  {
    id: 101,
    category: "domestic",
    agency: "사학연금",
    title: "사학연금, 연간 기금 운용 수익률 13.5% 기록…해외 주식이 효자",
    summary:
      "사학연금공단이 지난해 자산운용 수익률 13.5%를 기록하며 자산 총액이 28조 원을 돌파했습니다. 특히 미국 빅테크 중심의 해외 주식 부문이 전체 수익률을 견인했으며, 올해는 대체투자 비중을 탄력적으로 조정할 계획입니다.",
    sentiment: "bullish",
    date: "2026.04.12",
    source: "연합인포맥스",
    sourceUrl: "https://news.einfomax.co.kr",
  },
  {
    id: 201,
    category: "overseas",
    agency: "유럽 연기금 동향",
    title:
      "네덜란드 APG 등 주요 유럽 연기금, 인플레이션 헤지 위해 헤지펀드 및 프라이빗 마켓 자산 대폭 확대",
    summary:
      "글로벌 인플레이션 고착화 우려가 지속됨에 따라 유럽 최대 연금 투자 기관들이 주식 변동성을 방어하기 위해 비상장 주식(PE) 및 사모대출(Private Credit) 비중을 늘리고 있습니다. IPE 설문조사에 따르면 조사 대상 기관의 45%가 대체자산 내 프라이빗 마켓 비중을 증대할 방침입니다.",
    sentiment: "neutral",
    date: "2026.05.24",
    source: "Investment & Pensions Europe (IPE)",
    sourceUrl: "https://www.ipe.com",
  },
  {
    id: 202,
    category: "overseas",
    agency: "뉴질랜드 NZ Super",
    title:
      "NZ Super Fund, 글로벌 기후테크 및 신재생에너지 인프라에 8억 달러 장기 확약",
    summary:
      "자산 배분의 선구자로 불리는 뉴질랜드 국부펀드(NZ Super Fund)가 기후 변화 대응 전략의 일환으로 북미 및 유럽의 대규모 테라와트급 신재생에너지 인프라 펀드에 투자를 단행했습니다. 장기적 관점에서 규제 리스크를 방어하고 안정적인 실물자산 수익을 추구한다는 방침입니다.",
    sentiment: "bullish",
    date: "2026.05.26",
    source: "The Economist",
    sourceUrl: "https://www.economist.com",
  },
];

const DOMESTIC_SOURCE_WHITELIST = [
  "연합인포맥스",
  "infomax",
  "einfomax",
  "이데일리",
  "edaily",
  "서울경제",
  "sedaily",
  "한국경제",
  "hankyung",
  "hankookilbo",
  "매일경제",
  "mk.co.kr",
  "maeil",
  "비즈니스워치",
  "businesswatch",
  "인베스트조선",
  "investchosun",
  "국민연금공단",
  "nps.or.kr",
  "공무원연금",
  "geps.or.kr",
  "사학연금",
  "teachers.or.kr",
  "군인연금",
  "mpm.go.kr",
  "교직원공제회",
  "keis.or.kr",
  "행정공제회",
  "geps",
  "한국투자공사",
  "kic.kr",
];

const DOMESTIC_PENSION_KEYWORDS = [
  "국민연금",
  "국민연금공단",
  "공무원연금",
  "사학연금",
  "군인연금",
  "교직원공제회",
  "행정공제회",
  "한국투자공사",
  "kic",
  "연기금",
  "공적연금",
  "퇴직연금",
  "기금",
];

const DOMESTIC_ASSET_MANAGER_KEYWORDS = [
  "삼성자산운용",
  "미래에셋",
  "미래에셋자산운용",
  "kb자산운용",
  "kb am",
  "한국투자신탁운용",
  "한국투자운용",
  "한화자산운용",
  "신한자산운용",
  "nh-amundi",
  "nh아문디",
  "키움투자자산운용",
  "db자산운용",
  "우리자산운용",
  "흥국자산운용",
  "bnk자산운용",
  "ibk운용",
  "자산운용사",
  "운용사",
];

const DOMESTIC_TOPIC_KEYWORDS = [
  "자산운용",
  "자산배분",
  "위탁운용",
  "위탁운용사",
  "기금 운용",
  "운용수익",
  "운용성과",
  "운용역",
  "대체투자",
  "펀드",
  "수탁",
  "자금 집행",
  "글로벌 자산배분",
  "운용",
  "배분",
  "aum",
  "수익률",
  "포트폴리오",
];

const OVERSEAS_SOURCE_WHITELIST = [
  "wall street journal",
  "wsj",
  "wsj.com",
  "financial times",
  "ft.com",
  "the economist",
  "economist.com",
  "bloomberg",
  "bloomberg.com",
  "reuters",
  "reuters.com",
  "investment & pensions europe",
  "ipe.com",
  "ipe ",
  "top1000funds",
  "top1000funds.com",
  "pensions age",
  "pensionsage",
  "european pensions",
  "risk.net",
];

const OVERSEAS_MEGA_FUND_KEYWORDS = [
  "calpers",
  "california public employees",
  "gpfg",
  "government pension fund global",
  "gpif",
  "government pension investment fund",
  "gic",
  "temasek",
  "cppib",
  "canada pension plan investment board",
  "canada pension plan",
  "future fund",
  "nz super",
  "new zealand super fund",
  "blackrock",
  "bridgewater",
  "dalio",
  "ray dalio",
  "sovereign wealth fund",
  "sovereign wealth",
  "public pension",
  "state pension",
  "pension fund",
  "endowment fund",
  "institutional investor",
];

const OVERSEAS_TOPIC_KEYWORDS = [
  "asset allocation",
  "asset management",
  "alternative investment",
  "alternative asset",
  "total portfolio approach",
  "total portfolio",
  "risk management",
  "external fund",
  "external manager",
  "fund manager selection",
  "outsourcing",
  "liability-driven",
  "ldi",
  "fund flow",
  "portfolio",
  "investment strategy",
  "investment decision",
  "private equity",
  "private credit",
  "infrastructure",
  "rebalancing",
  "capital allocation",
  "fund manager",
  "asset manager",
  "allocates",
  "allocation shift",
  "portfolio shift",
  "commits",
  "mandate",
  "commitment",
  "deploy",
  "invests",
  "investment",
  "hedge",
  "derivatives overlay",
  "운용",
  "배분",
  "투자",
  "자금",
  "펀드",
  "allocation",
];

const OVERSEAS_INSTITUTIONAL_CONTEXT = [
  "pension",
  "fund",
  "institutional",
  "sovereign",
  "endowment",
  "asset owner",
  "allocator",
  "portfolio",
  "public pension",
  "retirement",
  "calpers",
  "gpif",
  "gpfg",
  "cppib",
];

const BULLISH_KEYWORDS = [
  "최고",
  "역대",
  "상승",
  "흑자",
  "수익",
  "호조",
  "강세",
  "증가",
  "돌파",
  "개선",
  "호실적",
  "견고",
  "확대",
  "record",
  "gain",
  "profit",
  "rise",
  "surge",
  "rally",
  "outperform",
  "strong",
  "expand",
];

const RISK_KEYWORDS = [
  "우려",
  "손실",
  "적자",
  "하락",
  "리스크",
  "위험",
  "부진",
  "감소",
  "축소",
  "concern",
  "loss",
  "deficit",
  "decline",
  "drop",
  "risk",
  "underperform",
  "weak",
  "slump",
  "cut",
];

const RSS_SOURCES: RssSource[] = [
  {
    category: "domestic",
    url: "https://www.nps.or.kr/jsppage/app/news/rss/rss_242.jsp?cmsId=press_kit",
    defaultAgency: "국민연금 (NPS)",
    defaultSource: "국민연금공단 보도자료",
    limit: 15,
  },
  {
    category: "domestic",
    url: "https://news.google.com/rss/search?q=%EA%B5%AD%EB%AF%BC%EC%97%B0%EA%B8%88+(%EC%9A%B4%EC%9A%A9+OR+%EC%88%98%EC%9D%B5+OR+%EA%B8%B0%EA%B8%88)+when:90d&hl=ko&gl=KR&ceid=KR:ko",
    defaultAgency: "국민연금 (NPS)",
    defaultSource: "Google News",
    limit: 8,
  },
  {
    category: "domestic",
    url: "https://news.google.com/rss/search?q=%EA%B3%B5%EB%AC%B4%EC%9B%90%EC%97%B0%EA%B8%88+(%EC%9A%B4%EC%9A%A9+OR+%EC%88%98%EC%9D%B5+OR+%EA%B8%B0%EA%B8%88)+when:90d&hl=ko&gl=KR&ceid=KR:ko",
    defaultAgency: "공무원연금 (GEPS)",
    defaultSource: "Google News",
    limit: 10,
  },
  {
    category: "domestic",
    url: "https://news.google.com/rss/search?q=%EC%82%AC%ED%95%99%EC%97%B0%EA%B8%88+(%EC%9A%B4%EC%9A%A9+OR+%EC%88%98%EC%9D%B5+OR+%EA%B8%B0%EA%B8%88)+when:90d&hl=ko&gl=KR&ceid=KR:ko",
    defaultAgency: "사학연금",
    defaultSource: "Google News",
    limit: 10,
  },
  {
    category: "domestic",
    url: "https://news.google.com/rss/search?q=(%EA%B5%B0%EC%9D%B8%EC%97%B0%EA%B8%88+OR+%EA%B5%90%EC%A7%81%EC%9B%90%EA%B3%B5%EC%A0%9C%ED%9A%8C+OR+%ED%96%89%EC%A0%95%EA%B3%B5%EC%A0%9C%ED%9A%8C)+when:90d&hl=ko&gl=KR&ceid=KR:ko",
    defaultAgency: "공적연금·공제회",
    defaultSource: "Google News",
    limit: 10,
  },
  {
    category: "domestic",
    url: "https://news.google.com/rss/search?q=%ED%95%9C%EA%B5%AD%ED%88%AC%EC%9E%90%EA%B3%B5%EC%82%AC+OR+KIC+(%EC%9A%B4%EC%9A%A9+OR+%ED%88%AC%EC%9E%90)+when:90d&hl=ko&gl=KR&ceid=KR:ko",
    defaultAgency: "한국투자공사 (KIC)",
    defaultSource: "Google News",
    limit: 10,
  },
  {
    category: "domestic",
    url: "https://news.google.com/rss/search?q=(%EC%82%BC%EC%84%B1%EC%9E%90%EC%82%B0%EC%9A%B4%EC%9A%A9+OR+%EB%AF%B8%EB%9E%98%EC%97%90%EC%85%8B%EC%9E%90%EC%82%B0%EC%9A%B4%EC%9A%A9)+(%EC%9A%B4%EC%9A%A9+OR+%EC%88%98%EC%9D%B5)+when:90d&hl=ko&gl=KR&ceid=KR:ko",
    defaultAgency: "삼성·미래에셋자산운용",
    defaultSource: "Google News",
    limit: 10,
  },
  {
    category: "domestic",
    url: "https://news.google.com/rss/search?q=(KB%EC%9E%90%EC%82%B0%EC%9A%B4%EC%9A%A9+OR+%ED%95%9C%EA%B5%AD%ED%88%AC%EC%9E%90%EC%8B%A0%ED%83%81%EC%9A%B4%EC%9A%A9+OR+%ED%95%9C%ED%99%94%EC%9E%90%EC%82%B0%EC%9A%B4%EC%9A%A9)+when:90d&hl=ko&gl=KR&ceid=KR:ko",
    defaultAgency: "KB·한국투자·한화자산운용",
    defaultSource: "Google News",
    limit: 10,
  },
  {
    category: "domestic",
    url: "https://news.google.com/rss/search?q=(%EC%8B%A0%ED%95%9C%EC%9E%90%EC%82%B0%EC%9A%B4%EC%9A%A9+OR+%EC%9A%B0%EB%A6%AC%EC%9E%90%EC%82%B0%EC%9A%B4%EC%9A%A9+OR+DB%EC%9E%90%EC%82%B0%EC%9A%B4%EC%9A%A9)+when:90d&hl=ko&gl=KR&ceid=KR:ko",
    defaultAgency: "신한·우리·DB자산운용",
    defaultSource: "Google News",
    limit: 10,
  },
  {
    category: "domestic",
    url: "https://news.google.com/rss/search?q=(%EC%97%B0%EA%B8%B0%EA%B8%88+OR+%EC%9C%84%ED%83%81%EC%9A%B4%EC%9A%A9+OR+%EC%9E%90%EC%82%B0%EB%B0%B0%EB%B6%84)+(%EC%9A%B4%EC%9A%A9+OR+%EA%B8%B0%EA%B8%88)+when:90d&hl=ko&gl=KR&ceid=KR:ko",
    defaultAgency: "국내 기관투자자",
    defaultSource: "Google News",
    limit: 12,
  },
  {
    category: "domestic",
    url: "https://news.google.com/rss/search?q=site:news.einfomax.co.kr+(%EC%97%B0%EA%B8%B0%EA%B8%88+OR+%EC%9E%90%EC%82%B0%EC%9A%B4%EC%9A%A9)+when:90d&hl=ko&gl=KR&ceid=KR:ko",
    defaultAgency: "국내 연기금·운용사",
    defaultSource: "Google News",
    limit: 10,
  },
  {
    category: "domestic",
    url: "https://news.google.com/rss/search?q=site:edaily.co.kr+(%EC%97%B0%EA%B8%B0%EA%B8%88+OR+%EC%9E%90%EC%82%B0%EC%9A%B4%EC%9A%A9)+when:90d&hl=ko&gl=KR&ceid=KR:ko",
    defaultAgency: "국내 연기금·운용사",
    defaultSource: "Google News",
    limit: 10,
  },
  {
    category: "overseas",
    url: "https://news.google.com/rss/search?q=CalPERS+(asset+allocation+OR+investment+OR+portfolio+OR+mandate)+when:90d&hl=en&gl=US&ceid=US:en",
    defaultAgency: "CalPERS (미국)",
    defaultSource: "Google News",
    limit: 12,
  },
  {
    category: "overseas",
    url: "https://news.google.com/rss/search?q=CPPIB+OR+%22Canada+Pension+Plan+Investment+Board%22+when:90d&hl=en&gl=US&ceid=US:en",
    defaultAgency: "CPPIB (캐나다)",
    defaultSource: "Google News",
    limit: 10,
  },
  {
    category: "overseas",
    url: "https://news.google.com/rss/search?q=Temasek+OR+GIC+Singapore+investment+when:90d&hl=en&gl=US&ceid=US:en",
    defaultAgency: "Temasek / GIC (싱가포르)",
    defaultSource: "Google News",
    limit: 10,
  },
  {
    category: "overseas",
    url: "https://news.google.com/rss/search?q=%22Future+Fund%22+Australia+OR+%22NZ+Super+Fund%22+when:90d&hl=en&gl=US&ceid=US:en",
    defaultAgency: "Future Fund / NZ Super",
    defaultSource: "Google News",
    limit: 10,
  },
  {
    category: "overseas",
    url: "https://news.google.com/rss/search?q=GPFG+when:90d&hl=en&gl=US&ceid=US:en",
    defaultAgency: "노르웨이 국부펀드 (GPFG)",
    defaultSource: "Google News",
    limit: 8,
  },
  {
    category: "overseas",
    url: "https://news.google.com/rss/search?q=GPIF+when:90d&hl=en&gl=US&ceid=US:en",
    defaultAgency: "일본 공적연금 (GPIF)",
    defaultSource: "Google News",
    limit: 8,
  },
  {
    category: "overseas",
    url: "https://news.google.com/rss/search?q=%22asset+allocation%22+(pension+fund+OR+sovereign+wealth+OR+public+pension)+when:90d&hl=en&gl=US&ceid=US:en",
    defaultAgency: "글로벌 자산배분",
    defaultSource: "Google News",
    limit: 15,
  },
  {
    category: "overseas",
    url: "https://news.google.com/rss/search?q=%22alternative+investment%22+(pension+fund+OR+sovereign+wealth+OR+institutional+investor)+when:90d&hl=en&gl=US&ceid=US:en",
    defaultAgency: "글로벌 대체투자",
    defaultSource: "Google News",
    limit: 15,
  },
  {
    category: "overseas",
    url: "https://news.google.com/rss/search?q=%22total+portfolio+approach%22+(pension+fund+OR+asset+owner+OR+institutional+investor)+when:90d&hl=en&gl=US&ceid=US:en",
    defaultAgency: "TPA·포트폴리오",
    defaultSource: "Google News",
    limit: 12,
  },
  {
    category: "overseas",
    url: "https://news.google.com/rss/search?q=%22risk+management%22+(pension+fund+OR+institutional+investor+OR+sovereign+wealth)+when:90d&hl=en&gl=US&ceid=US:en",
    defaultAgency: "리스크·운용",
    defaultSource: "Google News",
    limit: 12,
  },
  {
    category: "overseas",
    url: "https://news.google.com/rss/search?q=(%22external+fund%22+OR+%22external+manager%22+OR+%22fund+manager+selection%22)+pension+fund+when:90d&hl=en&gl=US&ceid=US:en",
    defaultAgency: "외부펀드·위탁",
    defaultSource: "Google News",
    limit: 12,
  },
  {
    category: "overseas",
    url: "https://news.google.com/rss/search?q=(asset+management+OR+portfolio+rebalancing+OR+liability-driven)+pension+fund+when:90d&hl=en&gl=US&ceid=US:en",
    defaultAgency: "글로벌 기관투자자",
    defaultSource: "Google News",
    limit: 15,
  },
  {
    category: "overseas",
    url: "https://news.google.com/rss/search?q=site:risk.net+(pension+fund+OR+asset+allocation+OR+risk+management)+when:90d&hl=en&gl=US&ceid=US:en",
    defaultAgency: "리스크·운용",
    defaultSource: "Risk.net",
    limit: 10,
  },
  {
    category: "overseas",
    url: "https://news.google.com/rss/search?q=site:ipe.com+(asset+allocation+OR+alternative+investment+OR+total+portfolio)+when:90d&hl=en&gl=US&ceid=US:en",
    defaultAgency: "글로벌 자산배분",
    defaultSource: "IPE",
    limit: 12,
  },
  {
    category: "overseas",
    url: "https://news.google.com/rss/search?q=site:ft.com+OR+site:wsj.com+OR+site:bloomberg.com+OR+site:reuters.com+(asset+allocation+OR+alternative+investment+OR+risk+management)+pension+when:90d&hl=en&gl=US&ceid=US:en",
    defaultAgency: "글로벌 연기금",
    defaultSource: "Google News",
    limit: 15,
  },
  {
    category: "overseas",
    url: "https://news.google.com/rss/search?q=site:top1000funds.com+OR+site:pensionsage.com+(asset+allocation+OR+alternative+investment)+when:90d&hl=en&gl=US&ceid=US:en",
    defaultAgency: "글로벌 대체투자",
    defaultSource: "Pension Media",
    limit: 12,
  },
];

const parser = new Parser({
  timeout: 12_000,
  headers: {
    "User-Agent":
      "PensionNewsDashboard/1.0 (+https://github.com/pension-news; institutional RSS aggregator)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
});

function stripHtml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value: string): string {
  return stripHtml(value).toLowerCase();
}

function containsKeyword(text: string, keywords: string[]): boolean {
  const normalized = normalizeText(text);
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function isWhitelistedSource(source: string, whitelist: string[]): boolean {
  const normalizedSource = normalizeText(source);
  return whitelist.some((entry) => normalizedSource.includes(entry.toLowerCase()));
}

function isWhitelistedDomesticSource(source: string, sourceUrl: string): boolean {
  return (
    isWhitelistedSource(source, DOMESTIC_SOURCE_WHITELIST) ||
    isWhitelistedSource(sourceUrl, DOMESTIC_SOURCE_WHITELIST)
  );
}

function isWhitelistedOverseasSource(source: string, sourceUrl: string): boolean {
  return (
    isWhitelistedSource(source, OVERSEAS_SOURCE_WHITELIST) ||
    isWhitelistedSource(sourceUrl, OVERSEAS_SOURCE_WHITELIST)
  );
}

function hasDomesticPensionSignal(title: string, summary: string): boolean {
  return containsKeyword(`${title} ${summary}`, DOMESTIC_PENSION_KEYWORDS);
}

function hasDomesticAssetManagerSignal(title: string, summary: string): boolean {
  return containsKeyword(`${title} ${summary}`, DOMESTIC_ASSET_MANAGER_KEYWORDS);
}

function hasDomesticTopicSignal(title: string, summary: string): boolean {
  return containsKeyword(`${title} ${summary}`, DOMESTIC_TOPIC_KEYWORDS);
}

function hasDomesticTrustedAgency(title: string, summary: string): boolean {
  return (
    hasDomesticPensionSignal(title, summary) ||
    hasDomesticAssetManagerSignal(title, summary)
  );
}

function passesDomesticFilter(item: Pick<NewsItem, "title" | "summary" | "source" | "sourceUrl">): boolean {
  const whitelistedSource = isWhitelistedDomesticSource(item.source, item.sourceUrl);
  const pensionSignal = hasDomesticPensionSignal(item.title, item.summary);
  const assetManagerSignal = hasDomesticAssetManagerSignal(item.title, item.summary);
  const topicSignal = hasDomesticTopicSignal(item.title, item.summary);
  const titlePensionSignal = hasDomesticPensionSignal(item.title, "");
  const titleAssetManagerSignal = hasDomesticAssetManagerSignal(item.title, "");

  if (
    whitelistedSource &&
    (pensionSignal ||
      assetManagerSignal ||
      topicSignal ||
      titlePensionSignal ||
      titleAssetManagerSignal)
  ) {
    return true;
  }

  if (titlePensionSignal || titleAssetManagerSignal) {
    return true;
  }

  if (pensionSignal && topicSignal) {
    return true;
  }

  if (assetManagerSignal && topicSignal) {
    return true;
  }

  return hasDomesticTrustedAgency(item.title, item.summary);
}

function hasOverseasMegaFundSignal(title: string, summary: string): boolean {
  return containsKeyword(`${title} ${summary}`, OVERSEAS_MEGA_FUND_KEYWORDS);
}

function hasOverseasTopicSignal(title: string, summary: string): boolean {
  return containsKeyword(`${title} ${summary}`, OVERSEAS_TOPIC_KEYWORDS);
}

function passesOverseasFilter(item: Pick<NewsItem, "title" | "summary" | "source" | "sourceUrl">): boolean {
  const text = `${item.title} ${item.summary}`;
  const whitelistedSource = isWhitelistedOverseasSource(item.source, item.sourceUrl);
  const megaFundSignal = hasOverseasMegaFundSignal(item.title, item.summary);
  const topicSignal = hasOverseasTopicSignal(item.title, item.summary);
  const titleFundSignal = hasOverseasMegaFundSignal(item.title, "");
  const titleTopicSignal = hasOverseasTopicSignal(item.title, "");

  if (
    whitelistedSource &&
    (megaFundSignal || topicSignal || titleFundSignal || titleTopicSignal)
  ) {
    return true;
  }

  if (titleFundSignal) {
    return true;
  }

  if (topicSignal && containsKeyword(text, OVERSEAS_INSTITUTIONAL_CONTEXT)) {
    return true;
  }

  if (
    titleTopicSignal &&
    containsKeyword(text, [
      ...OVERSEAS_INSTITUTIONAL_CONTEXT,
      "investor",
      "portfolio",
      "asset",
      "manager",
    ])
  ) {
    return true;
  }

  return megaFundSignal && topicSignal;
}

function isGoogleNewsFeed(sourceConfig: RssSource): boolean {
  return sourceConfig.url.includes("news.google.com");
}

function passesCategoryFilter(item: NewsItem): boolean {
  if (item.category === "domestic") {
    return passesDomesticFilter(item);
  }

  return passesOverseasFilter(item);
}

function hashToId(input: string): number {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function formatDate(input?: string): string {
  const date = input ? new Date(input) : new Date();

  if (Number.isNaN(date.getTime())) {
    const today = new Date();
    return `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;
  }

  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function extractSummary(text: string, sentenceCount = 3): string {
  const cleaned = stripHtml(text);

  if (!cleaned) {
    return "요약 정보가 제공되지 않았습니다.";
  }

  const sentences = cleaned
    .split(/(?<=[.!?。])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length === 0) {
    return cleaned.slice(0, 180);
  }

  return sentences.slice(0, sentenceCount).join(" ");
}

function classifySentiment(title: string, summary: string): Sentiment {
  const text = `${title} ${summary}`.toLowerCase();

  const bullishScore = BULLISH_KEYWORDS.reduce(
    (score, keyword) => score + (text.includes(keyword.toLowerCase()) ? 1 : 0),
    0,
  );
  const riskScore = RISK_KEYWORDS.reduce(
    (score, keyword) => score + (text.includes(keyword.toLowerCase()) ? 1 : 0),
    0,
  );

  if (bullishScore > riskScore && bullishScore > 0) return "bullish";
  if (riskScore > bullishScore && riskScore > 0) return "risk";
  return "neutral";
}

function resolveAgency(
  title: string,
  summary: string,
  category: Category,
  fallbackAgency: string,
): string {
  const text = `${title} ${summary}`;

  if (/CalPERS|California Public Employees/i.test(text)) return "CalPERS (미국)";
  if (/GPFG|Norway Government Pension|Norwegian sovereign wealth/i.test(text)) {
    return "노르웨이 국부펀드 (GPFG)";
  }
  if (/GPIF|Government Pension Investment Fund|日本公的年金/i.test(text)) {
    return "일본 공적연금 (GPIF)";
  }
  if (/\bGIC\b|Singapore sovereign wealth/i.test(text)) return "GIC (싱가포르)";
  if (/Temasek|테마섹/i.test(text)) return "Temasek (싱가포르)";
  if (/CPPIB|Canada Pension Plan Investment Board/i.test(text)) return "CPPIB (캐나다)";
  if (/Future Fund|호주 국부펀드/i.test(text)) return "Future Fund (호주)";
  if (/NZ Super|New Zealand Super Fund/i.test(text)) return "NZ Super Fund (뉴질랜드)";
  if (/BlackRock|블랙록/i.test(text)) return "BlackRock";
  if (/Bridgewater|달리오|Dalio/i.test(text)) return "Bridgewater";
  if (/total portfolio approach|\btpa\b/i.test(text)) return "TPA·포트폴리오";
  if (/alternative investment|private equity|private credit/i.test(text)) {
    return "글로벌 대체투자";
  }
  if (/risk management|hedge ratio|ldi/i.test(text)) return "리스크·운용";
  if (/external fund|external manager|outsourc/i.test(text)) return "외부펀드·위탁";
  if (/asset allocation|portfolio approach|rebalancing/i.test(text)) {
    return "글로벌 자산배분";
  }
  if (/\bAPG\b|유럽 연기금/i.test(text)) return "유럽 연기금 동향";
  if (/국민연금|\bNPS\b/i.test(text)) return "국민연금 (NPS)";
  if (/공무원연금|\bGEPS\b/i.test(text)) return "공무원연금 (GEPS)";
  if (/사학연금/i.test(text)) return "사학연금";
  if (/군인연금/i.test(text)) return "군인연금";
  if (/교직원공제회/i.test(text)) return "교직원공제회";
  if (/행정공제회/i.test(text)) return "행정공제회";
  if (/한국투자공사|\bKIC\b/i.test(text)) return "한국투자공사 (KIC)";
  if (/삼성자산운용/i.test(text)) return "삼성자산운용";
  if (/미래에셋/i.test(text)) return "미래에셋자산운용";
  if (/KB자산운용|KB AM/i.test(text)) return "KB자산운용";
  if (/한국투자신탁운용|한국투자운용/i.test(text)) return "한국투자신탁운용";
  if (/한화자산운용/i.test(text)) return "한화자산운용";
  if (/신한자산운용/i.test(text)) return "신한자산운용";
  if (/NH-Amundi|NH아문디/i.test(text)) return "NH-Amundi";
  if (/DB자산운용/i.test(text)) return "DB자산운용";
  if (/우리자산운용/i.test(text)) return "우리자산운용";
  if (/키움투자자산운용/i.test(text)) return "키움투자자산운용";

  const genericFallbacks = [
    "국내 연기금",
    "국내 기관투자자",
    "국내 연기금·운용사",
    "삼성·미래에셋자산운용",
    "KB·한국투자·한화자산운용",
    "신한·우리·DB자산운용",
    "공적연금·공제회",
    "글로벌 연기금",
    "글로벌 기관투자자",
    "글로벌 자산배분",
    "글로벌 대체투자",
    "TPA·포트폴리오",
    "리스크·운용",
    "외부펀드·위탁",
  ];

  if (fallbackAgency && !genericFallbacks.includes(fallbackAgency)) {
    return fallbackAgency;
  }

  return fallbackAgency || (category === "domestic" ? "국내 연기금" : "글로벌 연기금");
}

function parseGoogleNewsTitle(rawTitle: string): { title: string; source: string } {
  const separatorIndex = rawTitle.lastIndexOf(" - ");

  if (separatorIndex === -1) {
    return { title: rawTitle.trim(), source: "Google News" };
  }

  return {
    title: rawTitle.slice(0, separatorIndex).trim(),
    source: rawTitle.slice(separatorIndex + 3).trim(),
  };
}

function normalizeRssItem(
  item: ParsedRssItem,
  sourceConfig: RssSource,
): NewsItem | null {
  if (!item.title || !item.link) return null;

  const rawTitle = stripHtml(item.title);
  const parsedTitle = isGoogleNewsFeed(sourceConfig)
    ? parseGoogleNewsTitle(rawTitle)
    : rawTitle.includes(" - ")
      ? parseGoogleNewsTitle(rawTitle)
      : { title: rawTitle, source: sourceConfig.defaultSource };

  const body = stripHtml(item.contentSnippet || item.content || parsedTitle.title);
  const summary = extractSummary(body || parsedTitle.title);
  const source =
    stripHtml(item.creator || "") ||
    parsedTitle.source ||
    sourceConfig.defaultSource;

  const draft: NewsItem = {
    id: hashToId(item.link),
    category: sourceConfig.category,
    agency: resolveAgency(
      parsedTitle.title,
      summary,
      sourceConfig.category,
      sourceConfig.defaultAgency,
    ),
    title: parsedTitle.title,
    summary,
    sentiment: classifySentiment(parsedTitle.title, summary),
    date: formatDate(item.isoDate || item.pubDate),
    source,
    sourceUrl: item.link,
  };

  return passesCategoryFilter(draft) ? draft : null;
}

async function fetchFeed(sourceConfig: RssSource): Promise<NewsItem[]> {
  const feed = await parser.parseURL(sourceConfig.url);
  const items = (feed.items ?? []).slice(0, sourceConfig.limit ?? 10);

  return items
    .map((item) => normalizeRssItem(item as ParsedRssItem, sourceConfig))
    .filter((item): item is NewsItem => item !== null);
}

function sortNewsByDate(items: NewsItem[]): NewsItem[] {
  return sortNewsByDateAndPriority(items);
}

function dedupeAndSort(items: NewsItem[]): NewsItem[] {
  const uniqueItems = new Map<number, NewsItem>();

  for (const item of items) {
    uniqueItems.set(item.id, item);
  }

  return sortNewsByDate([...uniqueItems.values()]);
}

function normalizeTitleKey(title: string): string {
  return stripHtml(title)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "")
    .trim();
}

function getTitleNGrams(title: string, size = 2): Set<string> {
  const normalized = normalizeTitleKey(title);
  const grams = new Set<string>();

  if (normalized.length < size) {
    if (normalized) grams.add(normalized);
    return grams;
  }

  for (let index = 0; index <= normalized.length - size; index += 1) {
    grams.add(normalized.slice(index, index + size));
  }

  return grams;
}

function titleSimilarity(leftTitle: string, rightTitle: string): number {
  const leftKey = normalizeTitleKey(leftTitle);
  const rightKey = normalizeTitleKey(rightTitle);

  if (!leftKey || !rightKey) return 0;
  if (leftKey === rightKey) return 1;

  const shorter = leftKey.length < rightKey.length ? leftKey : rightKey;
  const longer = leftKey.length < rightKey.length ? rightKey : leftKey;

  if (longer.includes(shorter) && shorter.length / longer.length >= 0.95) {
    return 0.96;
  }

  const leftGrams = getTitleNGrams(leftTitle);
  const rightGrams = getTitleNGrams(rightTitle);
  let intersection = 0;

  for (const gram of leftGrams) {
    if (rightGrams.has(gram)) intersection += 1;
  }

  const union = leftGrams.size + rightGrams.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function isSimilarNews(left: NewsItem, right: NewsItem): boolean {
  if (left.category !== right.category) return false;

  const leftTitleKey = normalizeTitleKey(left.title);
  const rightTitleKey = normalizeTitleKey(right.title);

  if (leftTitleKey && leftTitleKey === rightTitleKey) return true;

  if (titleSimilarity(left.title, right.title) >= 0.88) return true;

  const leftSummaryKey = normalizeTitleKey(left.summary).slice(0, 100);
  const rightSummaryKey = normalizeTitleKey(right.summary).slice(0, 100);

  if (
    leftSummaryKey.length >= 60 &&
    rightSummaryKey.length >= 60 &&
    leftSummaryKey === rightSummaryKey
  ) {
    return true;
  }

  return false;
}

function getSourcePriority(item: NewsItem): number {
  let score = 0;

  if (item.category === "domestic") {
    if (isWhitelistedDomesticSource(item.source, item.sourceUrl)) score += 12;
    if (/nps\.or\.kr|geps\.or\.kr|teachers\.or\.kr|kic\.kr/i.test(item.sourceUrl)) {
      score += 18;
    }
  } else if (isWhitelistedOverseasSource(item.source, item.sourceUrl)) {
    score += 12;
  }

  if (!/news\.google\.com/i.test(item.sourceUrl)) score += 4;
  score += Math.min(item.summary.length / 60, 6);

  return score;
}

function dedupeSimilarNews(items: NewsItem[], category: Category): NewsItem[] {
  const targetItems = items.filter((item) => item.category === category);
  const otherItems = items.filter((item) => item.category !== category);

  const sortedItems = [...targetItems].sort((left, right) => {
    const dateDiff =
      new Date(right.date.replace(/\./g, "-")).getTime() -
      new Date(left.date.replace(/\./g, "-")).getTime();

    if (dateDiff !== 0) return dateDiff;
    return getSourcePriority(right) - getSourcePriority(left);
  });

  const keptItems: NewsItem[] = [];

  for (const candidate of sortedItems) {
    const isDuplicate = keptItems.some((existing) =>
      isSimilarNews(existing, candidate),
    );

    if (!isDuplicate) {
      keptItems.push(candidate);
    }
  }

  return dedupeAndSort([...otherItems, ...keptItems]);
}

function balanceOverseasItems(items: NewsItem[], maxPerAgency = 10): NewsItem[] {
  const domesticItems = items.filter((item) => item.category === "domestic");
  const overseasItems = items.filter((item) => item.category === "overseas");
  const agencyCounts = new Map<string, number>();
  const balancedOverseas: NewsItem[] = [];

  for (const item of sortNewsByDate(overseasItems)) {
    const currentCount = agencyCounts.get(item.agency) ?? 0;
    if (currentCount >= maxPerAgency) continue;

    balancedOverseas.push(item);
    agencyCounts.set(item.agency, currentCount + 1);
  }

  return sortNewsByDate([...domesticItems, ...balancedOverseas]);
}

function mergeWithMockData(liveItems: NewsItem[]): NewsItem[] {
  const merged = new Map<number, NewsItem>();

  for (const item of liveItems) {
    merged.set(item.id, item);
  }

  for (const mockItem of MOCK_NEWS) {
    merged.set(mockItem.id, mockItem);
  }

  const dedupedById = dedupeAndSort([...merged.values()]);
  const dedupedDomestic = dedupeSimilarNews(dedupedById, "domestic");
  const dedupedAll = dedupeSimilarNews(dedupedDomestic, "overseas");

  return balanceOverseasItems(dedupedAll);
}

export async function GET() {
  const settledResults = await Promise.allSettled(
    RSS_SOURCES.map((source) => fetchFeed(source)),
  );

  const liveItems: NewsItem[] = [];
  const sourceErrors: string[] = [];

  settledResults.forEach((result, index) => {
    if (result.status === "fulfilled") {
      liveItems.push(...result.value);
      return;
    }

    const reason =
      result.reason instanceof Error ? result.reason.message : String(result.reason);
    sourceErrors.push(`${RSS_SOURCES[index].url}: ${reason}`);
  });

  const items = mergeWithMockData(liveItems);
  const domesticCount = items.filter((item) => item.category === "domestic").length;
  const overseasCount = items.filter((item) => item.category === "overseas").length;

  return NextResponse.json(
    {
      items,
      count: items.length,
      fetchedAt: new Date().toISOString(),
      cacheSeconds: revalidate,
      meta: {
        liveCount: liveItems.length,
        mockCount: MOCK_NEWS.length,
        domesticCount,
        overseasCount,
        filtered: true,
        deduplicated: true,
      },
      ...(sourceErrors.length > 0 ? { partialErrors: sourceErrors } : {}),
    },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${revalidate}, stale-while-revalidate=600`,
      },
    },
  );
}
