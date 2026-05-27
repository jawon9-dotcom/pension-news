"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Category, NewsApiResponse, NewsItem, Sentiment } from "@/types/news";
import { compareNewsByDateAndPriority } from "@/lib/news/sort";

type SegmentTab = Category | "bookmarked";

interface PensionNewsDashboardProps {
  initialNews: NewsItem[];
}

interface SourceModalState {
  source: string;
  sourceUrl: string;
  title: string;
}

const BOOKMARK_STORAGE_KEY = "pension-news-bookmarks";
const VISITOR_SESSION_KEY = "pension-news-visitor-recorded";

const SEGMENT_TABS: { value: SegmentTab; label: string }[] = [
  { value: "domestic", label: "국내 연기금" },
  { value: "overseas", label: "해외 연기금" },
  { value: "bookmarked", label: "내가 찜한 뉴스" },
];

const SENTIMENT_CONFIG: Record<
  Sentiment,
  { label: string; className: string }
> = {
  bullish: {
    label: "호재",
    className: "bg-red-50 text-red-500",
  },
  risk: {
    label: "리스크",
    className: "bg-orange-50 text-orange-500",
  },
  neutral: {
    label: "중립",
    className: "bg-gray-100 text-gray-500",
  },
};

function loadBookmarkedIds(): number[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(BOOKMARK_STORAGE_KEY);
    if (!stored) return [];

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((id): id is number => typeof id === "number");
  } catch {
    return [];
  }
}

function SearchIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0 text-gray-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
      />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 17L17 7M7 7h10v10"
      />
    </svg>
  );
}

function VerifiedIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0 text-blue-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.75}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z"
      />
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      className={`h-4 w-4 transition-transform duration-300 ${spinning ? "animate-spin" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

function ScrollTopIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 15l7-7 7 7" />
    </svg>
  );
}

function FolderCountIcon({ count }: { count: number }) {
  const displayCount = count > 99 ? "99+" : String(count);

  return (
    <span
      className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center leading-none"
      aria-hidden
    >
      <span className="text-[1.35rem]">📂</span>
      <span className="absolute left-1/2 top-[12px] -translate-x-1/2 text-[8px] font-bold leading-none text-amber-950 tabular-nums">
        {displayCount}
      </span>
    </span>
  );
}

function SourceModal({
  modal,
  onClose,
}: {
  modal: SourceModalState;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="모달 닫기"
        className="animate-fade-in absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-modal-title"
        className="animate-slide-up relative z-10 w-full max-w-md rounded-t-3xl bg-white px-6 pb-8 pt-6 shadow-xl sm:rounded-3xl sm:pb-6"
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-gray-200 sm:hidden" />

        <div className="mb-6 flex items-start gap-3">
          <VerifiedIcon />
          <div>
            <p
              id="source-modal-title"
              className="text-base font-semibold tracking-tight text-gray-900"
            >
              공식 출처 확인
            </p>
            <p className="mt-1.5 text-sm leading-relaxed tracking-tight text-gray-500">
              아래 매체는 해당 뉴스의 공식 출처로 검증되었습니다. 외부 사이트로
              이동하기 전 내용을 확인해 주세요.
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-2xl bg-slate-50 px-4 py-3.5">
          <p className="text-xs font-medium text-gray-400">출처</p>
          <p className="mt-1 text-sm font-semibold tracking-tight text-gray-800">
            {modal.source}
          </p>
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-gray-500">
            {modal.title}
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <a
            href={modal.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-2xl bg-blue-500 px-4 py-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-blue-600"
          >
            공식 원문 사이트로 이동하기
            <ExternalLinkIcon />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-gray-100 px-4 py-3.5 text-sm font-semibold text-gray-600 transition-colors duration-200 hover:bg-gray-200"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function NewsCard({
  item,
  isBookmarked,
  onSourceClick,
  onToggleBookmark,
}: {
  item: NewsItem;
  isBookmarked: boolean;
  onSourceClick: (modal: SourceModalState) => void;
  onToggleBookmark: (id: number) => void;
}) {
  const sentiment =
    SENTIMENT_CONFIG[item.sentiment] ?? SENTIMENT_CONFIG.neutral;

  return (
    <article className="relative rounded-3xl bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-3.5 flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold tracking-tight text-blue-500">
            {item.agency}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold tracking-tight ${sentiment.className}`}
          >
            {sentiment.label}
          </span>
        </div>

        <button
          type="button"
          aria-label={isBookmarked ? "찜 해제" : "찜하기"}
          aria-pressed={isBookmarked}
          onClick={() => onToggleBookmark(item.id)}
          className={`shrink-0 rounded-full p-1.5 transition-all duration-200 ${
            isBookmarked
              ? "scale-110 text-blue-500"
              : "text-gray-300 hover:text-gray-400"
          }`}
        >
          <BookmarkIcon filled={isBookmarked} />
        </button>
      </div>

      <h2 className="mb-2.5 pr-2 text-base font-bold leading-relaxed tracking-tight text-gray-900">
        {item.title}
      </h2>
      <p className="text-sm leading-relaxed tracking-tight text-gray-500">
        {item.summary}
      </p>

      <div className="mt-4 flex items-center justify-between border-t border-gray-50 pt-4">
        <button
          type="button"
          onClick={() =>
            onSourceClick({
              source: item.source,
              sourceUrl: item.sourceUrl,
              title: item.title,
            })
          }
          className="group flex items-center gap-1 text-xs font-medium text-gray-400 transition-colors duration-200 hover:text-blue-500"
        >
          <span>출처: {item.source}</span>
          <span className="transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-px">
            ↗
          </span>
        </button>
        <time className="text-xs text-gray-400">{item.date}</time>
      </div>
    </article>
  );
}

function BookmarkEmptyState() {
  return (
    <div className="rounded-3xl bg-white px-6 py-16 text-center shadow-sm">
      <p className="text-4xl" aria-hidden>
        📂
      </p>
      <p className="mt-4 text-sm font-semibold tracking-tight text-gray-700">
        아직 찜한 뉴스가 없어요.
      </p>
      <p className="mt-2 text-sm leading-relaxed tracking-tight text-gray-400">
        중요한 뉴스는 마크해 두세요.
      </p>
    </div>
  );
}

function CategoryEmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-3xl bg-white px-6 py-14 text-center shadow-sm">
      <p className="text-sm font-semibold tracking-tight text-gray-700">
        {label}
      </p>
      <p className="mt-2 text-sm leading-relaxed tracking-tight text-gray-400">
        잠시 후 다시 확인하거나 다른 탭을 눌러 보세요.
      </p>
    </div>
  );
}

function SearchEmptyState() {
  return (
    <div className="rounded-3xl bg-white px-6 py-14 text-center shadow-sm">
      <p className="text-sm font-semibold tracking-tight text-gray-700">
        검색 결과가 없습니다
      </p>
      <p className="mt-2 text-sm leading-relaxed tracking-tight text-gray-400">
        다른 키워드로 검색하거나 카테고리를 변경해 보세요.
      </p>
    </div>
  );
}

export default function PensionNewsDashboard({
  initialNews,
}: PensionNewsDashboardProps) {
  const [newsItems, setNewsItems] = useState<NewsItem[]>(initialNews);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SegmentTab>("domestic");
  const [bookmarkedIds, setBookmarkedIds] = useState<number[]>([]);
  const [visitorCount, setVisitorCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [sourceModal, setSourceModal] = useState<SourceModalState | null>(
    null,
  );

  useEffect(() => {
    if (initialNews.length > 0) {
      setNewsItems(initialNews);
    }
  }, [initialNews]);

  useEffect(() => {
    setBookmarkedIds(loadBookmarkedIds());
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(bookmarkedIds));
  }, [bookmarkedIds, isHydrated]);

  useEffect(() => {
    if (!isHydrated || newsItems.length === 0) return;

    const validIds = new Set(newsItems.map((item) => item.id));
    setBookmarkedIds((prev) => {
      const next = prev.filter((id) => validIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [isHydrated, newsItems]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 320);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    let cancelled = false;

    const recordVisit = async () => {
      try {
        const alreadyRecorded = sessionStorage.getItem(VISITOR_SESSION_KEY);
        const response = await fetch("/api/visitors", {
          method: alreadyRecorded ? "GET" : "POST",
          cache: "no-store",
        });

        if (cancelled || !response.ok) return;

        const data = (await response.json()) as { count?: number };
        if (typeof data.count === "number") {
          setVisitorCount(data.count);
        }

        if (!alreadyRecorded) {
          sessionStorage.setItem(VISITOR_SESSION_KEY, "1");
        }
      } catch {
        // ignore visitor tracking errors
      }
    };

    recordVisit();

    return () => {
      cancelled = true;
    };
  }, [isHydrated]);

  useEffect(() => {
    if (!isHydrated || newsItems.length > 0) return;

    let cancelled = false;

    fetch("/api/news")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: NewsApiResponse | null) => {
        if (cancelled || !data?.items?.length) return;
        setNewsItems(data.items);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isHydrated, newsItems.length]);

  const handleCloseModal = useCallback(() => setSourceModal(null), []);

  const handleToggleBookmark = useCallback((id: number) => {
    setBookmarkedIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id],
    );
  }, []);

  const handleTabChange = useCallback((tab: SegmentTab) => {
    setActiveTab(tab);
  }, []);

  const handleScrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleRefreshNews = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const response = await fetch("/api/news?refresh=1", {
        cache: "no-store",
      });

      if (!response.ok) return;

      const data = (await response.json()) as NewsApiResponse;
      if (data.items?.length) {
        setNewsItems(data.items);
      }
    } catch {
      // ignore refresh errors
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const tabNews = useMemo(() => {
    const items =
      activeTab === "bookmarked"
        ? newsItems.filter((item) => bookmarkedIds.includes(item.id))
        : newsItems.filter((item) => item.category === activeTab);

    return [...items].sort(compareNewsByDateAndPriority);
  }, [activeTab, newsItems, bookmarkedIds]);

  const filteredNews = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return tabNews;

    return tabNews.filter((item) => {
      const searchableText = [
        item.agency,
        item.title,
        item.summary,
        item.source,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [searchQuery, tabNews]);

  const bookmarkedIdSet = useMemo(
    () => new Set(bookmarkedIds),
    [bookmarkedIds],
  );

  const bookmarkedNewsCount = useMemo(
    () => newsItems.filter((item) => bookmarkedIdSet.has(item.id)).length,
    [newsItems, bookmarkedIdSet],
  );

  const showBookmarkEmptyState =
    activeTab === "bookmarked" &&
    bookmarkedNewsCount === 0 &&
    !searchQuery.trim();

  const showSearchEmptyState =
    !showBookmarkEmptyState &&
    searchQuery.trim().length > 0 &&
    filteredNews.length === 0;

  const showCategoryEmptyState =
    !showBookmarkEmptyState &&
    !showSearchEmptyState &&
    filteredNews.length === 0;

  const categoryEmptyLabel =
    activeTab === "domestic"
      ? "표시할 국내 연기금 뉴스가 없습니다."
      : activeTab === "overseas"
        ? "표시할 해외 연기금 뉴스가 없습니다."
        : "표시할 찜한 뉴스가 없습니다.";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-lg px-5 pb-16 pt-10">
        <header className="mb-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="inline-flex shrink-0 items-center rounded-xl bg-blue-500 px-3.5 py-2 text-sm font-extrabold uppercase tracking-[0.08em] text-white shadow-md shadow-blue-500/20">
                Pension News
              </span>
              {isHydrated && (
                <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-500 shadow-sm">
                  방문
                  <span className="font-bold tabular-nums text-blue-600">
                    {visitorCount.toLocaleString("ko-KR")}
                  </span>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleRefreshNews}
              disabled={isRefreshing}
              aria-label="뉴스 새로고침"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-gray-600 shadow-sm transition-all duration-200 hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
            >
              <RefreshIcon spinning={isRefreshing} />
              새로고침
            </button>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            글로벌 연기금 뉴스 대시보드
          </h1>
          <p className="mt-2 text-sm leading-relaxed tracking-tight text-gray-500">
            국내·해외 주요 연기금의 실시간 매크로 뉴스를 한곳에서 확인하세요.
          </p>
        </header>

        <div className="relative mb-5">
          <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
            <SearchIcon />
          </div>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="기관명, 제목, OCIO, Outsourced CIO 검색"
            className="w-full rounded-2xl border border-transparent bg-white py-3.5 pl-11 pr-11 text-sm tracking-tight text-gray-900 shadow-sm outline-none transition-all duration-200 placeholder:text-gray-400 focus:border-blue-100 focus:ring-2 focus:ring-blue-100"
          />
          {searchQuery.length > 0 && (
            <button
              type="button"
              aria-label="검색어 지우기"
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-3 my-auto flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors duration-200 hover:bg-gray-200 hover:text-gray-700"
            >
              <ClearIcon />
            </button>
          )}
        </div>

        <div
          role="tablist"
          aria-label="연기금 카테고리"
          className="mb-6 grid grid-cols-3 gap-1 rounded-full bg-gray-200/60 p-1"
        >
          {SEGMENT_TABS.map((tab) => {
            const isActive = activeTab === tab.value;

            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={
                  tab.value === "bookmarked"
                    ? `내가 찜한 뉴스 ${bookmarkedNewsCount}개`
                    : tab.label
                }
                onClick={() => handleTabChange(tab.value)}
                className={`flex min-w-0 items-center justify-center rounded-full px-1 py-2.5 text-center text-[11px] font-semibold leading-tight tracking-tight transition-all duration-200 sm:px-2 sm:text-xs ${
                  isActive
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.value === "bookmarked" ? (
                  <span className="inline-flex min-w-0 items-center justify-center gap-0.5 whitespace-nowrap sm:gap-1">
                    <span className="truncate">내가 찜한 뉴스</span>
                    <FolderCountIcon count={bookmarkedNewsCount} />
                  </span>
                ) : (
                  <span className="whitespace-nowrap">{tab.label}</span>
                )}
              </button>
            );
          })}
        </div>

        <div key={activeTab} className="space-y-4">
          {showBookmarkEmptyState ? (
            <BookmarkEmptyState />
          ) : showSearchEmptyState ? (
            <SearchEmptyState />
          ) : showCategoryEmptyState ? (
            <CategoryEmptyState label={categoryEmptyLabel} />
          ) : (
            filteredNews.map((item) => (
              <NewsCard
                key={`${item.category}-${item.id}-${item.sourceUrl}`}
                item={item}
                isBookmarked={bookmarkedIdSet.has(item.id)}
                onSourceClick={setSourceModal}
                onToggleBookmark={handleToggleBookmark}
              />
            ))
          )}
        </div>
      </div>

      {sourceModal && (
        <SourceModal modal={sourceModal} onClose={handleCloseModal} />
      )}

      {showScrollTop && (
        <button
          type="button"
          onClick={handleScrollToTop}
          aria-label="맨 위로 이동"
          className="fixed bottom-6 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-600"
        >
          <ScrollTopIcon />
        </button>
      )}
    </div>
  );
}
