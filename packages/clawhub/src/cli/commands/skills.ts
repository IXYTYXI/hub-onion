import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import semver from 'semver'
import { apiRequest, downloadZip, fetchText, registryUrl } from '../../http.js'
import {
  ApiRoutes,
  ApiV1SearchResponseSchema,
  ApiV1SkillListResponseSchema,
  ApiV1SkillResolveResponseSchema,
  ApiV1SkillResponseSchema,
} from '../../schema/index.js'
import {
  extractZipToDir,
  hashSkillFiles,
  listTextFiles,
  readLockfile,
  readSkillOrigin,
  writeLockfile,
  writeSkillOrigin,
} from '../../skills.js'
import { getOptionalAuthToken, requireAuthToken } from '../authToken.js'
import { getRegistry } from '../registry.js'
import type { GlobalOpts, ResolveResult } from '../types.js'
import { createSpinner, fail, formatError, isInteractive, promptConfirm } from '../ui.js'

function normalizeSkillSlugOrFail(raw: string) {
  const slug = raw.trim()
  if (!slug) fail('Slug required')
  // Safety: never allow path traversal or nested paths to become filesystem operations.
  if (slug.includes('/') || slug.includes('\\') || slug.includes('..')) {
    fail(`Invalid slug: ${slug}`)
  }
  return slug
}

function isSafeSkillSlug(slug: string) {
  return Boolean(slug) && !slug.includes('/') && !slug.includes('\\') && !slug.includes('..')
}

export async function cmdSearch(opts: GlobalOpts, query: string, limit?: number) {
  if (!query) fail('Query required')

  const registry = await getRegistry(opts, { cache: true })
  const spinner = createSpinner('Searching')
  try {
    const url = registryUrl(ApiRoutes.search, registry)
    url.searchParams.set('q', query)
    if (typeof limit === 'number' && Number.isFinite(limit)) {
      url.searchParams.set('limit', String(limit))
    }
    const result = await apiRequest(
      registry,
      { method: 'GET', url: url.toString() },
      ApiV1SearchResponseSchema,
    )

    spinner.stop()
    for (const entry of result.results) {
      const slug = entry.slug ?? 'unknown'
      const name = entry.displayName ?? slug
      const version = entry.version ? ` v${entry.version}` : ''
      console.log(`${slug}${version}  ${name}  (${entry.score.toFixed(3)})`)
    }
  } catch (error) {
    spinner.fail(formatError(error))
    throw error
  }
}

export async function cmdInstall(
  opts: GlobalOpts,
  slug: string,
  versionFlag?: string,
  force = false,
) {
  const trimmed = normalizeSkillSlugOrFail(slug)

  const token = await getOptionalAuthToken(opts)

  const registry = await getRegistry(opts, { cache: true })
  await mkdir(opts.dir, { recursive: true })
  const target = join(opts.dir, trimmed)
  if (!force) {
    const exists = await fileExists(target)
    if (exists) fail(`Already installed: ${target} (use --force)`)
  } else {
    await rm(target, { recursive: true, force: true })
  }

  const spinner = createSpinner(`Resolving ${trimmed}`)
  try {
    // Fetch skill metadata including moderation status
    const skillMeta = await apiRequest(
      registry,
      { method: 'GET', path: `${ApiRoutes.skills}/${encodeURIComponent(trimmed)}`, token },
      ApiV1SkillResponseSchema,
    )

    // Check moderation status before proceeding
    if (skillMeta.moderation?.isMalwareBlocked) {
      spinner.fail(`Blocked: ${trimmed} is flagged as malicious`)
      fail('This skill has been flagged as malware and cannot be installed.')
    }

    if (skillMeta.moderation?.isSuspicious && !force) {
      spinner.stop()
      console.log(
        `\n⚠️  Warning: "${trimmed}" is flagged as suspicious by VirusTotal Code Insight.\n` +
          '   This skill may contain risky patterns (crypto keys, external APIs, eval, etc.)\n' +
          '   Review the skill code before use.\n',
      )
      if (isInteractive()) {
        const confirm = await promptConfirm('Install anyway?')
        if (!confirm) fail('Installation cancelled')
        spinner.start(`Resolving ${trimmed}`)
      } else {
        fail('Use --force to install suspicious skills in non-interactive mode')
      }
    }

    const resolvedVersion = versionFlag ?? skillMeta.latestVersion?.version ?? null
    if (!resolvedVersion) fail('Could not resolve latest version')

    spinner.text = `Downloading ${trimmed}@${resolvedVersion}`
    const zip = await downloadZip(registry, { slug: trimmed, version: resolvedVersion, token })
    await extractZipToDir(zip, target)

    await writeSkillOrigin(target, {
      version: 1,
      registry,
      slug: trimmed,
      installedVersion: resolvedVersion,
      installedAt: Date.now(),
    })

    const lock = await readLockfile(opts.workdir)
    lock.skills[trimmed] = {
      version: resolvedVersion,
      installedAt: Date.now(),
    }
    await writeLockfile(opts.workdir, lock)
    spinner.succeed(`OK. Installed ${trimmed} -> ${target}`)
  } catch (error) {
    spinner.fail(formatError(error))
    throw error
  }
}

export async function cmdUpdate(
  opts: GlobalOpts,
  slugArg: string | undefined,
  options: { all?: boolean; version?: string; force?: boolean },
  inputAllowed: boolean,
) {
  const slug = slugArg ? normalizeSkillSlugOrFail(slugArg) : undefined
  const all = Boolean(options.all)
  if (!slug && !all) fail('Provide <slug> or --all')
  if (slug && all) fail('Use either <slug> or --all')
  if (options.version && !slug) fail('--version requires a single <slug>')
  if (options.version && !semver.valid(options.version)) fail('--version must be valid semver')
  const allowPrompt = isInteractive() && inputAllowed

  const token = await getOptionalAuthToken(opts)

  const registry = await getRegistry(opts, { cache: true })
  const lock = await readLockfile(opts.workdir)
  const slugs = slug ? [slug] : Object.keys(lock.skills).filter(isSafeSkillSlug)
  if (slugs.length === 0) {
    console.log('No installed skills.')
    return
  }

  for (const entry of slugs) {
    const spinner = createSpinner(`Checking ${entry}`)
    try {
      const target = join(opts.dir, entry)
      const exists = await fileExists(target)

      // Always fetch skill metadata to check moderation status
      const skillMeta = await apiRequest(
        registry,
        { method: 'GET', path: `${ApiRoutes.skills}/${encodeURIComponent(entry)}`, token },
        ApiV1SkillResponseSchema,
      )

      // Check moderation status before proceeding
      if (skillMeta.moderation?.isMalwareBlocked) {
        spinner.fail(`${entry}: blocked as malicious`)
        console.log('   This skill has been flagged as malware and cannot be updated.')
        continue
      }

      if (skillMeta.moderation?.isSuspicious && !options.force) {
        spinner.stop()
        console.log(
          `\n⚠️  Warning: "${entry}" is flagged as suspicious by VirusTotal Code Insight.\n` +
            '   This skill may contain risky patterns (crypto keys, external APIs, eval, etc.)\n',
        )
        if (allowPrompt) {
          const confirm = await promptConfirm('Update anyway?')
          if (!confirm) {
            console.log(`${entry}: skipped`)
            continue
          }
          spinner.start(`Checking ${entry}`)
        } else {
          console.log(`${entry}: skipped (use --force to update suspicious skills)`)
          continue
        }
      }

      let localFingerprint: string | null = null
      if (exists) {
        const filesOnDisk = await listTextFiles(target)
        if (filesOnDisk.length > 0) {
          const hashed = hashSkillFiles(filesOnDisk)
          localFingerprint = hashed.fingerprint
        }
      }

      let resolveResult: ResolveResult
      if (localFingerprint) {
        resolveResult = await resolveSkillVersion(registry, entry, localFingerprint, token)
      } else {
        resolveResult = { match: null, latestVersion: skillMeta.latestVersion ?? null }
      }

      const latest = resolveResult.latestVersion?.version ?? null
      const matched = resolveResult.match?.version ?? null

      if (matched && lock.skills[entry]?.version !== matched) {
        lock.skills[entry] = {
          version: matched,
          installedAt: lock.skills[entry]?.installedAt ?? Date.now(),
        }
      }

      if (!latest) {
        spinner.fail(`${entry}: not found`)
        continue
      }

      if (!matched && localFingerprint && !options.force) {
        spinner.stop()
        if (!allowPrompt) {
          console.log(`${entry}: local changes (no match). Use --force to overwrite.`)
          continue
        }
        const confirm = await promptConfirm(
          `${entry}: local changes (no match). Overwrite with ${options.version ?? latest}?`,
        )
        if (!confirm) {
          console.log(`${entry}: skipped`)
          continue
        }
        spinner.start(`Updating ${entry} -> ${options.version ?? latest}`)
      }

      const targetVersion = options.version ?? latest
      if (options.version) {
        if (matched && matched === targetVersion) {
          spinner.succeed(`${entry}: already at ${matched}`)
          continue
        }
      } else if (matched && semver.valid(matched) && semver.gte(matched, targetVersion)) {
        spinner.succeed(`${entry}: up to date (${matched})`)
        continue
      }

      if (spinner.isSpinning) {
        spinner.text = `Updating ${entry} -> ${targetVersion}`
      } else {
        spinner.start(`Updating ${entry} -> ${targetVersion}`)
      }
      await rm(target, { recursive: true, force: true })
      const zip = await downloadZip(registry, { slug: entry, version: targetVersion, token })
      await extractZipToDir(zip, target)

      const existingOrigin = await readSkillOrigin(target)
      await writeSkillOrigin(target, {
        version: 1,
        registry: existingOrigin?.registry ?? registry,
        slug: existingOrigin?.slug ?? entry,
        installedVersion: targetVersion,
        installedAt: existingOrigin?.installedAt ?? Date.now(),
      })

      lock.skills[entry] = { version: targetVersion, installedAt: Date.now() }
      spinner.succeed(`${entry}: updated -> ${targetVersion}`)
    } catch (error) {
      spinner.fail(formatError(error))
      throw error
    }
  }

  await writeLockfile(opts.workdir, lock)
}

export async function cmdList(opts: GlobalOpts) {
  const lock = await readLockfile(opts.workdir)
  const entries = Object.entries(lock.skills)
  if (entries.length === 0) {
    console.log('No installed skills.')
    return
  }
  for (const [slug, entry] of entries) {
    console.log(`${slug}  ${entry.version ?? 'latest'}`)
  }
}

export async function cmdUninstall(
  opts: GlobalOpts,
  slug: string,
  options: { yes?: boolean } = {},
  inputAllowed: boolean,
) {
  const trimmed = normalizeSkillSlugOrFail(slug)

  const lock = await readLockfile(opts.workdir)
  if (!lock.skills[trimmed]) {
    fail(`Not installed: ${trimmed}`)
  }

  const allowPrompt = isInteractive() && inputAllowed
  if (!options.yes) {
    if (!allowPrompt) fail('Pass --yes (no input)')
    const confirm = await promptConfirm(`Uninstall ${trimmed}?`)
    if (!confirm) {
      console.log('Cancelled.')
      return
    }
  }

  const spinner = createSpinner(`Uninstalling ${trimmed}`)
  try {
    const target = join(opts.dir, trimmed)

    await rm(target, { recursive: true, force: true })

    delete lock.skills[trimmed]
    await writeLockfile(opts.workdir, lock)

    spinner.succeed(`Uninstalled ${trimmed}`)
  } catch (error) {
    spinner.fail(formatError(error))
    throw error
  }
}

type ExploreSort = 'newest' | 'updated' | 'downloads' | 'rating' | 'installs' | 'installsAllTime' | 'trending'
type ApiExploreSort =
  | 'newest'
  | 'created_at'
  | 'updated'
  | 'downloads'
  | 'stars'
  | 'installsCurrent'
  | 'installsAllTime'
  | 'trending'

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/
const UNIX_TS_RE = /^\d+$/

export type ExploreOptions = {
  limit?: number
  sort?: string
  json?: boolean
  export?: string
  from?: string
  to?: string
  timeField?: string
  output?: string
}

export async function cmdExplore(opts: GlobalOpts, options: ExploreOptions = {}) {
  const exportMode = options.export?.trim().toLowerCase()
  if (exportMode) {
    await cmdExploreExport(opts, { ...options, export: exportMode })
    return
  }

  const registry = await getRegistry(opts, { cache: true })
  const spinner = createSpinner('Fetching latest skills')
  try {
    const url = registryUrl(ApiRoutes.skills, registry)
    const boundedLimit = clampLimit(options.limit ?? 25)
    const { apiSort } = resolveExploreSort(options.sort)
    url.searchParams.set('limit', String(boundedLimit))
    url.searchParams.set('sort', apiSort)
    const result = await apiRequest(
      registry,
      { method: 'GET', url: url.toString() },
      ApiV1SkillListResponseSchema,
    )

    spinner.stop()
    if (options.json) {
      console.log(JSON.stringify(result, null, 2))
      return
    }
    if (result.items.length === 0) {
      console.log('No skills found.')
      return
    }

    for (const item of result.items) {
      console.log(formatExploreLine(item))
    }
  } catch (error) {
    spinner.fail(formatError(error))
    throw error
  }
}

async function cmdExploreExport(
  opts: GlobalOpts,
  options: ExploreOptions & { export: string },
) {
  if (options.export !== 'csv') {
    fail(`Unsupported export format "${options.export}". Use csv.`)
  }

  const from = normalizeExploreTimeBound(options.from, '--from')
  const to = normalizeExploreTimeBound(options.to, '--to')
  assertExploreTimeRange(from, to)
  const timeField = normalizeExploreTimeField(options.timeField)

  const registry = await getRegistry(opts, { cache: true })
  const token = await requireAuthToken(opts)
  const spinner = createSpinner('Exporting skills CSV')
  try {
    const url = registryUrl('/api/v1/admin/skills/export', registry)
    const { apiSort } = resolveExploreSort(options.sort)
    const sort =
      apiSort === 'newest' || apiSort === 'created_at'
        ? 'created_at'
        : apiSort === 'updated'
          ? 'updated_at'
          : 'updated_at'
    url.searchParams.set('sort', sort)
    url.searchParams.set('dir', 'desc')
    url.searchParams.set('timeField', timeField)
    if (from) url.searchParams.set('createdFrom', from)
    if (to) url.searchParams.set('createdTo', to)

    const csv = await fetchText(registry, { url: url.toString(), token })
    spinner.stop()
    if (options.output) {
      await writeFile(options.output, csv, 'utf8')
      console.log(`Wrote ${options.output}`)
      return
    }
    process.stdout.write(csv)
  } catch (error) {
    spinner.fail(formatError(error))
    const message = formatError(error)
    if (/\b403\b/.test(message) || /superuser|forbidden|permission/i.test(message)) {
      fail('Export requires a logged-in superuser token.')
    }
    throw error
  }
}

export function formatExploreLine(item: {
  slug: string
  summary?: string | null
  createdAt?: number
  updatedAt: number
  latestVersion?: { version: string } | null
}) {
  const version = item.latestVersion?.version ?? '?'
  const submitted =
    item.createdAt != null
      ? `created ${formatRelativeTime(item.createdAt)}`
      : `updated ${formatRelativeTime(item.updatedAt)}`
  const summary = item.summary ? `  ${truncate(item.summary, 50)}` : ''
  return `${item.slug}  v${version}  ${submitted}${summary}`
}

export function clampLimit(limit: number, fallback = 25) {
  if (!Number.isFinite(limit)) return fallback
  return Math.min(Math.max(1, limit), 200)
}

function formatRelativeTime(timestampSeconds: number): string {
  const now = Date.now()
  const ms = timestampSeconds < 1e12 ? timestampSeconds * 1000 : timestampSeconds
  const diff = now - ms
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 30) {
    const months = Math.floor(days / 30)
    return `${months}mo ago`
  }
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return `${str.slice(0, maxLen - 1)}…`
}

export function resolveExploreSort(raw?: string): { sort: ExploreSort; apiSort: ApiExploreSort } {
  const normalized = raw?.trim().toLowerCase()
  if (!normalized || normalized === 'newest') {
    return { sort: 'newest', apiSort: 'newest' }
  }
  if (normalized === 'updated') {
    return { sort: 'updated', apiSort: 'updated' }
  }
  if (normalized === 'downloads' || normalized === 'download') {
    return { sort: 'downloads', apiSort: 'downloads' }
  }
  if (normalized === 'rating' || normalized === 'stars' || normalized === 'star') {
    return { sort: 'rating', apiSort: 'stars' }
  }
  if (
    normalized === 'installs' ||
    normalized === 'install' ||
    normalized === 'installscurrent' ||
    normalized === 'installs-current' ||
    normalized === 'current'
  ) {
    return { sort: 'installs', apiSort: 'installsCurrent' }
  }
  if (normalized === 'installsalltime' || normalized === 'installs-all-time') {
    return { sort: 'installsAllTime', apiSort: 'installsAllTime' }
  }
  if (normalized === 'trending') {
    return { sort: 'trending', apiSort: 'trending' }
  }
  fail(
    `Invalid sort "${raw}". Use newest, updated, downloads, rating, installs, installsAllTime, or trending.`,
  )
}

export function normalizeExploreTimeBound(raw: string | undefined, flag: string): string | undefined {
  const value = raw?.trim()
  if (!value) return undefined
  if (UNIX_TS_RE.test(value)) {
    fail(`${flag} must be YYYY-MM-DD or RFC3339 with timezone (unix timestamps are not allowed)`)
  }
  if (DATE_ONLY_RE.test(value)) return value
  if (Number.isNaN(Date.parse(value)) || !/(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    fail(`${flag} must be YYYY-MM-DD or RFC3339 with timezone`)
  }
  return value
}

export function normalizeExploreTimeField(raw?: string): 'created_at' | 'submitted_at' {
  const value = raw?.trim().toLowerCase()
  if (!value || value === 'created_at' || value === 'created') return 'created_at'
  if (value === 'submitted_at' || value === 'submitted') return 'submitted_at'
  fail(`Invalid --time-field "${raw}". Use created_at or submitted_at.`)
}

export function assertExploreTimeRange(from?: string, to?: string) {
  if (!from || !to) return
  const fromMs = Date.parse(from.length === 10 ? `${from}T00:00:00+08:00` : from)
  const toMs = Date.parse(to.length === 10 ? `${to}T23:59:59.999+08:00` : to)
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
    fail('Invalid --from/--to time values')
  }
  if (fromMs > toMs) {
    fail('--from must be less than or equal to --to')
  }
}

async function resolveSkillVersion(registry: string, slug: string, hash: string, token?: string) {
  const url = registryUrl(ApiRoutes.resolve, registry)
  url.searchParams.set('slug', slug)
  url.searchParams.set('hash', hash)
  return apiRequest(
    registry,
    { method: 'GET', url: url.toString(), token },
    ApiV1SkillResolveResponseSchema,
  )
}

async function fileExists(path: string) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}
