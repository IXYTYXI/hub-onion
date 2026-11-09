import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { SkillItem, SearchResult } from "../../types/api";
import type { SkillListEntry } from "./-types";
import { skillsCopy } from "../../copy/skills";
import { useCategories } from "../../hooks/useCategories";
import { useSearchSkills } from "../../hooks/useSearchSkills";
import { useSkills } from "../../hooks/useSkills";
import { mapOwnerInfoToPublicUser, mapSkillItemToPublicSkill } from "../../lib/apiSkills";
import { parseDir, parseSort, toListSort, type SortDir, type SortKey } from "./-params";

const pageSize = 25;

type SkillsView = "cards" | "list";

export type SkillsSearchState = {
  q?: string;
  sort?: SortKey;
  dir?: SortDir;
  highlighted?: boolean;
  nonSuspicious?: boolean;
  category?: string;
  view?: SkillsView;
  focus?: "search";
};

type SkillsNavigate = (options: {
  search: (prev: SkillsSearchState) => SkillsSearchState;
  replace?: boolean;
}) => void | Promise<void>;

// Convert API response to internal format
function convertSkillItem(item: SkillItem): SkillListEntry {
  const owner = mapOwnerInfoToPublicUser(item.owner);
  return {
    skill: mapSkillItemToPublicSkill(item),
    latestVersion: item.latestVersion || null,
    ownerHandle: owner?.handle ?? null,
    owner,
    searchScore: undefined,
  };
}

function convertSearchResult(result: SearchResult): SkillListEntry {
  const owner = mapOwnerInfoToPublicUser(result.owner);
  return {
    skill: {
      _id: `skill:${result.slug}`,
      _creationTime: result.updatedAt || 0,
      slug: result.slug,
      displayName: result.displayName,
      summary: result.summary || "",
      ownerUserId: owner?.handle ?? "unknown",
      tags: [],
      categories: result.categories ?? [],
      stats: {
        downloads: result.stats?.downloads ?? 0,
        installs: result.stats?.installs ?? 0,
        versions: result.stats?.versions ?? 0,
        stars: result.stats?.stars ?? 0,
      },
      createdAt: result.updatedAt || 0,
      updatedAt: result.updatedAt || 0,
    },
    latestVersion:
      result.latestVersion ??
      (result.version ? { version: result.version, createdAt: 0, changelog: "" } : null),
    ownerHandle: owner?.handle ?? null,
    owner,
    searchScore: result.score,
  };
}

export function useSkillsBrowseModel({
  search,
  navigate,
  searchInputRef,
}: {
  search: SkillsSearchState;
  navigate: SkillsNavigate;
  searchInputRef: RefObject<HTMLInputElement | null>;
}) {
  const browseCopy = skillsCopy.browse;
  const [query, setQuery] = useState(search.q ?? "");
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const loadMoreInFlightRef = useRef(false);

  const view: SkillsView = search.view ?? "list";
  const highlightedOnly = search.highlighted ?? false;
  const nonSuspiciousOnly = search.nonSuspicious ?? false;
  const category = search.category;

  const trimmedQuery = useMemo(() => query.trim(), [query]);
  const hasQuery = trimmedQuery.length > 0;
  const sort: SortKey =
    search.sort === "relevance" && !hasQuery
      ? "downloads"
      : (search.sort ?? (hasQuery ? "relevance" : "downloads"));
  const listSort = toListSort(sort);
  const dir = parseDir(search.dir, sort);

  // Use TanStack Query hooks
  const {
    data: skillsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingList,
  } = useSkills({
    sort: listSort,
    dir,
    limit: pageSize,
    highlightedOnly,
    nonSuspiciousOnly,
    category,
    enabled: !hasQuery,
  });
  const categoriesQuery = useCategories();

  const { data: searchData, isLoading: isSearching } = useSearchSkills(trimmedQuery, {
    enabled: hasQuery,
    category,
  });

  useEffect(() => {
    setQuery(search.q ?? "");
  }, [search.q]);

  useEffect(() => {
    if (search.focus === "search" && searchInputRef.current) {
      searchInputRef.current.focus();
      void navigate({ search: (prev) => ({ ...prev, focus: undefined }), replace: true });
    }
  }, [navigate, search.focus, searchInputRef]);

  const baseItems = useMemo(() => {
    if (hasQuery) {
      const results = searchData?.results || [];
      return results.map(convertSearchResult);
    }
    const pages = skillsData?.pages || [];
    const allItems = pages.flatMap((page) => page.items);
    return allItems.map(convertSkillItem);
  }, [hasQuery, searchData, skillsData]);

  const sorted = useMemo(() => {
    if (!hasQuery) {
      // For list view, items are already sorted by backend
      return baseItems;
    }
    // For search, apply client-side sorting
    const multiplier = dir === "asc" ? 1 : -1;
    const results = [...baseItems];
    results.sort((a, b) => {
      const tieBreak = () => {
        const updated = (a.skill.updatedAt - b.skill.updatedAt) * multiplier;
        if (updated !== 0) return updated;
        return a.skill.slug.localeCompare(b.skill.slug);
      };
      switch (sort) {
        case "relevance":
          return ((a.searchScore ?? 0) - (b.searchScore ?? 0)) * multiplier;
        case "downloads":
          return (a.skill.stats.downloads - b.skill.stats.downloads) * multiplier || tieBreak();
        case "installs":
          return (a.skill.stats.installs - b.skill.stats.installs) * multiplier || tieBreak();
        case "stars":
          return (a.skill.stats.stars - b.skill.stats.stars) * multiplier || tieBreak();
        case "updated":
          return (
            (a.skill.updatedAt - b.skill.updatedAt) * multiplier ||
            a.skill.slug.localeCompare(b.skill.slug)
          );
        case "name":
          return (
            (a.skill.displayName.localeCompare(b.skill.displayName) ||
              a.skill.slug.localeCompare(b.skill.slug)) * multiplier
          );
        default:
          return (
            (a.skill.createdAt - b.skill.createdAt) * multiplier ||
            a.skill.slug.localeCompare(b.skill.slug)
          );
      }
    });
    return results;
  }, [baseItems, dir, hasQuery, sort]);

  const isLoadingSkills = hasQuery ? isSearching && baseItems.length === 0 : isLoadingList;
  const canLoadMore = hasQuery ? false : hasNextPage;
  const isLoadingMore = hasQuery ? false : isFetchingNextPage;
  const canAutoLoad = typeof IntersectionObserver !== "undefined";

  const loadMore = useCallback(() => {
    if (loadMoreInFlightRef.current || isLoadingMore || !canLoadMore) return;
    loadMoreInFlightRef.current = true;
    if (!hasQuery) {
      void fetchNextPage();
    }
  }, [canLoadMore, hasQuery, isLoadingMore, fetchNextPage]);

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

  const onToggleHighlighted = useCallback(() => {
    void navigate({
      search: (prev) => ({
        ...prev,
        highlighted: prev.highlighted ? undefined : true,
      }),
      replace: true,
    });
  }, [navigate]);

  const onToggleNonSuspicious = useCallback(() => {
    void navigate({
      search: (prev) => ({
        ...prev,
        nonSuspicious: prev.nonSuspicious ? undefined : true,
      }),
      replace: true,
    });
  }, [navigate]);

  const onSortChange = useCallback(
    (value: string) => {
      const nextSort = parseSort(value);
      void navigate({
        search: (prev) => ({
          ...prev,
          sort: nextSort,
          dir: parseDir(prev.dir, nextSort),
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
        dir: parseDir(prev.dir, sort) === "asc" ? "desc" : "asc",
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
  if (highlightedOnly) activeFilters.push(browseCopy.activeFilters.highlighted);
  if (nonSuspiciousOnly) activeFilters.push(browseCopy.activeFilters.nonSuspicious);
  if (category) {
    const categoryLabel =
      category === "uncategorized"
        ? "未分类"
        : (categoriesQuery.data?.items.find((item) => item.slug === category)?.name ?? category);
    activeFilters.push(`分类：${categoryLabel}`);
  }

  return {
    activeFilters,
    canAutoLoad,
    canLoadMore,
    categories: categoriesQuery.data?.items ?? [],
    category,
    dir,
    hasQuery,
    highlightedOnly,
    isLoadingMore,
    isLoadingSkills,
    loadMore,
    loadMoreRef,
    nonSuspiciousOnly,
    onQueryChange,
    onCategoryChange,
    onSortChange,
    onToggleDir,
    onToggleHighlighted,
    onToggleNonSuspicious,
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
