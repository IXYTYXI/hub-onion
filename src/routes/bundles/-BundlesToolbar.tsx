import type { RefObject } from "react";
import type { Category } from "../../types/api";
import type { BundleSortDir, BundleSortKey } from "./-params";
import { bundlesCopy } from "../../copy/bundles";

type BundlesToolbarProps = {
  searchInputRef: RefObject<HTMLInputElement | null>;
  query: string;
  sort: BundleSortKey;
  dir: BundleSortDir;
  view: "cards" | "list";
  categories: Category[];
  category?: string;
  onQueryChange: (next: string) => void;
  onCategoryChange: (next: string) => void;
  onSortChange: (value: string) => void;
  onToggleDir: () => void;
  onToggleView: () => void;
};

export function BundlesToolbar({
  searchInputRef,
  query,
  sort,
  dir,
  view,
  categories,
  category,
  onQueryChange,
  onCategoryChange,
  onSortChange,
  onToggleDir,
  onToggleView,
}: BundlesToolbarProps) {
  const copy = bundlesCopy.browse;
  return (
    <div className="skills-toolbar">
      <div className="skills-search">
        <input
          ref={searchInputRef}
          className="skills-search-input"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={copy.searchPlaceholder}
        />
      </div>
      <div className="skills-toolbar-row">
        <select
          className="skills-sort"
          value={category ?? ""}
          onChange={(event) => onCategoryChange(event.target.value)}
          aria-label={copy.filters.categoryAria}
        >
          <option value="">{copy.filters.allCategories}</option>
          <option value="uncategorized">{copy.filters.uncategorized}</option>
          {categories.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          className="skills-sort"
          value={sort}
          onChange={(event) => onSortChange(event.target.value)}
          aria-label={copy.sort.ariaLabel}
        >
          <option value="newest">{copy.sort.newest}</option>
          <option value="updated">{copy.sort.updated}</option>
          <option value="downloads">{copy.sort.downloads}</option>
          <option value="name">{copy.sort.name}</option>
        </select>
        <button
          className="skills-dir"
          type="button"
          aria-label={`${copy.sort.ariaLabel}：${dir === "asc" ? copy.sort.direction.asc : copy.sort.direction.desc}`}
          onClick={onToggleDir}
        >
          {dir === "asc" ? "↑" : "↓"}
        </button>
        <button
          className={`skills-view${view === "cards" ? " is-active" : ""}`}
          type="button"
          onClick={onToggleView}
        >
          {view === "cards" ? copy.view.list : copy.view.cards}
        </button>
      </div>
    </div>
  );
}
