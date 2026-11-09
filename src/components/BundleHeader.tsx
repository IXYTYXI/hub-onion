import type { ReactNode } from "react";
import type { PublicBundle } from "../lib/apiBundles";
import { bundlesCopy } from "../copy/bundles";
import { UserBadge } from "./UserBadge";

type BundleHeaderProps = {
  bundle: PublicBundle;
  actions?: ReactNode;
};

function formatDate(value: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value * 1000));
}

export function BundleHeader({ bundle, actions }: BundleHeaderProps) {
  const copy = bundlesCopy.detail;

  return (
    <div className="card skill-hero">
      <div className="skill-hero-top">
        <div className="skill-hero-header">
          <div className="skill-hero-title">
            <div className="skill-hero-kicker-row">
              <span className="skill-slug mono">/bundles/{bundle.slug}</span>
            </div>
            <div className="skill-hero-title-row">
              <h1 className="section-title" style={{ margin: 0 }}>
                {bundle.displayName}
              </h1>
            </div>
            <p className="section-subtitle skill-hero-summary">
              {bundle.description || bundle.summary || copy.noSummary}
            </p>
            <div className="skill-actions">{actions}</div>
          </div>
          <div className="skill-hero-cta">
            <div className="skill-side-item">
              <span className="skill-meta-label">{copy.author}</span>
              <div className="skill-side-value">
                <UserBadge
                  user={bundle.owner}
                  fallbackHandle={bundle.owner?.handle}
                  size="md"
                  showName
                />
              </div>
            </div>
            <div className="skill-side-item">
              <span className="skill-meta-label">{copy.stats.downloads}</span>
              <strong className="skill-side-value">{bundle.stats.downloads}</strong>
            </div>
            <div className="skill-side-item">
              <span className="skill-meta-label">{copy.sections.skills}</span>
              <strong className="skill-side-value">{bundle.stats.skills}</strong>
            </div>
            <div className="skill-side-item">
              <span className="skill-meta-label">{copy.stats.updatedAt}</span>
              <strong className="skill-side-value">{formatDate(bundle.updatedAt)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="skill-tag-row">
        {(bundle.categories.length
          ? bundle.categories
          : [{ slug: "uncategorized", name: "未分类" }]
        ).map((category) => (
          <span key={category.slug} className="tag tag-compact">
            {category.name}
          </span>
        ))}
      </div>
    </div>
  );
}
