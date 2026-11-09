import type { RefObject } from 'react'
import { skillsCopy } from '../../copy/skills'
import { type SortDir, type SortKey } from './-params'
import type { Category } from '../../types/api'

type SkillsToolbarProps = {
  searchInputRef: RefObject<HTMLInputElement | null>
  query: string
  hasQuery: boolean
  sort: SortKey
  dir: SortDir
  view: 'cards' | 'list'
  highlightedOnly: boolean
  nonSuspiciousOnly: boolean
  categories: Category[]
  category?: string
  onQueryChange: (next: string) => void
  onCategoryChange: (next: string) => void
  onToggleHighlighted: () => void
  onToggleNonSuspicious: () => void
  onSortChange: (value: string) => void
  onToggleDir: () => void
  onToggleView: () => void
}

export function SkillsToolbar({
  searchInputRef,
  query,
  hasQuery,
  sort,
  dir,
  view,
  highlightedOnly,
  nonSuspiciousOnly,
  categories,
  category,
  onQueryChange,
  onCategoryChange,
  onToggleHighlighted,
  onToggleNonSuspicious,
  onSortChange,
  onToggleDir,
  onToggleView,
}: SkillsToolbarProps) {
  const copy = skillsCopy.browse
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
        <button
          className={`search-filter-button${highlightedOnly ? ' is-active' : ''}`}
          type="button"
          aria-pressed={highlightedOnly}
          onClick={onToggleHighlighted}
        >
          {copy.filters.highlighted}
        </button>
        <button
          className={`search-filter-button${nonSuspiciousOnly ? ' is-active' : ''}`}
          type="button"
          aria-pressed={nonSuspiciousOnly}
          onClick={onToggleNonSuspicious}
        >
          {copy.filters.hideSuspicious}
        </button>
        <select
          className="skills-sort"
          value={category ?? ''}
          onChange={(event) => onCategoryChange(event.target.value)}
          aria-label="分类筛选"
        >
          <option value="">全部分类</option>
          <option value="uncategorized">未分类</option>
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
          {hasQuery ? <option value="relevance">{copy.sort.relevance}</option> : null}
          <option value="newest">{copy.sort.newest}</option>
          <option value="updated">{copy.sort.updated}</option>
          <option value="downloads">{copy.sort.downloads}</option>
          <option value="installs">{copy.sort.installs}</option>
          <option value="stars">{copy.sort.stars}</option>
          <option value="name">{copy.sort.name}</option>
        </select>
        <button
          className="skills-dir"
          type="button"
          aria-label={`${copy.sort.ariaLabel}：${dir === 'asc' ? copy.sort.direction.asc : copy.sort.direction.desc}`}
          onClick={onToggleDir}
        >
          {dir === 'asc' ? '↑' : '↓'}
        </button>
        <button
          className={`skills-view${view === 'cards' ? ' is-active' : ''}`}
          type="button"
          onClick={onToggleView}
        >
          {view === 'cards' ? copy.view.list : copy.view.cards}
        </button>
      </div>
    </div>
  )
}
