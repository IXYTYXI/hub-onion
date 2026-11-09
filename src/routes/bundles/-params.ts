export const bundleSortKeys = ["newest", "downloads", "name", "updated"] as const;

export type BundleSortKey = (typeof bundleSortKeys)[number];
export type BundleSortDir = "asc" | "desc";

export function parseBundleSort(value: unknown): BundleSortKey {
  if (typeof value !== "string") return "downloads";
  if ((bundleSortKeys as readonly string[]).includes(value)) return value as BundleSortKey;
  return "downloads";
}

export function parseBundleDir(value: unknown, sort: BundleSortKey): BundleSortDir {
  if (value === "asc" || value === "desc") return value;
  return sort === "name" ? "asc" : "desc";
}

export function toBundleListSort(sort: BundleSortKey) {
  return sort === "newest" ? "updated" : sort;
}
