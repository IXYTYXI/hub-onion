import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { PublicBundle } from "../lib/apiBundles";

type BundleCardProps = {
  bundle: PublicBundle;
  summaryFallback: string;
  meta: ReactNode;
  href?: string;
};

export function BundleCard({ bundle, summaryFallback, meta, href }: BundleCardProps) {
  const categories = bundle.categories.length
    ? bundle.categories.map((category) => category.name)
    : ["未分类"];

  return (
    <Link to={href ?? `/bundles/${bundle.slug}`} className="card skill-card">
      <div className="skill-card-tags">
        {categories.map((label) => (
          <div key={`category:${label}`} className="tag tag-compact">
            {label}
          </div>
        ))}
        <div className="tag tag-accent tag-compact">{bundle.stats.skills} Skills</div>
      </div>
      <h3 className="skill-card-title">{bundle.displayName}</h3>
      <p className="skill-card-summary">{bundle.summary ?? summaryFallback}</p>
      <div className="skill-card-footer">{meta}</div>
    </Link>
  );
}
