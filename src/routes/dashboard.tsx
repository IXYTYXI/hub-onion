import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Clock, Download, Package, Plus, Upload } from 'lucide-react'
import { BundleDownloadButton } from '../components/BundleDownloadButton'
import { dashboardCopy } from '../copy/dashboard'
import { useMyBundles } from '../hooks/useMyBundles'
import { useAuthStatus } from '../lib/useAuthStatus'
import { formatCompactStat } from '../lib/numberFormat'
import { apiRequest } from '../lib/apiClient'
import type { PublicSkill } from '../lib/publicUser'
import type { BundleItem } from '../types/api'

type DashboardSkill = PublicSkill & { pendingReview?: boolean }

export const Route = createFileRoute('/dashboard')({
  component: Dashboard,
})

function Dashboard() {
  const copy = dashboardCopy
  const { isAuthenticated, me, isLoading } = useAuthStatus()
  const ownerHandle = me?.handle ?? me?.name ?? me?.displayName ?? 'user'

  const { data: skillsData } = useQuery({
    queryKey: ['users', ownerHandle, 'skills'],
    queryFn: () => apiRequest<{ items: DashboardSkill[] }>(`/users/${ownerHandle}/skills`),
    enabled: !!ownerHandle && isAuthenticated,
  })
  const bundlesQuery = useMyBundles({ enabled: !!ownerHandle && isAuthenticated })

  const skills = skillsData?.items ?? []
  const bundles = bundlesQuery.data?.items ?? []

  if (isLoading) {
    return (
      <main className="section">
        <div className="card">
          <div className="loading-indicator">{copy.loading}</div>
        </div>
      </main>
    )
  }

  if (!isAuthenticated || !me) {
    return (
      <main className="section">
        <div className="card">{copy.signInRequired}</div>
      </main>
    )
  }

  return (
    <main className="section">
      <div className="dashboard-header">
        <h1 className="section-title" style={{ margin: 0 }}>
          {copy.title}
        </h1>
        <Link to="/upload" search={{ updateSlug: undefined }} className="btn btn-primary">
          <Plus className="h-4 w-4" aria-hidden="true" />
          {copy.uploadNew}
        </Link>
        <Link to="/bundles/new" search={{ edit: undefined }} className="btn btn-secondary">
          <Package className="h-4 w-4" aria-hidden="true" />
          {copy.createBundle}
        </Link>
      </div>

      <section className="skill-detail-stack">
        <h2 className="section-title">{copy.skillsTitle}</h2>
        {skills.length === 0 ? (
          <div className="card dashboard-empty">
            <Package className="dashboard-empty-icon" aria-hidden="true" />
            <h3>{copy.empty.title}</h3>
            <p>{copy.empty.body}</p>
            <Link to="/upload" search={{ updateSlug: undefined }} className="btn btn-primary">
              <Upload className="h-4 w-4" aria-hidden="true" />
              {copy.empty.action}
            </Link>
          </div>
        ) : (
          <div className="dashboard-grid">
            {skills.map((skill) => (
              <SkillCard key={skill.slug} skill={skill} ownerHandle={ownerHandle} />
            ))}
          </div>
        )}
      </section>

      <section className="skill-detail-stack" style={{ marginTop: '2rem' }}>
        <h2 className="section-title">{copy.bundles.title}</h2>
        {bundlesQuery.isError ? <div className="card">{copy.bundles.loadFailed}</div> : null}
        {!bundlesQuery.isError && bundles.length === 0 ? (
          <div className="card dashboard-empty">
            <Package className="dashboard-empty-icon" aria-hidden="true" />
            <h3>{copy.bundles.emptyTitle}</h3>
            <p>{copy.bundles.emptyBody}</p>
            <Link to="/bundles/new" search={{ edit: undefined }} className="btn btn-primary">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {copy.bundles.emptyAction}
            </Link>
          </div>
        ) : null}
        {bundles.length > 0 ? (
          <div className="dashboard-grid">
            {bundles.map((bundle) => (
              <BundleCard key={bundle.slug} bundle={bundle} />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  )
}

function SkillCard({ skill, ownerHandle }: { skill: DashboardSkill; ownerHandle: string | null }) {
  const copy = dashboardCopy
  return (
    <div className="dashboard-skill-card">
      <div className="dashboard-skill-info">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Link
            to="/$owner/$slug"
            params={{ owner: ownerHandle ?? 'unknown', slug: skill.slug }}
            className="dashboard-skill-name"
          >
            {skill.displayName}
          </Link>
          <span className="dashboard-skill-slug">/{skill.slug}</span>
          {skill.pendingReview ? (
            <span className="tag tag-pending">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {copy.scanning}
            </span>
          ) : null}
        </div>
        {skill.summary && <p className="dashboard-skill-description">{skill.summary}</p>}
        <div className="dashboard-skill-stats">
          <span>
            <Package size={13} aria-hidden="true" /> {formatCompactStat(skill.stats.downloads)}
          </span>
          <span> {formatCompactStat(skill.stats.stars || 0)}</span>
          <span>{skill.stats.versions} v</span>
        </div>
      </div>
      <div className="dashboard-skill-actions">
        <Link to="/upload" search={{ updateSlug: skill.slug }} className="btn btn-sm">
          <Upload className="h-3 w-3" aria-hidden="true" />
          {copy.actions.newVersion}
        </Link>
        <Link
          to="/$owner/$slug"
          params={{ owner: ownerHandle ?? 'unknown', slug: skill.slug }}
          className="btn btn-ghost btn-sm"
        >
          {copy.actions.view}
        </Link>
      </div>
    </div>
  )
}

function BundleCard({ bundle }: { bundle: BundleItem }) {
  const copy = dashboardCopy
  return (
    <div className="dashboard-skill-card">
      <div className="dashboard-skill-info">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Link to="/bundles/$slug" params={{ slug: bundle.slug }} className="dashboard-skill-name">
            {bundle.displayName}
          </Link>
          <span className="dashboard-skill-slug">/bundles/{bundle.slug}</span>
        </div>
        <p className="dashboard-skill-description">{bundle.summary ?? bundle.description}</p>
        <div className="skill-card-tags">
          {(bundle.categories?.length ? bundle.categories : [{ slug: 'uncategorized', name: '未分类' }]).map(
            (category) => (
              <span key={category.slug} className="tag tag-compact">
                {category.name}
              </span>
            ),
          )}
        </div>
        <div className="dashboard-skill-stats">
          <span>{copy.bundles.skillsCount.replace('{count}', String(bundle.stats.skills))}</span>
          <span>
            <Download size={13} aria-hidden="true" />{' '}
            {copy.bundles.downloads.replace('{count}', formatCompactStat(bundle.stats.downloads))}
          </span>
        </div>
      </div>
      <div className="dashboard-skill-actions">
        <Link to="/bundles/$slug" params={{ slug: bundle.slug }} className="btn btn-ghost btn-sm">
          {copy.actions.view}
        </Link>
        <Link to="/bundles/new" search={{ edit: bundle.slug }} className="btn btn-sm">
          {copy.actions.edit}
        </Link>
        <BundleDownloadButton slug={bundle.slug} label={copy.actions.download} className="btn btn-secondary btn-sm" />
      </div>
    </div>
  )
}
