import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { BundleDownloadButton } from "../components/BundleDownloadButton";
import type {
  Category,
  CategoryListResponse,
  ManagedSkillListResponse,
  SkillDescriptionSyncResponse,
} from "../types/api";
import { managementCopy } from "../copy/management";
import {
  useAdminBundleAction,
  useAdminBundleCategoriesAction,
} from "../hooks/useAdminBundleActions";
import { useAdminBundles, type AdminBundleListEntry } from "../hooks/useAdminBundles";
import {
  useAddAdminSuperuser,
  useAdminSuperusers,
  useRemoveAdminSuperuser,
  useSyncAdminSuperuserCache,
} from "../hooks/useAdminSuperusers";
import { ApiError, apiRequest } from "../lib/apiClient";
import { getApiBase } from "../lib/env";
import { formatUnixSeconds } from "../lib/formatUnixSeconds";
import { useAuthStatus } from "../lib/useAuthStatus";

type ManagementTab = "skills" | "bundles" | "maintenance" | "categories" | "superusers";
type SkillSortKey = "updated_at" | "created_at" | "submitted_at";
type SkillSortDir = "asc" | "desc";
type SkillTimeField = "created_at" | "submitted_at";
const CATEGORY_PAGE_SIZE = 20;
const CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeManagementTab(tab: unknown): ManagementTab {
  return tab === "bundles" || tab === "maintenance" || tab === "categories" || tab === "superusers"
    ? tab
    : "skills";
}

function parseSkillSort(value: unknown): SkillSortKey {
  if (value === "created_at" || value === "submitted_at") return value;
  return "updated_at";
}

function parseSkillDir(value: unknown): SkillSortDir {
  return value === "asc" ? "asc" : "desc";
}

function parseTimeField(value: unknown): SkillTimeField {
  return value === "submitted_at" ? "submitted_at" : "created_at";
}

function parseDateOnly(value: unknown): string | undefined {
  return typeof value === "string" && DATE_ONLY_PATTERN.test(value) ? value : undefined;
}

export const Route = createFileRoute("/management")({
  component: Management,
  validateSearch: (search) => ({
    tab: normalizeManagementTab(search.tab),
    status: typeof search.status === "string" ? search.status : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
    sort: parseSkillSort(search.sort),
    dir: parseSkillDir(search.dir),
    timeField: parseTimeField(search.timeField),
    createdFrom: parseDateOnly(search.createdFrom),
    createdTo: parseDateOnly(search.createdTo),
  }),
});

type AdminSkillQuery = {
  status?: string;
  q?: string;
  sort: SkillSortKey;
  dir: SkillSortDir;
  timeField: SkillTimeField;
  createdFrom?: string;
  createdTo?: string;
};

function buildAdminSkillsSearchParams(query: AdminSkillQuery) {
  const search = new URLSearchParams();
  if (query.status) search.set("status", query.status);
  if (query.q) search.set("q", query.q);
  search.set("sort", query.sort);
  search.set("dir", query.dir);
  search.set("timeField", query.timeField);
  if (query.createdFrom) search.set("createdFrom", query.createdFrom);
  if (query.createdTo) search.set("createdTo", query.createdTo);
  return search;
}

async function fetchAdminSkills(query: AdminSkillQuery) {
  const search = buildAdminSkillsSearchParams(query);
  return (await apiRequest<ManagedSkillListResponse>(`/admin/skills?${search.toString()}`)) ?? { items: [] };
}

function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].trim());
    } catch {
      return utfMatch[1].trim();
    }
  }
  const plainMatch = /filename="?([^";]+)"?/i.exec(header);
  return plainMatch?.[1]?.trim() || null;
}

async function downloadAdminSkillsCsv(query: AdminSkillQuery) {
  const search = buildAdminSkillsSearchParams(query);
  const response = await fetch(`${getApiBase()}/admin/skills/export?${search.toString()}`, {
    credentials: "include",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(
      (error as { error?: string }).error || "Request failed",
      response.status,
      error,
    );
  }
  const blob = await response.blob();
  const filename =
    parseContentDispositionFilename(response.headers.get("Content-Disposition")) ||
    "skills-export.csv";
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

async function fetchAdminCategories(options?: { q?: string; cursor?: string; limit?: number }) {
  const params = new URLSearchParams();
  params.set("limit", String(options?.limit ?? CATEGORY_PAGE_SIZE));
  if (options?.q) params.set("q", options.q);
  if (options?.cursor) params.set("cursor", options.cursor);
  return (await apiRequest<CategoryListResponse>(`/admin/categories?${params.toString()}`)) ?? { items: [] };
}

async function syncMissingSkillDescriptions() {
  return apiRequest<SkillDescriptionSyncResponse>("/admin/maintenance/skill-descriptions/sync", {
    method: "POST",
  });
}

function formatOwnerLabel(skill: ManagedSkillListResponse["items"][number], unknownOwner: string) {
  const email = skill.owner?.email?.trim();
  if (email) {
    return email;
  }

  const handle = skill.owner?.handle?.trim();
  if (handle) {
    return `@${handle}`;
  }

  return unknownOwner;
}

function formatBundleOwnerLabel(entry: AdminBundleListEntry, unknownOwner: string) {
  const handle = entry.bundle.owner?.handle?.trim();
  if (handle) return `@${handle}`;
  return entry.bundle.owner?.displayName?.trim() || unknownOwner;
}

function getNextCategorySortOrder(categories: Category[]) {
  if (categories.length === 0) return 10;
  const maxSortOrder = categories.reduce(
    (max, category) => Math.max(max, Number.isFinite(category.sortOrder) ? category.sortOrder : 0),
    0,
  );
  return Math.floor(maxSortOrder / 10) * 10 + 10;
}

function Management() {
  const copy = managementCopy;
  const { me, isLoading } = useAuthStatus();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const activeTab = normalizeManagementTab(search.tab);
  const status = search.status ?? "all";
  const q = search.q ?? "";
  const sort = parseSkillSort(search.sort);
  const dir = parseSkillDir(search.dir);
  const timeField = parseTimeField(search.timeField);
  const createdFrom = search.createdFrom;
  const createdTo = search.createdTo;
  const adminBundleStatus = status === "active" || status === "deleted" ? status : "all";
  const [categoryForm, setCategoryForm] = useState({
    slug: "",
    name: "",
    description: "",
    sortOrder: "10",
  });
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryFormError, setCategoryFormError] = useState<string | null>(null);
  const [categorySortTouched, setCategorySortTouched] = useState(false);
  const [editingCategorySlug, setEditingCategorySlug] = useState<string | null>(null);
  const [skillCategoryDrafts, setSkillCategoryDrafts] = useState<Record<string, string[]>>({});
  const [bundleCategoryDrafts, setBundleCategoryDrafts] = useState<Record<string, string[]>>({});
  const [superuserEmail, setSuperuserEmail] = useState("");
  const [superuserFormError, setSuperuserFormError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const adminSkillQuery: AdminSkillQuery = {
    status: status === "all" ? undefined : status,
    q: q.trim() || undefined,
    sort,
    dir,
    timeField,
    createdFrom,
    createdTo,
  };

  const skillListQuery = useQuery({
    queryKey: ["admin", "skills", adminSkillQuery],
    queryFn: () => fetchAdminSkills(adminSkillQuery),
    enabled: me?.isSuperuser === true && activeTab === "skills",
    retry: false,
  });

  const exportCsvAction = useMutation({
    mutationFn: () => downloadAdminSkillsCsv(adminSkillQuery),
    onMutate: () => setExportError(null),
    onError: (error) => {
      setExportError(error instanceof Error ? error.message : copy.filters.skills.exportFailed);
    },
  });

  const categoriesQuery = useQuery({
    queryKey: ["admin", "categories", "selector"],
    queryFn: () => fetchAdminCategories({ limit: 100 }),
    enabled: me?.isSuperuser === true && (activeTab === "skills" || activeTab === "bundles"),
    retry: false,
  });

  const adminBundlesQuery = useAdminBundles({
    status: adminBundleStatus,
    q: q.trim() || undefined,
    enabled: me?.isSuperuser === true && activeTab === "bundles",
  });

  const adminCategoriesQuery = useInfiniteQuery({
    queryKey: ["admin", "categories", "page", categorySearch.trim()],
    queryFn: ({ pageParam }) =>
      fetchAdminCategories({
        q: categorySearch.trim() || undefined,
        cursor: pageParam,
        limit: CATEGORY_PAGE_SIZE,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: me?.isSuperuser === true && activeTab === "categories",
    retry: false,
  });

  const adminSuperusersQuery = useAdminSuperusers(
    me?.isSuperuser === true && activeTab === "superusers",
  );

  const skillAction = useMutation({
    mutationFn: ({ slug, type }: { slug: string; type: "delete" | "undelete" }) =>
      apiRequest(`/admin/skills/${slug}/${type === "delete" ? "delete" : "undelete"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "skills"] });
    },
  });
  const bundleAction = useAdminBundleAction();
  const bundleCategoriesAction = useAdminBundleCategoriesAction();

  const syncDescriptionsAction = useMutation({
    mutationFn: syncMissingSkillDescriptions,
  });

  const highlightedAction = useMutation({
    mutationFn: ({ slug, highlighted }: { slug: string; highlighted: boolean }) =>
      apiRequest(`/admin/skills/${slug}/highlighted`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ highlighted }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "skills"] });
    },
  });

  const categoryAction = useMutation({
    mutationFn: async (
      action:
        | { type: "create"; payload: { slug: string; name: string; description: string; sortOrder: number } }
        | { type: "update"; slug: string; payload: { name: string; description: string; sortOrder: number } }
        | { type: "delete"; slug: string },
    ) => {
      if (action.type === "create") {
        return apiRequest<Category>("/admin/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action.payload),
        });
      }
      if (action.type === "update") {
        return apiRequest<Category>(`/admin/categories/${encodeURIComponent(action.slug)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action.payload),
        });
      }
      return apiRequest(`/admin/categories/${encodeURIComponent(action.slug)}`, { method: "DELETE" });
    },
    onSuccess: async () => {
      setCategoryForm({ slug: "", name: "", description: "", sortOrder: String(suggestedCategorySortOrder) });
      setCategoryFormError(null);
      setCategorySortTouched(false);
      setEditingCategorySlug(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      await queryClient.invalidateQueries({ queryKey: ["categories", "list"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "skills"] });
      await queryClient.invalidateQueries({ queryKey: ["skills", "list"] });
      await queryClient.invalidateQueries({ queryKey: ["skills", "search"] });
    },
  });

  const skillCategoriesAction = useMutation({
    mutationFn: ({ slug, categorySlugs }: { slug: string; categorySlugs: string[] }) =>
      apiRequest(`/admin/skills/${encodeURIComponent(slug)}/categories`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categorySlugs }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "skills"] });
      await queryClient.invalidateQueries({ queryKey: ["categories", "list"] });
      await queryClient.invalidateQueries({ queryKey: ["skills", "list"] });
      await queryClient.invalidateQueries({ queryKey: ["skills", "search"] });
    },
  });

  const addSuperuserAction = useAddAdminSuperuser();
  const removeSuperuserAction = useRemoveAdminSuperuser();
  const syncSuperuserCacheAction = useSyncAdminSuperuserCache();

  const adminCategoryItems = adminCategoriesQuery.data?.pages.flatMap((page) => page.items ?? []) ?? [];
  const suggestedCategorySortOrder = getNextCategorySortOrder(adminCategoryItems);

  useEffect(() => {
    const items = skillListQuery.data?.items ?? [];
    if (items.length === 0) return;
    setSkillCategoryDrafts((current) => {
      const next = { ...current };
      for (const skill of items) {
        if (!next[skill.slug]) {
          next[skill.slug] = (skill.categories ?? []).map((category) => category.slug);
        }
      }
      return next;
    });
  }, [skillListQuery.data?.items]);

  useEffect(() => {
    const items = adminBundlesQuery.data?.items ?? [];
    if (items.length === 0) return;
    setBundleCategoryDrafts((current) => {
      const next = { ...current };
      for (const entry of items) {
        const bundle = entry.bundle;
        if (!next[bundle.slug]) {
          next[bundle.slug] = (bundle.categories ?? []).map((category) => category.slug);
        }
      }
      return next;
    });
  }, [adminBundlesQuery.data?.items]);

  useEffect(() => {
    if (activeTab !== "categories" || editingCategorySlug || categorySortTouched) return;
    setCategoryForm((current) => {
      const nextSortOrder = String(suggestedCategorySortOrder);
      return current.sortOrder === nextSortOrder ? current : { ...current, sortOrder: nextSortOrder };
    });
  }, [activeTab, categorySortTouched, editingCategorySlug, suggestedCategorySortOrder]);

  if (isLoading) {
    return (
      <main className="section">
        <div className="card">
          <div className="loading-indicator">{copy.loading}</div>
        </div>
      </main>
    );
  }

  if (!me) {
    return (
      <main className="section">
        <div className="card">{copy.signInRequired}</div>
      </main>
    );
  }

  if (me.isSuperuser !== true) {
    return (
      <main className="section">
        <div className="card">{copy.noAccess}</div>
      </main>
    );
  }

  const permissionError =
    (skillListQuery.error instanceof ApiError && skillListQuery.error.status === 403) ||
    (adminBundlesQuery.error instanceof ApiError && adminBundlesQuery.error.status === 403);
  if (permissionError) {
    return (
      <main className="section">
        <div className="card">{copy.noAccess}</div>
      </main>
    );
  }

  const renderSkillActions = (skill: {
    slug: string;
    isDeleted: boolean;
    highlighted: boolean;
  }) => (
    <>
      <button
        className="btn btn-secondary btn-sm"
        type="button"
        disabled={highlightedAction.isPending}
        onClick={() =>
          highlightedAction.mutate({ slug: skill.slug, highlighted: !skill.highlighted })
        }
      >
        {skill.highlighted ? copy.actions.unhighlight : copy.actions.highlight}
      </button>
      <button
        className="btn btn-secondary btn-sm"
        type="button"
        disabled={skillAction.isPending}
        onClick={() =>
          skillAction.mutate({ slug: skill.slug, type: skill.isDeleted ? "undelete" : "delete" })
        }
      >
        {skill.isDeleted ? (
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
        ) : (
          <Trash2 className="h-3 w-3" aria-hidden="true" />
        )}
        {skill.isDeleted ? copy.actions.restore : copy.actions.delete}
      </button>
    </>
  );

  const setTab = (tab: ManagementTab) => {
    void navigate({
      to: "/management",
      search: (prev) => ({ ...prev, tab }),
    });
  };

  const renderTabs = () => {
    const tabs: Array<{
      id: ManagementTab;
      label: string;
      kicker: string;
      description: string;
    }> = [
      {
        id: "skills",
        label: copy.tabs.skills,
        kicker: "Library Ops",
        description: "审核、删除、精选，以及调整 skill 分类。",
      },
      {
        id: "bundles",
        label: copy.tabs.bundles,
        kicker: "Bundle Ops",
        description: "删除、恢复、编辑和调整技能包分类。",
      },
      {
        id: "maintenance",
        label: copy.tabs.maintenance,
        kicker: "Repair Jobs",
        description: "运行低频维护任务，补齐缺失数据。",
      },
      {
        id: "categories",
        label: copy.tabs.categories,
        kicker: "Taxonomy",
        description: "维护上传、导入和浏览筛选使用的分类。",
      },
      {
        id: "superusers",
        label: copy.tabs.superusers,
        kicker: "Access Control",
        description: "查看配置管理员，并维护动态飞书管理员。",
      },
    ];

    return (
      <nav className="management-tab-deck" aria-label="管理后台导航">
        <div className="management-tab-deck-header">
          <span className="management-tab-kicker">Management Deck</span>
          <p>技能生命周期、维护任务和分类体系统一入口。</p>
        </div>
        <div className="management-tab-list" role="tablist" aria-label="管理后台分区">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`management-tab-card${isActive ? " is-active" : ""}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={tab.label}
                onClick={() => setTab(tab.id)}
              >
                <span className="management-tab-card-kicker">{tab.kicker}</span>
                <span className="management-tab-card-title">{tab.label}</span>
                <span className="management-tab-card-desc">{tab.description}</span>
              </button>
            );
          })}
        </div>
      </nav>
    );
  };

  const renderMaintenance = () => {
    const result = syncDescriptionsAction.data;
    const error = syncDescriptionsAction.error;
    const permissionDenied = error instanceof ApiError && error.status === 403;
    const isRunning = result?.running === true && result.locked === true;
    const maintenanceMetrics =
      result && !isRunning
        ? [
            { label: copy.maintenance.stats.scanned, value: result.scanned },
            { label: copy.maintenance.stats.updated, value: result.updated },
            { label: copy.maintenance.stats.skipped, value: result.skipped },
            { label: copy.maintenance.stats.failed, value: result.failed, danger: result.failed > 0 },
          ]
        : [];

    return (
      <div className="tab-body maintenance-console">
        <section className="maintenance-hero-panel">
          <div>
            <p className="maintenance-eyebrow">Maintenance Console</p>
            <h2 className="maintenance-title">维护任务控制台</h2>
            <p className="maintenance-copy">
              集中执行低频但影响全站数据质量的后台任务。当前任务会扫描正常状态的技能并补齐缺失简介。
            </p>
          </div>
          <div className="maintenance-hero-badge">
            <span>OPS</span>
            <small>superuser only</small>
          </div>
        </section>

        <div className="maintenance-grid">
          <section className="maintenance-task-card">
            <div className="maintenance-task-header">
              <span className="maintenance-eyebrow">可执行任务</span>
              <h3>{copy.maintenance.title}</h3>
              <p>{copy.maintenance.description}</p>
            </div>
            <div className="maintenance-rule-list" aria-label="维护任务执行说明">
              <div>
                <strong>安全执行窗口</strong>
                <span>只处理正常状态的技能，不会恢复或修改已删除技能。</span>
              </div>
              <div>
                <strong>数据来源</strong>
                <span>优先读取最新版本根目录的 SKILL.md，其次读取 skills.md。</span>
              </div>
              <div>
                <strong>幂等更新</strong>
                <span>已有简介会跳过，失败项会在结果中单独计数。</span>
              </div>
            </div>
            <button
              className="btn btn-primary maintenance-run-button"
              type="button"
              disabled={syncDescriptionsAction.isPending}
              onClick={() => syncDescriptionsAction.mutate()}
            >
              {syncDescriptionsAction.isPending ? copy.maintenance.pending : copy.maintenance.action}
            </button>
          </section>

          <section className="maintenance-result-panel">
            <div className="maintenance-result-header">
              <span className="maintenance-eyebrow">执行反馈</span>
              <p>任务返回后会在这里展示运行状态和处理数量。</p>
            </div>
            {permissionDenied ? <p className="maintenance-status is-danger">{copy.noAccess}</p> : null}
            {error && !permissionDenied ? (
              <p className="maintenance-status is-danger">{copy.maintenance.syncFailed}</p>
            ) : null}
            {isRunning ? <p className="maintenance-status is-running">{result.msg}</p> : null}
            {result && !isRunning ? (
              <>
                <p className={result.failed > 0 ? "maintenance-status is-danger" : "maintenance-status"}>
                  {result.failed > 0 ? copy.maintenance.partialFailed : result.msg}
                </p>
                <div className="maintenance-metrics">
                  {maintenanceMetrics.map((metric) => (
                    <div
                      key={metric.label}
                      className={`maintenance-metric${metric.danger ? " is-danger" : ""}`}
                    >
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
            {!error && !result ? (
              <div className="maintenance-empty-state">
                <strong>等待执行</strong>
                <span>点击左侧按钮后，将显示扫描、更新、跳过和失败数量。</span>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    );
  };

  const startEditCategory = (category: Category) => {
    setEditingCategorySlug(category.slug);
    setCategoryFormError(null);
    setCategorySortTouched(false);
    setCategoryForm({
      slug: category.slug,
      name: category.name,
      description: category.description ?? "",
      sortOrder: String(category.sortOrder ?? 0),
    });
  };

  const submitCategoryForm = (event: FormEvent) => {
    event.preventDefault();
    const slug = categoryForm.slug.trim();
    const name = categoryForm.name.trim();
    const description = categoryForm.description.trim();
    const sortOrder = Number.parseInt(categoryForm.sortOrder, 10) || 0;
    if (!slug) {
      setCategoryFormError("请填写分类 slug。");
      return;
    }
    if (!CATEGORY_SLUG_PATTERN.test(slug)) {
      setCategoryFormError("slug 只能包含小写字母、数字和短横线。");
      return;
    }
    if (slug === "uncategorized") {
      setCategoryFormError("uncategorized 是虚拟未分类筛选，不能创建为真实分类。");
      return;
    }
    if (!name) {
      setCategoryFormError("请填写分类名称。");
      return;
    }
    setCategoryFormError(null);
    if (editingCategorySlug) {
      categoryAction.mutate({
        type: "update",
        slug: editingCategorySlug,
        payload: { name, description, sortOrder },
      });
      return;
    }
    if (!slug) return;
    categoryAction.mutate({
      type: "create",
      payload: { slug, name, description, sortOrder },
    });
  };

  const submitSuperuserForm = (event: FormEvent) => {
    event.preventDefault();
    const email = superuserEmail.trim().toLowerCase();
    if (!email) {
      setSuperuserFormError(copy.superusers.validationRequired);
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      setSuperuserFormError(copy.superusers.validationInvalid);
      return;
    }
    setSuperuserFormError(null);
    addSuperuserAction.mutate(email, {
      onSuccess: () => {
        setSuperuserEmail("");
      },
    });
  };

  const renderCategorySelector = (skill: ManagedSkillListResponse["items"][number]) => {
    const categoryOptions = (categoriesQuery.data?.items ?? []).filter(
      (item) => item.slug !== "uncategorized",
    );
    const draft = skillCategoryDrafts[skill.slug] ?? (skill.categories ?? []).map((category) => category.slug);
    const categoryLabels = skill.categories?.length
      ? skill.categories.map((category) => category.name).join("，")
      : "未分类";

    return (
      <div style={{ display: "grid", gap: "0.5rem" }}>
        <div className="stat">分类：{categoryLabels}</div>
        {categoryOptions.length ? (
          <div className="category-checkbox-grid">
            {categoryOptions.map((category) => (
              <label key={category.slug} className="category-checkbox">
                <input
                  type="checkbox"
                  checked={draft.includes(category.slug)}
                  onChange={() => {
                    setSkillCategoryDrafts((current) => {
                      const currentDraft =
                        current[skill.slug] ?? (skill.categories ?? []).map((item) => item.slug);
                      return {
                        ...current,
                        [skill.slug]: currentDraft.includes(category.slug)
                          ? currentDraft.filter((slug) => slug !== category.slug)
                          : [...currentDraft, category.slug],
                      };
                    });
                  }}
                />
                <span>{category.name}</span>
              </label>
            ))}
          </div>
        ) : (
          <div className="stat">暂无可选分类。</div>
        )}
        <button
          className="btn btn-secondary btn-sm"
          type="button"
          disabled={skillCategoriesAction.isPending}
          onClick={() => skillCategoriesAction.mutate({ slug: skill.slug, categorySlugs: draft })}
        >
          保存分类
        </button>
      </div>
    );
  };

  const renderBundleCategorySelector = (entry: AdminBundleListEntry) => {
    const bundle = entry.bundle;
    const categoryOptions = (categoriesQuery.data?.items ?? []).filter(
      (item) => item.slug !== "uncategorized",
    );
    const draft =
      bundleCategoryDrafts[bundle.slug] ?? (bundle.categories ?? []).map((category) => category.slug);
    const categoryLabels = bundle.categories?.length
      ? bundle.categories.map((category) => category.name).join("，")
      : "未分类";

    return (
      <div style={{ display: "grid", gap: "0.5rem" }}>
        <div className="stat">
          {copy.bundles.editCategories}：{categoryLabels}
        </div>
        {categoryOptions.length ? (
          <div className="category-checkbox-grid">
            {categoryOptions.map((category) => (
              <label key={category.slug} className="category-checkbox">
                <input
                  type="checkbox"
                  checked={draft.includes(category.slug)}
                  disabled={entry.isDeleted}
                  onChange={() => {
                    setBundleCategoryDrafts((current) => {
                      const currentDraft =
                        current[bundle.slug] ?? (bundle.categories ?? []).map((item) => item.slug);
                      return {
                        ...current,
                        [bundle.slug]: currentDraft.includes(category.slug)
                          ? currentDraft.filter((slug) => slug !== category.slug)
                          : [...currentDraft, category.slug],
                      };
                    });
                  }}
                />
                <span>{category.name}</span>
              </label>
            ))}
          </div>
        ) : (
          <div className="stat">暂无可选分类。</div>
        )}
        <button
          className="btn btn-secondary btn-sm"
          type="button"
          disabled={entry.isDeleted || bundleCategoriesAction.isPending}
          onClick={() => bundleCategoriesAction.mutate({ slug: bundle.slug, categorySlugs: draft })}
        >
          {bundleCategoriesAction.isPending
            ? copy.bundles.savingCategories
            : copy.bundles.saveCategories}
        </button>
      </div>
    );
  };

  const renderBundles = () => (
    <div className="tab-body">
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <select
          className="search-input"
          value={adminBundleStatus}
          onChange={(event) =>
            void navigate({
              to: "/management",
              search: (prev) => ({
                ...prev,
                tab: "bundles",
                status: event.target.value === "all" ? undefined : event.target.value,
              }),
            })
          }
          style={{ maxWidth: 220 }}
        >
          <option value="all">{copy.filters.bundles.all}</option>
          <option value="active">{copy.filters.bundles.active}</option>
          <option value="deleted">{copy.filters.bundles.deleted}</option>
        </select>

        <input
          className="search-input"
          value={q}
          onChange={(event) =>
            void navigate({
              to: "/management",
              search: (prev) => ({
                ...prev,
                tab: "bundles",
                q: event.target.value || undefined,
              }),
            })
          }
          placeholder={copy.filters.bundles.searchPlaceholder}
          style={{ maxWidth: 280 }}
        />
      </div>

      <div style={{ display: "grid", gap: "0.75rem" }}>
        {adminBundlesQuery.isLoading ? (
          <div className="loading-indicator">{copy.bundles.loading}</div>
        ) : null}
        {adminBundlesQuery.error && !(adminBundlesQuery.error instanceof ApiError) ? (
          <p className="form-error">{copy.bundles.loadFailed}</p>
        ) : null}
        {adminBundlesQuery.data?.items.length === 0 ? (
          <div className="category-empty-state">{copy.bundles.empty}</div>
        ) : null}
        {adminBundlesQuery.data?.items.map((entry) => {
          const bundle = entry.bundle;
          return (
            <article
              key={`${entry.status}:${bundle.slug}`}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 16,
                padding: "1rem",
                display: "grid",
                gap: "0.75rem",
              }}
            >
              <div>
                <strong>{bundle.displayName}</strong>
                <div style={{ opacity: 0.7 }}>
                  /bundles/{bundle.slug} · {copy.bundles.ownerPrefix}：
                  {formatBundleOwnerLabel(entry, copy.bundles.unknownOwner)} ·{" "}
                  {copy.bundles.statusPrefix}：{entry.status}
                </div>
                <div className="stat">
                  {copy.bundles.statsPrefix}：
                  {copy.bundles.skillsCount.replace("{count}", String(bundle.stats.skills))} ·{" "}
                  {copy.bundles.downloadsCount.replace("{count}", String(bundle.stats.downloads))}
                </div>
              </div>

              {renderBundleCategorySelector(entry)}

              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {entry.isDeleted ? (
                  <span className="btn btn-secondary btn-sm is-disabled" aria-disabled="true">
                    {copy.bundles.view}
                  </span>
                ) : (
                  <Link to="/bundles/$slug" params={{ slug: bundle.slug }} className="btn btn-secondary btn-sm">
                    {copy.bundles.view}
                  </Link>
                )}
                {entry.isDeleted ? (
                  <span className="btn btn-secondary btn-sm is-disabled" aria-disabled="true">
                    {copy.bundles.edit}
                  </span>
                ) : (
                  <Link to="/bundles/new" search={{ edit: bundle.slug }} className="btn btn-secondary btn-sm">
                    {copy.bundles.edit}
                  </Link>
                )}
                <BundleDownloadButton
                  slug={bundle.slug}
                  label={copy.bundles.download}
                  className="btn btn-secondary btn-sm"
                  disabled={entry.isDeleted}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  type="button"
                  disabled={bundleAction.isPending}
                  onClick={() =>
                    bundleAction.mutate({
                      slug: bundle.slug,
                      type: entry.isDeleted ? "undelete" : "delete",
                    })
                  }
                >
                  {entry.isDeleted ? (
                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                  )}
                  {entry.isDeleted ? copy.actions.restore : copy.actions.delete}
                </button>
              </div>
              {entry.isDeleted ? <div className="stat">{copy.bundles.disabledDeleted}</div> : null}
            </article>
          );
        })}
      </div>
    </div>
  );

  const renderCategories = () => {
    const categoryItems = adminCategoryItems;
    const isInitialLoading = adminCategoriesQuery.isLoading && categoryItems.length === 0;
    const hasLoadError = adminCategoriesQuery.isError && categoryItems.length === 0;
    const formModeLabel = editingCategorySlug ? "编辑现有分类" : "创建新分类";

    return (
      <div className="tab-body management-categories">
        <section className="category-hero-panel">
          <div>
            <p className="category-eyebrow">Taxonomy Control</p>
            <h2 className="category-hero-title">管理平台统一分类</h2>
            <p className="category-hero-copy">
              分类是用户浏览和上传时看到的稳定入口。这里维护的是平台分类，不会和自由标签 tags 混用。
            </p>
          </div>
          <div className="category-hero-stat">
            <span>{categoryItems.length}</span>
            <small>当前加载分类</small>
          </div>
        </section>

        <div className="category-management-grid">
        <form
          className="category-composer"
          onSubmit={submitCategoryForm}
        >
          <div className="category-composer-header">
            <span className="category-eyebrow">{formModeLabel}</span>
            <p>先定义稳定标识，再补充展示名称和排序位置。</p>
          </div>
          <div className="category-form-grid">
            <label className="category-field category-field-wide" htmlFor="category-slug-input">
              <span className="category-field-label">分类 slug</span>
            <input
                id="category-slug-input"
                className="category-input mono"
                aria-label="分类 slug"
              value={categoryForm.slug}
              disabled={Boolean(editingCategorySlug)}
              onChange={(event) => {
                setCategoryFormError(null);
                setCategoryForm((prev) => ({ ...prev, slug: event.target.value }));
              }}
              placeholder="slug，例如 productivity"
            />
              <span className="category-field-hint">
                创建后用于 URL、API 和筛选参数，保存后不可编辑。
              </span>
            </label>
            <label className="category-field" htmlFor="category-name-input">
              <span className="category-field-label">分类名称</span>
            <input
                id="category-name-input"
                className="category-input"
                aria-label="分类名称"
              value={categoryForm.name}
              onChange={(event) => {
                setCategoryFormError(null);
                setCategoryForm((prev) => ({ ...prev, name: event.target.value }));
              }}
              placeholder="分类名称"
            />
              <span className="category-field-hint">展示给用户看的名称，例如“自动化”。</span>
            </label>
            <label className="category-field" htmlFor="category-sort-input">
              <span className="category-field-label">排序值</span>
            <input
                id="category-sort-input"
                className="category-input mono"
                aria-label="排序值"
              value={categoryForm.sortOrder}
              onChange={(event) => {
                setCategorySortTouched(true);
                setCategoryForm((prev) => ({ ...prev, sortOrder: event.target.value }));
              }}
              placeholder="10"
              inputMode="numeric"
            />
              <span className="category-field-hint">
                自动建议为下一个 10 的步长，方便以后插入新分类。
              </span>
            </label>
            <label className="category-field category-field-wide" htmlFor="category-description-input">
              <span className="category-field-label">分类描述</span>
          <input
                id="category-description-input"
                className="category-input"
                aria-label="分类描述"
            value={categoryForm.description}
            onChange={(event) =>
              setCategoryForm((prev) => ({ ...prev, description: event.target.value }))
            }
            placeholder="分类描述"
          />
              <span className="category-field-hint">帮助管理员理解分类边界，也可用于后续查询。</span>
            </label>
          </div>
          <div className="category-form-actions">
            <button className="btn btn-primary" type="submit" disabled={categoryAction.isPending}>
              {editingCategorySlug ? "更新分类" : "创建分类"}
            </button>
            {editingCategorySlug ? (
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => {
                  setEditingCategorySlug(null);
                  setCategoryFormError(null);
                  setCategorySortTouched(false);
                  setCategoryForm({
                    slug: "",
                    name: "",
                    description: "",
                    sortOrder: String(suggestedCategorySortOrder),
                  });
                }}
              >
                取消编辑
              </button>
            ) : null}
          </div>
          {categoryFormError ? <p className="form-error">{categoryFormError}</p> : null}
          {categoryAction.error ? <p className="form-error">分类操作失败。</p> : null}
        </form>

          <section className="category-list-panel">
            <div className="category-list-toolbar">
              <div>
                <span className="category-eyebrow">分类列表</span>
                <p>按排序值从小到大展示；相同排序值时按 slug 稳定排序。</p>
              </div>
          <input
                className="category-search-input"
            value={categorySearch}
            onChange={(event) => setCategorySearch(event.target.value)}
            placeholder="搜索分类名称、slug 或描述"
          />
            </div>
            <div className="category-list-body">
          {isInitialLoading ? <div className="loading-indicator">正在加载分类...</div> : null}
          {hasLoadError ? (
                <div className="category-empty-state">
              <p className="form-error">分类列表加载失败。</p>
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                onClick={() => void adminCategoriesQuery.refetch()}
              >
                重试
              </button>
            </div>
          ) : null}
          {!isInitialLoading && !hasLoadError && categoryItems.length === 0 ? (
                <div className="category-empty-state">
                  <strong>暂无分类。</strong>
                  <span>创建第一个分类后，它会出现在上传、导入和浏览筛选里。</span>
                </div>
          ) : null}
          {categoryItems.map((category) => (
            <article
              key={category.slug}
                  className="category-card-row"
            >
                  <div className="category-card-main">
                    <div className="category-card-heading">
                <strong>{category.name}</strong>
                      <span className="category-sort-pill">排序 {category.sortOrder}</span>
                    </div>
                    <div className="category-card-slug">/{category.slug}</div>
                {category.description ? <div className="stat">{category.description}</div> : null}
              </div>
                  <div className="category-card-actions">
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => startEditCategory(category)}>
                  编辑
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  type="button"
                  disabled={categoryAction.isPending}
                  onClick={() => categoryAction.mutate({ type: "delete", slug: category.slug })}
                >
                  删除
                </button>
              </div>
            </article>
          ))}
          {adminCategoriesQuery.hasNextPage ? (
            <button
              className="btn btn-secondary"
              type="button"
              disabled={adminCategoriesQuery.isFetchingNextPage}
              onClick={() => void adminCategoriesQuery.fetchNextPage()}
            >
              {adminCategoriesQuery.isFetchingNextPage ? "正在加载更多分类..." : "加载更多分类"}
            </button>
          ) : null}
            </div>
          </section>
        </div>
      </div>
    );
  };

  const renderSuperusers = () => {
    const configured = adminSuperusersQuery.data?.configured ?? [];
    const dynamic = adminSuperusersQuery.data?.dynamic ?? [];
    const isInitialLoading = adminSuperusersQuery.isLoading && !adminSuperusersQuery.data;
    const hasLoadError = adminSuperusersQuery.isError && !adminSuperusersQuery.data;

    return (
      <div className="tab-body management-superusers">
        <section className="superuser-hero-panel">
          <div>
            <p className="superuser-eyebrow">Access Control</p>
            <h2>{copy.superusers.title}</h2>
            <p>{copy.superusers.description}</p>
          </div>
          <div className="superuser-hero-badge">
            <span>{configured.length + dynamic.length}</span>
            <small>superusers</small>
          </div>
        </section>

        {isInitialLoading ? <div className="loading-indicator">正在加载超级管理员名册...</div> : null}
        {hasLoadError ? (
          <div className="category-empty-state">
            <p className="form-error">{copy.superusers.loadFailed}</p>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() => void adminSuperusersQuery.refetch()}
            >
              重试
            </button>
          </div>
        ) : null}

        {!hasLoadError ? (
          <div className="superuser-management-grid">
            <section className="superuser-panel" aria-label="配置文件管理员列表">
              <div className="superuser-panel-header">
                <span className="superuser-eyebrow">Config Source</span>
                <h3>{copy.superusers.configuredTitle}</h3>
                <p>{copy.superusers.configuredDescription}</p>
              </div>
              <div className="superuser-list">
                {configured.length === 0 ? (
                  <div className="category-empty-state">{copy.superusers.emptyConfigured}</div>
                ) : null}
                {configured.map((entry) => (
                  <article key={`${entry.provider}:${entry.email}`} className="superuser-row is-readonly">
                    <div>
                      <strong>{entry.email}</strong>
                      <div className="stat">provider: {entry.provider} · source: {entry.source}</div>
                    </div>
                    <span className="superuser-readonly-pill">只读</span>
                  </article>
                ))}
              </div>
            </section>

            <section className="superuser-panel" aria-label="超级管理员缓存同步">
              <div className="superuser-panel-header">
                <span className="superuser-eyebrow">Decision Cache</span>
                <h3>{copy.superusers.syncCache}</h3>
                <p>{copy.superusers.syncDescription}</p>
              </div>
              <button
                className="btn btn-secondary"
                type="button"
                disabled={syncSuperuserCacheAction.isPending}
                onClick={() => syncSuperuserCacheAction.mutate()}
              >
                {syncSuperuserCacheAction.isPending
                  ? copy.superusers.syncingCache
                  : copy.superusers.syncCache}
              </button>
              {syncSuperuserCacheAction.data ? (
                <p className="stat">
                  {copy.superusers.syncSuccess
                    .replace("{configuredCount}", String(syncSuperuserCacheAction.data.configuredCount))
                    .replace("{dynamicCount}", String(syncSuperuserCacheAction.data.dynamicCount))}
                </p>
              ) : null}
              {syncSuperuserCacheAction.error ? (
                <p className="form-error">{copy.superusers.syncFailed}</p>
              ) : null}
            </section>

            <section className="superuser-panel">
              <div className="superuser-panel-header">
                <span className="superuser-eyebrow">Dynamic Source</span>
                <h3>{copy.superusers.dynamicTitle}</h3>
                <p>{copy.superusers.dynamicDescription}</p>
              </div>

              <form className="superuser-form" onSubmit={submitSuperuserForm}>
                <label className="category-field" htmlFor="superuser-email-input">
                  <span className="category-field-label">{copy.superusers.emailLabel}</span>
                  <input
                    id="superuser-email-input"
                    className="category-input mono"
                    aria-label={copy.superusers.emailLabel}
                    value={superuserEmail}
                    onChange={(event) => {
                      setSuperuserFormError(null);
                      setSuperuserEmail(event.target.value);
                    }}
                    placeholder={copy.superusers.emailPlaceholder}
                  />
                  <span className="category-field-hint">仅匹配飞书授权身份中的邮箱。</span>
                </label>
                <button className="btn btn-primary" type="submit" disabled={addSuperuserAction.isPending}>
                  {addSuperuserAction.isPending ? copy.superusers.adding : copy.superusers.add}
                </button>
              </form>
              {superuserFormError ? <p className="form-error">{superuserFormError}</p> : null}
              {addSuperuserAction.error || removeSuperuserAction.error ? (
                <p className="form-error">{copy.superusers.operationFailed}</p>
              ) : null}

              <div className="superuser-list">
                {dynamic.length === 0 ? (
                  <div className="category-empty-state">{copy.superusers.emptyDynamic}</div>
                ) : null}
                {dynamic.map((entry) => (
                  <article key={entry.id} className="superuser-row">
                    <div>
                      <strong>{entry.email}</strong>
                      <div className="stat">
                        provider: {entry.provider}
                        {entry.createdAt ? ` · 创建于 ${new Date(entry.createdAt).toLocaleString()}` : ""}
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      aria-label={`删除 ${entry.email}`}
                      disabled={removeSuperuserAction.isPending}
                      onClick={() => removeSuperuserAction.mutate(entry.email)}
                    >
                      {copy.superusers.delete}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <main className="section">
      <h1 className="section-title">{copy.title}</h1>
      <p className="section-subtitle">{copy.subtitle}</p>

      <div className="card tab-card" style={{ display: "grid", gap: "1rem" }}>
        <div style={{ opacity: 0.7 }}>
          {copy.signedInAs} <strong>@{me.handle}</strong>
          {me.isSuperuser ? ` ${copy.superuserTag}` : ""}
        </div>

        {renderTabs()}

        {activeTab === "skills" ? (
          <div className="tab-body">
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
              <select
                className="search-input"
                value={status}
                onChange={(event) =>
                  void navigate({
                    to: "/management",
                    search: (prev) => ({
                      ...prev,
                      tab: "skills",
                      status: event.target.value === "all" ? undefined : event.target.value,
                    }),
                  })
                }
                style={{ maxWidth: 220 }}
              >
                <option value="all">{copy.filters.skills.all}</option>
                <option value="active">{copy.filters.skills.active}</option>
                <option value="deleted">{copy.filters.skills.deleted}</option>
              </select>

              <input
                className="search-input"
                value={q}
                onChange={(event) =>
                  void navigate({
                    to: "/management",
                    search: (prev) => ({
                      ...prev,
                      tab: "skills",
                      q: event.target.value || undefined,
                    }),
                  })
                }
                placeholder={copy.filters.skills.searchPlaceholder}
                style={{ maxWidth: 280 }}
              />

              <select
                className="search-input"
                value={sort}
                aria-label={copy.filters.skills.sortUpdated}
                onChange={(event) =>
                  void navigate({
                    to: "/management",
                    search: (prev) => ({
                      ...prev,
                      tab: "skills",
                      sort: parseSkillSort(event.target.value),
                    }),
                  })
                }
                style={{ maxWidth: 180 }}
              >
                <option value="updated_at">{copy.filters.skills.sortUpdated}</option>
                <option value="created_at">{copy.filters.skills.sortCreated}</option>
                <option value="submitted_at">{copy.filters.skills.sortSubmitted}</option>
              </select>

              <select
                className="search-input"
                value={dir}
                aria-label={copy.filters.skills.dirDesc}
                onChange={(event) =>
                  void navigate({
                    to: "/management",
                    search: (prev) => ({
                      ...prev,
                      tab: "skills",
                      dir: parseSkillDir(event.target.value),
                    }),
                  })
                }
                style={{ maxWidth: 120 }}
              >
                <option value="desc">{copy.filters.skills.dirDesc}</option>
                <option value="asc">{copy.filters.skills.dirAsc}</option>
              </select>

              <select
                className="search-input"
                value={timeField}
                aria-label={copy.filters.skills.timeField}
                onChange={(event) =>
                  void navigate({
                    to: "/management",
                    search: (prev) => ({
                      ...prev,
                      tab: "skills",
                      timeField: parseTimeField(event.target.value),
                    }),
                  })
                }
                style={{ maxWidth: 160 }}
              >
                <option value="created_at">{copy.filters.skills.timeFieldCreated}</option>
                <option value="submitted_at">{copy.filters.skills.timeFieldSubmitted}</option>
              </select>

              <label style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                <span style={{ opacity: 0.7, whiteSpace: "nowrap" }}>{copy.filters.skills.rangeFrom}</span>
                <input
                  className="search-input"
                  type="date"
                  value={createdFrom ?? ""}
                  onChange={(event) =>
                    void navigate({
                      to: "/management",
                      search: (prev) => ({
                        ...prev,
                        tab: "skills",
                        createdFrom: event.target.value || undefined,
                      }),
                    })
                  }
                  style={{ maxWidth: 170 }}
                />
              </label>

              <label style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                <span style={{ opacity: 0.7, whiteSpace: "nowrap" }}>{copy.filters.skills.rangeTo}</span>
                <input
                  className="search-input"
                  type="date"
                  value={createdTo ?? ""}
                  onChange={(event) =>
                    void navigate({
                      to: "/management",
                      search: (prev) => ({
                        ...prev,
                        tab: "skills",
                        createdTo: event.target.value || undefined,
                      }),
                    })
                  }
                  style={{ maxWidth: 170 }}
                />
              </label>

              <button
                className="btn btn-secondary btn-sm"
                type="button"
                disabled={exportCsvAction.isPending}
                onClick={() => exportCsvAction.mutate()}
              >
                {exportCsvAction.isPending ? copy.filters.skills.exporting : copy.filters.skills.exportCsv}
              </button>
            </div>
            {exportError ? <p className="form-error">{exportError}</p> : null}

            <div style={{ display: "grid", gap: "0.75rem" }}>
              {skillListQuery.isLoading ? (
                <div className="loading-indicator">{copy.skills.loading}</div>
              ) : null}
              {skillListQuery.error && !(skillListQuery.error instanceof ApiError) ? (
                <p className="form-error">{copy.skills.loadFailed}</p>
              ) : null}
              {skillListQuery.data?.items.map((skill) => (
                <article
                  key={skill.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    padding: "1rem",
                    display: "grid",
                    gap: "0.75rem",
                  }}
                >
                  <div>
                    <strong>{skill.displayName}</strong>
                    <div style={{ opacity: 0.7 }}>
                      /{skill.slug} · {copy.skills.ownerPrefix}：
                      {formatOwnerLabel(skill, copy.skills.unknownOwner)} ·{" "}
                      {copy.skills.statusPrefix}：{skill.status}
                    </div>
                    <div className="stat">
                      v{skill.latestVersion?.version ?? "—"} · {copy.skills.versionsPrefix}{" "}
                      {skill.stats.versions} · {copy.skills.highlightedPrefix}：
                      {skill.highlighted ? copy.skills.highlightedYes : copy.skills.highlightedNo}
                    </div>
                    <div className="stat">
                      {copy.skills.createdAt}：{formatUnixSeconds(skill.createdAt)} ·{" "}
                      {copy.skills.submittedAt}：
                      {skill.latestVersion
                        ? formatUnixSeconds(skill.latestVersion.createdAt)
                        : "—"}{" "}
                      · {copy.skills.updatedAt}：{formatUnixSeconds(skill.updatedAt)}
                    </div>
                  </div>
                  {renderCategorySelector(skill)}
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {renderSkillActions(skill)}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === "bundles" ? renderBundles() : null}
        {activeTab === "maintenance" ? renderMaintenance() : null}
        {activeTab === "categories" ? renderCategories() : null}
        {activeTab === "superusers" ? renderSuperusers() : null}
      </div>
    </main>
  );
}
