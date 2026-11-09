import { describe, expect, it, vi } from 'vitest'
import {
  buildAgentInstallCommand,
  buildSkillDownloadUrl,
} from './agent-install-command'

vi.mock('./install-command', () => ({
  getSkillRegistryForInstall: () => 'https://registry.example.com',
}))

describe('agent-install-command', () => {
  it('builds download url with slug and version', () => {
    expect(buildSkillDownloadUrl('demo-skill', '1.2.0')).toBe(
      'https://registry.example.com/api/v1/download?slug=demo-skill&version=1.2.0',
    )
  })

  it('builds unix install command for Claude Code', () => {
    const command = buildAgentInstallCommand({
      slug: 'demo-skill',
      version: '1.0.0',
      os: 'unix',
      agent: 'claude-code',
    })

    expect(command).toContain('mkdir -p ~/.claude/skills/demo-skill')
    expect(command).toContain(
      'curl -sL "https://registry.example.com/api/v1/download?slug=demo-skill&version=1.0.0"',
    )
    expect(command).toContain('unzip -o /tmp/demo-skill.zip -d ~/.claude/skills/demo-skill')
  })

  it('builds windows install command for Cursor', () => {
    const command = buildAgentInstallCommand({
      slug: 'demo-skill',
      os: 'windows',
      agent: 'cursor',
    })

    expect(command).toContain('$env:USERPROFILE\\.cursor\\skills\\demo-skill')
    expect(command).toContain('Expand-Archive')
    expect(command).toContain(
      'curl.exe -sL "https://registry.example.com/api/v1/download?slug=demo-skill"',
    )
  })
})
