import { useMemo, useState } from "react";
import type { PublicBundle } from "../lib/apiBundles";
import { bundlesCopy } from "../copy/bundles";
import {
  buildBundleDownloadUrl,
  buildBundleInstallCommand,
  buildSkillDownloadUrl,
  INSTALL_AGENTS,
  type InstallAgent,
  type InstallOs,
  type SkillEntry,
} from "../lib/agent-install-command";
import { InstallCommandShell } from "./InstallCommandShell";

type BundleInstallCardProps = {
  bundle: PublicBundle;
};

export function BundleInstallCard({ bundle }: BundleInstallCardProps) {
  const copy = bundlesCopy.detail.installMethods;
  const [agent, setAgent] = useState<InstallAgent>("claude-code");
  const [os, setOs] = useState<InstallOs>("unix");

  const skillEntries = useMemo<SkillEntry[]>(
    () => bundle.skills.map((s) => ({ slug: s, url: buildSkillDownloadUrl(s) })),
    [bundle.skills],
  );
  const cliCommand = useMemo(
    () => buildBundleInstallCommand({ skills: skillEntries, os, agent }),
    [agent, skillEntries, os],
  );
  const downloadUrl = useMemo(() => buildBundleDownloadUrl(bundle.slug), [bundle.slug]);
  const agentPrompt = `帮我安装技能包 ${bundle.displayName}，包含以下技能：
${skillEntries.map((e) => `- ${e.slug}: ${e.url}`).join("\n")}`;

  return (
    <section className="card skill-cli-install" aria-labelledby="bundle-cli-install-title">
      <div className="skill-cli-install-header">
        <div>
          <h2 id="bundle-cli-install-title" className="section-title">
            {copy.title}
          </h2>
          <p className="section-subtitle skill-cli-install-subtitle">{copy.subtitle}</p>
        </div>
      </div>

      <div className="skill-cli-install-block">
        <div className="skill-cli-install-label">{copy.cliLabel}</div>
        <div className="skill-cli-install-controls">
          <div
            className="install-switcher-toggle skill-cli-install-agent-toggle"
            role="tablist"
            aria-label={copy.agentAria}
          >
            {INSTALL_AGENTS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={
                  agent === entry.id ? "install-switcher-pill is-active" : "install-switcher-pill"
                }
                role="tab"
                aria-selected={agent === entry.id}
                onClick={() => setAgent(entry.id)}
              >
                {copy.agents[entry.labelKey]}
              </button>
            ))}
          </div>
          <div className="install-switcher-toggle" role="tablist" aria-label={copy.osAria}>
            {(
              [
                { id: "unix" as const, label: copy.os.unix },
                { id: "windows" as const, label: copy.os.windows },
              ] as const
            ).map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={
                  os === entry.id ? "install-switcher-pill is-active" : "install-switcher-pill"
                }
                role="tab"
                aria-selected={os === entry.id}
                onClick={() => setOs(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
        <InstallCommandShell
          command={cliCommand}
          copyLabel={copy.copy}
          copiedLabel={copy.copied}
          copyAriaLabel={copy.copyCliAriaLabel}
          copiedAriaLabel={copy.copiedCliAriaLabel}
        />
      </div>

      <div className="skill-cli-install-block">
        <div className="skill-cli-install-label">{copy.sendToAgentLabel}</div>
        <InstallCommandShell
          command={agentPrompt}
          copyLabel={copy.copyPrompt}
          copiedLabel={copy.copied}
          copyAriaLabel={copy.copyPromptAriaLabel}
          copiedAriaLabel={copy.copiedPromptAriaLabel}
        />
      </div>

      <div className="skill-cli-install-block">
        <div className="skill-cli-install-label">{copy.manualLabel}</div>
        <a className="btn btn-primary skill-cli-install-download" href={downloadUrl}>
          {copy.downloadZip}
        </a>
      </div>
    </section>
  );
}
