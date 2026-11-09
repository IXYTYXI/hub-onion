// API types matching Go backend responses

export interface Skill {
  id: string;
  slug: string;
  displayName: string;
  description?: string;
  tags: string[];
  documentationLinks: DocumentationLink[];
  moderationStatus: string;
  latestVersionId?: string;
  createdAt: string;
  updatedAt: string;
  latestVersion?: VersionInfo;
}

export interface VersionInfo {
  version: string;
  createdAt: number;
  changelog: string;
  files?: Array<{
    path: string;
    size: number;
    storageKey: string;
    sha256: string;
    contentType?: string;
  }>;
  parsed?: unknown;
}

export interface SkillVersionResponse {
  version?: VersionInfo | null;
  skill?: {
    slug: string;
    displayName: string;
  } | null;
}

export interface SkillStats {
  downloads: number;
  installs: number;
  versions: number;
  stars?: number;
}

export interface DocumentationLink {
  title?: string;
  url: string;
}

export interface Category {
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
}

export interface CategoryListResponse {
  items: Category[];
  nextCursor?: string | null;
}

export interface SkillItem {
  slug: string;
  displayName: string;
  summary?: string | null;
  owner?: OwnerInfo | null;
  tags: string[] | string;
  documentationLinks?: DocumentationLink[];
  categories?: Category[];
  stats: SkillStats;
  highlighted: boolean;
  createdAt: number;
  updatedAt: number;
  latestVersion?: VersionInfo;
}

export interface SkillListResponse {
  items: SkillItem[];
  nextCursor: string | null;
}

export interface BundleStats {
  downloads: number;
  installs: number;
  skills: number;
}

export interface BundleItem {
  slug: string;
  displayName: string;
  description: string;
  documentationLinks?: DocumentationLink[];
  summary?: string | null;
  owner?: OwnerInfo | null;
  categories?: Category[];
  stats: BundleStats;
  skills: string[];
  createdAt: number;
  updatedAt: number;
}

export interface BundleListResponse {
  items: BundleItem[];
  nextCursor: string | null;
}

export interface BundleSkillItem {
  slug: string;
  displayName?: string;
  summary?: string | null;
  version?: string | null;
  latestVersion?: VersionInfo | null;
  owner?: OwnerInfo | null;
  categories?: Category[];
  tags?: string[] | string;
  deleted?: boolean;
}

export interface BundleDetailResponse {
  bundle: BundleItem;
  skills: BundleSkillItem[];
  missingSkills?: string[];
}

export interface AdminBundleDetailResponse {
  bundle: BundleItem & {
    id: string;
    isDeleted: boolean;
    status: string;
  };
  isDeleted: boolean;
  status: string;
  skills?: BundleSkillItem[];
  missingSkills?: string[];
}

export interface PublishBundlePayload {
  slug: string;
  displayName: string;
  description: string;
  documentationLinks?: DocumentationLink[];
  categorySlugs?: string[];
  skills: Array<{ slug: string; sortOrder?: number }>;
}

export interface PublishBundleResponse {
  ok: string;
  bundleId: string;
}

export interface SkillDetailResponse {
  skill: SkillItem;
  latestVersion?: VersionInfo | null;
  owner?: OwnerInfo | null;
}

export interface VersionListResponse {
  items: VersionInfo[];
  nextCursor: string | null;
}

export interface OwnerInfo {
  handle?: string | null;
  displayName?: string | null;
  image?: string | null;
}

export interface ManagedOwnerInfo {
  id?: string;
  handle?: string | null;
  displayName?: string | null;
  email?: string | null;
  status?: string | null;
}

export interface ManagedSkillItem extends SkillItem {
  id: string;
  isDeleted: boolean;
  status: string;
  owner?: ManagedOwnerInfo | null;
}

export interface ManagedSkillListResponse {
  items: ManagedSkillItem[];
}

export interface ManagedSkillDetailResponse {
  skill: ManagedSkillItem;
  versions: VersionInfo[];
  owner?: ManagedOwnerInfo | null;
  currentStatus: string;
}

export interface SkillDescriptionSyncResponse {
  running: boolean;
  locked: boolean;
  msg: string;
  scanned: number;
  updated: number;
  skipped: number;
  failed: number;
}

export interface ConfiguredSuperuser {
  provider: "feishu";
  email: string;
  source: "config";
  readOnly: true;
}

export interface DynamicSuperuser {
  id: string;
  provider: "feishu";
  email: string;
  source: "dynamic";
  createdBy?: string | null;
  createdAt?: string | null;
}

export interface SuperuserListResponse {
  configured: ConfiguredSuperuser[];
  dynamic: DynamicSuperuser[];
}

export interface SuperuserCacheSyncResponse {
  ok: boolean;
  configuredCount: number;
  dynamicCount: number;
}

export interface AdminUserSummary {
  id: string;
  handle: string;
  displayName: string;
  email: string;
  avatarUrl?: string | null;
  bio?: string | null;
  role?: string | null;
  status: string;
  authProvider: string;
  pendingEmail?: string | null;
  hasBoundEmail?: boolean;
  emailVerifiedAt?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string;
  isSuperuser?: boolean;
  skills?: ManagedSkillItem[];
}

export interface PublicUserProfile {
  id: string;
  handle: string;
  displayName: string;
  email?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  createdAt: number;
}

export interface SearchResult {
  slug: string;
  displayName: string;
  summary?: string | null;
  version?: string | null;
  score: number;
  updatedAt?: number | null;
  owner?: OwnerInfo | null;
  stats?: SkillStats;
  latestVersion?: VersionInfo | null;
  categories?: Category[];
}

export interface SearchResponse {
  results: SearchResult[];
}

export interface PublishPayload {
  slug: string;
  displayName: string;
  version: string;
  changelog: string;
  tags: string[];
  categorySlugs?: string[];
  documentationLinks?: DocumentationLink[];
}

export interface PublishResponse {
  ok: "true";
  skillId: string;
  versionId: string;
}

export interface ResolveResponse {
  match?: { version: string } | null;
  latestVersion?: { version: string } | null;
}
