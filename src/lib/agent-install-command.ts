import { getSkillRegistryForInstall } from './install-command'

export type InstallOs = 'unix' | 'windows'
export type InstallAgent = 'claude-code' | 'cursor' | 'codex-cli' | 'openclaw'

const AGENT_SKILL_DIRS: Record<InstallAgent, { unix: string; windows: string }> = {
  'claude-code': {
    unix: '~/.claude/skills',
    windows: '$env:USERPROFILE\\.claude\\skills',
  },
  cursor: {
    unix: '~/.cursor/skills',
    windows: '$env:USERPROFILE\\.cursor\\skills',
  },
  'codex-cli': {
    unix: '~/.codex/skills',
    windows: '$env:USERPROFILE\\.codex\\skills',
  },
  openclaw: {
    unix: '~/.openclaw/skills',
    windows: '$env:USERPROFILE\\.openclaw\\skills',
  },
}

export const INSTALL_AGENTS: Array<{ id: InstallAgent; labelKey: InstallAgent }> = [
  { id: 'claude-code', labelKey: 'claude-code' },
  { id: 'cursor', labelKey: 'cursor' },
  { id: 'codex-cli', labelKey: 'codex-cli' },
  { id: 'openclaw', labelKey: 'openclaw' },
]

export function buildSkillDownloadUrl(slug: string, version?: string | null) {
  const registry = getSkillRegistryForInstall()
  const params = new URLSearchParams({ slug })
  if (version) params.set('version', version)
  return `${registry}/api/v1/download?${params.toString()}`
}

export function buildBundleDownloadUrl(slug: string) {
  const registry = getSkillRegistryForInstall()
  return `${registry}/api/v1/bundles/${encodeURIComponent(slug)}/download`
}

export function buildAgentInstallCommand(options: {
  slug: string
  version?: string | null
  os: InstallOs
  agent: InstallAgent
}) {
  const { slug, version, os, agent } = options
  const downloadUrl = buildSkillDownloadUrl(slug, version)
  const baseDir = AGENT_SKILL_DIRS[agent][os]
  const targetDir = os === 'windows' ? `${baseDir}\\${slug}` : `${baseDir}/${slug}`
  const zipName = `${slug}.zip`

  if (os === 'windows') {
    return `New-Item -ItemType Directory -Force -Path "${targetDir}" | Out-Null; curl.exe -sL "${downloadUrl}" -o "$env:TEMP\\${zipName}"; Expand-Archive -Path "$env:TEMP\\${zipName}" -DestinationPath "${targetDir}" -Force; Remove-Item "$env:TEMP\\${zipName}"`
  }

  return `mkdir -p ${targetDir} && curl -sL "${downloadUrl}" -o /tmp/${zipName} && unzip -o /tmp/${zipName} -d ${targetDir} && rm /tmp/${zipName}`
}

export type SkillEntry = { slug: string; url: string }

export function buildBundleInstallCommand(options: {
  skills: SkillEntry[]
  os: InstallOs
  agent: InstallAgent
}) {
  const { skills, os, agent } = options
  const baseDir = AGENT_SKILL_DIRS[agent][os]

  if (skills.length === 0)
    return os === 'windows' ? 'Write-Host "No skills in bundle"' : 'echo "No skills in bundle"'

  if (os === 'windows') {
    const entries = skills.map((s) => `'${s.slug}|${s.url}'`).join(',')
    return (
      `foreach ($entry in @(${entries})) { ` +
      `$parts = $entry -split '\\|', 2; ` +
      `$slug = $parts[0]; ` +
      `$url = $parts[1]; ` +
      `$target = "${baseDir}\\$slug"; ` +
      `New-Item -ItemType Directory -Force -Path $target | Out-Null; ` +
      `curl.exe -fsSL $url -o "$env:TEMP\\$slug.zip"; ` +
      `Expand-Archive -Path "$env:TEMP\\$slug.zip" -DestinationPath $target -Force; ` +
      `Remove-Item "$env:TEMP\\$slug.zip" ` +
      `}`
    )
  }

  const unixBaseDir = baseDir.replace(/^~\//, '')
  const entries = skills
    .map((s, index) => `  "${s.slug}|${s.url}"${index === skills.length - 1 ? '' : ' \\'}`)
    .join('\n')
  const indent = '  '
  return (
    `for entry in \\\n${entries}\n` +
    `do\n` +
    `${indent}slug="\${entry%%|*}"\n` +
    `${indent}url="\${entry#*|}"\n` +
    `${indent}target="$HOME/${unixBaseDir}/$slug"\n` +
    `${indent}mkdir -p "$target" &&\n` +
    `${indent}curl -fsSL "$url" -o "/tmp/$slug.zip" &&\n` +
    `${indent}unzip -o "/tmp/$slug.zip" -d "$target" &&\n` +
    `${indent}rm -f "/tmp/$slug.zip"\n` +
    `done`
  )
}
