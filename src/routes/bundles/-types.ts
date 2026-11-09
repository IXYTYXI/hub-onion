import type { PublicBundle } from "../../lib/apiBundles";

export type BundleListEntry = {
  bundle: PublicBundle;
};

export function buildBundleHref(bundle: PublicBundle) {
  return `/bundles/${encodeURIComponent(bundle.slug)}`;
}
