import type { BundleItem, BundleSkillItem, BundleStats, DocumentationLink } from "../types/api";
import type { PublicCategory, PublicUser } from "./publicUser";
import { mapOwnerInfoToPublicUser } from "./apiSkills";

export type PublicBundle = {
  _id: string;
  _creationTime: number;
  slug: string;
  displayName: string;
  description: string;
  documentationLinks: DocumentationLink[];
  summary?: string | null;
  owner?: PublicUser | null;
  categories: PublicCategory[];
  stats: BundleStats;
  skills: string[];
  createdAt: number;
  updatedAt: number;
};

export type BundleSkillListEntry = {
  slug: string;
  displayName?: string;
  summary?: string | null;
  version?: string | null;
  latestVersion?: BundleSkillItem["latestVersion"];
  owner?: PublicUser | null;
  ownerHandle?: string | null;
  categories: PublicCategory[];
  tags: string[];
  deleted: boolean;
};

function bundleSummary(item: BundleItem) {
  if (item.summary) return item.summary;
  if (!item.description) return null;
  const chars = Array.from(item.description);
  return chars.length > 120 ? chars.slice(0, 120).join("") : item.description;
}

export function mapBundleItemToPublicBundle(item: BundleItem): PublicBundle {
  return {
    _id: `bundle:${item.slug}`,
    _creationTime: item.createdAt,
    slug: item.slug,
    displayName: item.displayName,
    description: item.description,
    documentationLinks: item.documentationLinks ?? [],
    summary: bundleSummary(item),
    owner: mapOwnerInfoToPublicUser(item.owner),
    categories: item.categories ?? [],
    stats: item.stats,
    skills: item.skills ?? [],
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function mapBundleSkillItemToListEntry(item: BundleSkillItem): BundleSkillListEntry {
  const owner = mapOwnerInfoToPublicUser(item.owner);
  return {
    slug: item.slug,
    displayName: item.displayName,
    summary: item.summary,
    version: item.version ?? item.latestVersion?.version ?? null,
    latestVersion: item.latestVersion,
    owner,
    ownerHandle: owner?.handle ?? null,
    categories: item.categories ?? [],
    tags: Array.isArray(item.tags) ? item.tags : [],
    deleted: item.deleted === true,
  };
}
