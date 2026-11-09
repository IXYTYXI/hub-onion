import { Link, useNavigate } from "@tanstack/react-router";
import { bundlesCopy } from "../copy/bundles";
import { useBundle } from "../hooks/useBundle";
import { useDeleteBundle } from "../hooks/useDeleteBundle";
import { mapBundleItemToPublicBundle, mapBundleSkillItemToListEntry } from "../lib/apiBundles";
import { buildSkillHref } from "../lib/badges";
import { useAuthStatus } from "../lib/useAuthStatus";
import { BundleDownloadButton } from "./BundleDownloadButton";
import { BundleHeader } from "./BundleHeader";
import { BundleInstallCard } from "./BundleInstallCard";
import { DocumentationLinks } from "./SkillDocumentationLinks";
import { UserBadge } from "./UserBadge";

type BundleDetailPageProps = {
  slug: string;
};

export function BundleDetailPage({ slug }: BundleDetailPageProps) {
  const copy = bundlesCopy.detail;
  const navigate = useNavigate();
  const { me } = useAuthStatus();
  const { data: result, isError, isLoading } = useBundle(slug);
  const deleteBundleMutation = useDeleteBundle();

  if (isLoading) {
    return (
      <main className="section">
        <div className="card">
          <div className="loading-indicator">{copy.loadingBundle}</div>
        </div>
      </main>
    );
  }

  if (isError || !result?.bundle) {
    return (
      <main className="section">
        <div className="card">{copy.notFound}</div>
      </main>
    );
  }

  const bundle = mapBundleItemToPublicBundle(result.bundle);
  const skills = result.skills.map(mapBundleSkillItemToListEntry);
  const missingSkills = result.missingSkills ?? [];
  const canManage = me?.isSuperuser === true || bundle.owner?.handle === me?.handle;

  const deleteBundle = () => {
    if (!window.confirm(`确定删除技能包「${bundle.displayName}」吗？`)) return;
    deleteBundleMutation.mutate(bundle.slug, {
      onSuccess: () => {
        void navigate({
          to: "/bundles",
          search: { sort: "downloads", dir: "desc", view: undefined },
        });
      },
    });
  };

  return (
    <main className="section">
      <div className="skill-detail-stack">
        <BundleHeader
          bundle={bundle}
          actions={
            <>
              <BundleDownloadButton slug={bundle.slug} />
              {canManage ? (
                <>
                  <Link
                    to="/bundles/new"
                    search={{ edit: bundle.slug }}
                    className="btn btn-secondary"
                  >
                    {copy.actions.edit}
                  </Link>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={deleteBundleMutation.isPending}
                    onClick={deleteBundle}
                  >
                    {deleteBundleMutation.isPending ? copy.actions.deleting : copy.actions.delete}
                  </button>
                </>
              ) : null}
            </>
          }
        />

        <DocumentationLinks links={bundle.documentationLinks} copy={copy.documentationLinks} />

        {missingSkills.length ? (
          <section className="pending-banner pending-banner-warning">
            <div className="pending-banner-content">
              <strong>{copy.missingSkillsTitle}</strong>
              <p>{copy.missingSkillsBody}</p>
              <p className="mono">{missingSkills.join(", ")}</p>
            </div>
          </section>
        ) : null}

        <BundleInstallCard bundle={bundle} />

        <section className="card" aria-labelledby="bundle-skills-title">
          <div className="skill-cli-install-header">
            <div>
              <h2 id="bundle-skills-title" className="section-title">
                {copy.sections.skills}
              </h2>
              <p className="section-subtitle skill-cli-install-subtitle">
                {bundle.stats.skills} {copy.stats.skills}
              </p>
            </div>
          </div>

          <div className="grid" style={{ marginTop: "1rem" }}>
            {skills.map((skill) => {
              const skillHref = buildSkillHref(
                skill.owner?.handle ?? skill.ownerHandle ?? null,
                null,
                skill.slug,
              );
              return (
                <a
                  key={skill.slug}
                  className="card skill-card"
                  href={skill.deleted ? undefined : skillHref}
                  aria-disabled={skill.deleted}
                >
                  <div className="skill-card-tags">
                    {skill.deleted ? (
                      <div className="tag tag-accent tag-compact">{copy.deletedSkill}</div>
                    ) : null}
                    {(skill.categories.length
                      ? skill.categories
                      : [{ slug: "uncategorized", name: "未分类" }]
                    ).map((category) => (
                      <div key={category.slug} className="tag tag-compact">
                        {category.name}
                      </div>
                    ))}
                  </div>
                  <h3 className="skill-card-title">{skill.displayName ?? skill.slug}</h3>
                  <p className="skill-card-summary">{skill.summary ?? copy.skillSummaryFallback}</p>
                  <div className="skill-card-footer">
                    <div className="skill-card-footer-rows">
                      <UserBadge
                        user={skill.owner}
                        fallbackHandle={skill.ownerHandle}
                        link={false}
                        preferDisplayName
                      />
                      <div className="stat">v{skill.version ?? copy.skillVersionFallback}</div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
