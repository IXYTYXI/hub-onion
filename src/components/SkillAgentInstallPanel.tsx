import { useMemo, useState } from 'react'
import { skillsCopy } from '../copy/skills'
import {
  buildAgentInstallCommand,
  INSTALL_AGENTS,
  type InstallAgent,
  type InstallOs,
} from '../lib/agent-install-command'
import { InstallCommandShell } from './InstallCommandShell'

type SkillAgentInstallPanelProps = {
  slug: string
  version?: string | null
}

export function SkillAgentInstallPanel({ slug, version }: SkillAgentInstallPanelProps) {
  const copy = skillsCopy.detail.howToInstall
  const [os, setOs] = useState<InstallOs>('unix')
  const [agent, setAgent] = useState<InstallAgent>('claude-code')

  const command = useMemo(
    () => buildAgentInstallCommand({ slug, version, os, agent }),
    [agent, os, slug, version],
  )

  return (
    <div className="skill-agent-install">
      <div className="skill-agent-install-header">
        <div className="skill-agent-install-copy">
          <div className="skill-quick-install-title">{copy.title}</div>
          <p className="section-subtitle skill-quick-install-subtitle">{copy.subtitle}</p>
        </div>
        <div
          className="install-switcher-toggle skill-agent-install-os-toggle"
          role="tablist"
          aria-label={copy.osAria}
        >
          {(
            [
              { id: 'unix' as const, label: copy.os.unix },
              { id: 'windows' as const, label: copy.os.windows },
            ] as const
          ).map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={os === entry.id ? 'install-switcher-pill is-active' : 'install-switcher-pill'}
              role="tab"
              aria-selected={os === entry.id}
              onClick={() => setOs(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="install-switcher-toggle skill-agent-install-agent-toggle"
        role="tablist"
        aria-label={copy.agentAria}
      >
        {INSTALL_AGENTS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={
              agent === entry.id ? 'install-switcher-pill is-active' : 'install-switcher-pill'
            }
            role="tab"
            aria-selected={agent === entry.id}
            onClick={() => setAgent(entry.id)}
          >
            {copy.agents[entry.id]}
          </button>
        ))}
      </div>

      <InstallCommandShell
        command={command}
        copyLabel={copy.copy}
        copiedLabel={copy.copied}
        copyAriaLabel={copy.copyAriaLabel}
        copiedAriaLabel={copy.copiedAriaLabel}
      />
    </div>
  )
}
