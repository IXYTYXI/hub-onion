import { createFileRoute, redirect } from "@tanstack/react-router";
import { useRef } from "react";
import { bundlesCopy } from "../../copy/bundles";
import { BundlesResults } from "./-BundlesResults";
import { BundlesToolbar } from "./-BundlesToolbar";
import { parseBundleSort } from "./-params";
import { useBundlesBrowseModel } from "./-useBundlesBrowseModel";

export const Route = createFileRoute("/bundles/")({
  validateSearch: (search) => {
    return {
      q: typeof search.q === "string" && search.q.trim() ? search.q : undefined,
      sort: typeof search.sort === "string" ? parseBundleSort(search.sort) : undefined,
      dir: search.dir === "asc" || search.dir === "desc" ? search.dir : undefined,
      category:
        typeof search.category === "string" && search.category.trim() ? search.category : undefined,
      view: search.view === "cards" || search.view === "list" ? search.view : undefined,
      focus: search.focus === "search" ? "search" : undefined,
    };
  },
  beforeLoad: ({ search }) => {
    const hasQuery = Boolean(search.q?.trim());
    if (hasQuery || search.sort) return;
    throw redirect({
      to: "/bundles",
      search: {
        q: search.q || undefined,
        sort: "downloads",
        dir: search.dir || undefined,
        category: search.category || undefined,
        view: search.view || undefined,
        focus: search.focus || undefined,
      },
      replace: true,
    });
  },
  component: BundlesIndex,
});

export function BundlesIndex() {
  const copy = bundlesCopy.browse;
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const model = useBundlesBrowseModel({
    navigate,
    search,
    searchInputRef,
  });

  return (
    <main className="section">
      <header className="skills-header-top">
        <h1 className="section-title" style={{ marginBottom: 8 }}>
          {copy.title}
        </h1>
        <p className="section-subtitle" style={{ marginBottom: 0 }}>
          {model.isLoadingBundles
            ? copy.loading
            : `${copy.subtitleBase}${model.activeFilters.length ? `（${model.activeFilters.join("，")}）` : ""}。`}
        </p>
      </header>
      <div className="skills-container">
        <BundlesToolbar
          searchInputRef={searchInputRef}
          query={model.query}
          sort={model.sort}
          dir={model.dir}
          view={model.view}
          categories={model.categories}
          category={model.category}
          onQueryChange={model.onQueryChange}
          onCategoryChange={model.onCategoryChange}
          onSortChange={model.onSortChange}
          onToggleDir={model.onToggleDir}
          onToggleView={model.onToggleView}
        />
        <BundlesResults
          isLoadingBundles={model.isLoadingBundles}
          sorted={model.sorted}
          view={model.view}
          paginationStatus={model.paginationStatus}
          hasQuery={model.hasQuery}
          canLoadMore={model.canLoadMore}
          isLoadingMore={model.isLoadingMore}
          canAutoLoad={model.canAutoLoad}
          loadMoreRef={model.loadMoreRef}
          loadMore={model.loadMore}
        />
      </div>
    </main>
  );
}
