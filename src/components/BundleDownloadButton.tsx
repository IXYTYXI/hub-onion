import { bundlesCopy } from "../copy/bundles";
import { buildBundleDownloadUrl } from "../lib/agent-install-command";

type BundleDownloadButtonProps = {
  slug: string;
  label?: string;
  className?: string;
  disabled?: boolean;
};

export function BundleDownloadButton({
  slug,
  label = bundlesCopy.detail.installMethods.downloadZip,
  className = "btn btn-primary",
  disabled = false,
}: BundleDownloadButtonProps) {
  const href = buildBundleDownloadUrl(slug);

  if (disabled) {
    return (
      <span className={`${className} is-disabled`} aria-disabled="true">
        {label}
      </span>
    );
  }

  return (
    <a className={className} href={href}>
      {label}
    </a>
  );
}
