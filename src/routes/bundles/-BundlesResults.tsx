import type { RefObject } from "react";
import { Link } from "@tanstack/react-router";
import { BundleCard } from "../../components/BundleCard";
import { UserBadge } from "../../components/UserBadge";
import { bundlesCopy } from "../../copy/bundles";
import { buildBundleHref, type BundleListEntry } from "./-types";

type BundlesResultsProps = {
  isLoadingBundles: boolean;
  sorted: BundleListEntry[];
  view: "cards" | "list";
  paginationStatus: "LoadingFirstPage" | "CanLoadMore" | "Exhausted";
  hasQuery: boolean;
  canLoadMore: boolean;
  isLoadingMore: boolean;
  canAutoLoad: boolean;
  loadMoreRef: RefObject<HTMLDivElement | null>;
  loadMore: () => void;
};

export function BundlesResults({
  isLoadingBundles,
  sorted,
  view,
  paginationStatus,
  hasQuery,
  canLoadMore,
  isLoadingMore,
  canAutoLoad,
  loadMoreRef,
  loadMore,
}: BundlesResultsProps) {
  const copy = bundlesCopy.browse;
  return (
    <>
      {isLoadingBundles ? (
        <div className="card">
          <div className="loading-indicator">{copy.loading}</div>
        </div>
      ) : sorted.length === 0 ? (
        <div className="card">
          {paginationStatus === "Exhausted" || hasQuery ? copy.empty : copy.loading}
        </div>
      ) : view === "cards" ? (
        <div className="grid">
          {sorted.map((entry) => {
            const bundle = entry.bundle;
            const bundleHref = buildBundleHref(bundle);
            return (
              <BundleCard
                key={bundle._id}
                bundle={bundle}
                href={bundleHref}
                summaryFallback={copy.cardSummaryFallback}
                meta={
                  <div className="skill-card-footer-rows">
                    <UserBadge
                      user={bundle.owner}
                      fallbackHandle={bundle.owner?.handle}
                      link={false}
                      preferDisplayName
                    />
                    <div className="stat">
                      {bundle.stats.downloads} 下载 · {bundle.stats.skills} Skills
                    </div>
                  </div>
                }
              />
            );
          })}
        </div>
      ) : (
        <div className="skills-list">
          {sorted.map((entry) => {
            const bundle = entry.bundle;
            const bundleHref = buildBundleHref(bundle);
            const categoryLabels = bundle.categories.length
              ? bundle.categories.map((category) => category.name)
              : ["未分类"];
            return (
              <Link key={bundle._id} className="skills-row" to={bundleHref}>
                <div className="skills-row-main">
                  <div className="skills-row-title">
                    <span>{bundle.displayName}</span>
                    <span className="skills-row-slug">/bundles/{bundle.slug}</span>
                    <span className="tag tag-accent tag-compact">{bundle.stats.skills} Skills</span>
                    {categoryLabels.map((label) => (
                      <span key={`category:${label}`} className="tag tag-compact">
                        {label}
                      </span>
                    ))}
                  </div>
                  <div className="skills-row-summary">
                    {bundle.summary ?? copy.listSummaryFallback}
                  </div>
                  <div className="skills-row-owner">
                    <UserBadge
                      user={bundle.owner}
                      fallbackHandle={bundle.owner?.handle}
                      link={false}
                      preferDisplayName
                    />
                  </div>
                </div>
                <div className="skills-row-metrics">
                  <span>{bundle.stats.downloads} 下载</span>
                  <span>{bundle.stats.installs} 安装</span>
                  <span>{bundle.stats.skills} Skills</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {canLoadMore || isLoadingMore ? (
        <div
          ref={canAutoLoad ? loadMoreRef : null}
          className="card"
          style={{ marginTop: 16, display: "flex", justifyContent: "center" }}
        >
          {canAutoLoad ? (
            isLoadingMore ? (
              copy.loadingMore
            ) : (
              copy.scrollToLoadMore
            )
          ) : (
            <button className="btn" type="button" onClick={loadMore} disabled={isLoadingMore}>
              {isLoadingMore ? copy.loading : copy.loadMore}
            </button>
          )}
        </div>
      ) : null}
    </>
  );
}
