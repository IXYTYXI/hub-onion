import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { BundleListEntry } from "./-types";
import { bundlesCopy } from "../../copy/bundles";
import { useBundles } from "../../hooks/useBundles";
import { useCategories } from "../../hooks/useCategories";
import { mapBundleItemToPublicBundle } from "../../lib/apiBundles";
import {
  parseBundleDir,
  parseBundleSort,
  toBundleListSort,
  type BundleSortDir,
  type BundleSortKey,
} from "./-params";

const pageSize = 25;

type BundlesView = "cards" | "list";

export type BundlesSearchState = {
  q?: string;
  sort?: BundleSortKey;
  dir?: BundleSortDir;
  category?: string;
  view?: BundlesView;
  focus?: "search";
};

type BundlesNavigate = (options: {
  search: (prev: BundlesSearchState) => BundlesSearchState;
  replace?: boolean;
}) => void | Promise<void>;

export function useBundlesBrowseModel({
  search,
  navigate,
  searchInputRef,
}: {
  search: BundlesSearchState;
  navigate: BundlesNavigate;
  searchInputRef: RefObject<HTMLInputElement | null>;
}) {
  const browseCopy = bundlesCopy.browse;
  const [query, setQuery] = useState(search.q ?? "");
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const loadMoreInFlightRef = useRef(false);

  const view: BundlesView = search.view ?? "list";
  const category = search.category;
  const trimmedQuery = useMemo(() => query.trim(), [query]);
  const hasQuery = trimmedQuery.length > 0;
  const sort = search.sort ?? "downloads";
  const dir = parseBundleDir(search.dir, sort);
  const listSort = toBundleListSort(sort);

  const {
    data: bundlesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingList,
  } = useBundles({
    sort: listSort,
    dir,
    limit: pageSize,
    category,
    q: hasQuery ? trimmedQuery : undefined,
  });
  const categoriesQuery = useCategories();

  useEffect(() => {
    setQuery(search.q ?? "");
  }, [search.q]);

  useEffect(() => {
    if (search.focus === "search" && searchInputRef.current) {
      searchInputRef.current.focus();
      void navigate({ search: (prev) => ({ ...prev, focus: undefined }), replace: true });
    }
  }, [navigate, search.focus, searchInputRef]);

  const sorted = useMemo<BundleListEntry[]>(() => {
    const pages = bundlesData?.pages ?? [];
    return pages
      .flatMap((page) => page.items)
      .map((bundle) => ({ bundle: mapBundleItemToPublicBundle(bundle) }));
  }, [bundlesData]);

  const canLoadMore = hasNextPage;
  const isLoadingMore = isFetchingNextPage;
  const canAutoLoad = typeof IntersectionObserver !== "undefined";

  const loadMore = useCallback(() => {
    if (loadMoreInFlightRef.current || isLoadingMore || !canLoadMore) return;
    loadMoreInFlightRef.current = true;
    void fetchNextPage();
  }, [canLoadMore, fetchNextPage, isLoadingMore]);

  useEffect(() => {
    if (!isLoadingMore) {
      loadMoreInFlightRef.current = false;
    }
  }, [isLoadingMore]);

  useEffect(() => {
    if (!canLoadMore || typeof IntersectionObserver === "undefined") return;
    const target = loadMoreRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          loadMore();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [canLoadMore, loadMore]);

  const onQueryChange = useCallback(
    (next: string) => {
      const trimmed = next.trim();
      setQuery(next);
      void navigate({
        search: (prev) => ({ ...prev, q: trimmed ? next : undefined }),
        replace: true,
      });
    },
    [navigate],
  );

  const onSortChange = useCallback(
    (value: string) => {
      const nextSort = parseBundleSort(value);
      void navigate({
        search: (prev) => ({
          ...prev,
          sort: nextSort,
          dir: parseBundleDir(prev.dir, nextSort),
        }),
        replace: true,
      });
    },
    [navigate],
  );

  const onToggleDir = useCallback(() => {
    void navigate({
      search: (prev) => ({
        ...prev,
        dir: parseBundleDir(prev.dir, sort) === "asc" ? "desc" : "asc",
      }),
      replace: true,
    });
  }, [navigate, sort]);

  const onToggleView = useCallback(() => {
    void navigate({
      search: (prev) => ({
        ...prev,
        view: prev.view === "cards" ? undefined : "cards",
      }),
      replace: true,
    });
  }, [navigate]);

  const onCategoryChange = useCallback(
    (nextCategory: string) => {
      void navigate({
        search: (prev) => ({
          ...prev,
          category: nextCategory || undefined,
        }),
        replace: true,
      });
    },
    [navigate],
  );

  const activeFilters: string[] = [];
  if (category) {
    const categoryLabel =
      category === "uncategorized"
        ? browseCopy.filters.uncategorized
        : (categoriesQuery.data?.items.find((item) => item.slug === category)?.name ?? category);
    activeFilters.push(`${browseCopy.activeFilters.category}：${categoryLabel}`);
  }

  return {
    activeFilters,
    canAutoLoad,
    canLoadMore,
    categories: categoriesQuery.data?.items ?? [],
    category,
    dir,
    hasQuery,
    isLoadingBundles: isLoadingList,
    isLoadingMore,
    loadMore,
    loadMoreRef,
    onQueryChange,
    onCategoryChange,
    onSortChange,
    onToggleDir,
    onToggleView,
    paginationStatus: isLoadingList
      ? "LoadingFirstPage"
      : canLoadMore
        ? "CanLoadMore"
        : "Exhausted",
    query,
    sort,
    sorted,
    view,
  };
}
