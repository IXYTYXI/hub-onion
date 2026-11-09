import type { ReactNode } from "react";
/* @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "../routes/management";

const navigateMock = vi.fn();
let searchMock: Record<string, unknown> = {};
const apiRequestMock = vi.fn();
const authStatusMock = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: { component: unknown; validateSearch?: unknown }) => ({
    options: config,
    useSearch: () => searchMock,
    useNavigate: () => navigateMock,
  }),
}));

vi.mock("../lib/apiClient", async () => {
  class ApiError extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
    }
  }
  return {
    apiRequest: (...args: unknown[]) => apiRequestMock(...args),
    ApiError,
  };
});

vi.mock("../lib/useAuthStatus", () => ({
  useAuthStatus: () => authStatusMock(),
}));

function renderWithProviders(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("/management route", () => {
  beforeEach(() => {
    searchMock = {};
    navigateMock.mockReset();
    apiRequestMock.mockReset();
    authStatusMock.mockReset();
  });

  it("renders the skill management view by default", async () => {
    authStatusMock.mockReturnValue({
      me: { handle: "superuserlogo", isSuperuser: true },
      isLoading: false,
    });
    apiRequestMock.mockResolvedValueOnce({
      items: [
        {
          id: "s1",
          slug: "demo-skill",
          displayName: "Demo Skill",
          summary: null,
          tags: ["latest"],
          stats: { downloads: 0, installs: 0, versions: 1, stars: 0 },
          highlighted: true,
          createdAt: 1,
          updatedAt: 1,
          latestVersion: { version: "1.0.0", createdAt: 1, changelog: "init" },
          isDeleted: false,
          status: "active",
          owner: { handle: "zhibin", displayName: "Zhibin" },
        },
      ],
    });

    renderWithProviders(<Route.options.component />);

    await waitFor(() => {
      expect(screen.getByText("Demo Skill")).toBeTruthy();
    });
    expect(screen.getByText(/管理全站技能，并处理技能生命周期。/i)).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "管理后台导航" })).toBeTruthy();
    expect(screen.getByText("Management Deck")).toBeTruthy();
    expect(screen.getByText("技能生命周期、维护任务和分类体系统一入口。")).toBeTruthy();
    expect(screen.getByText("审核、删除、精选，以及调整 skill 分类。")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "技能管理", selected: true })).toBeTruthy();
    expect(screen.getByText(/精选：是/i)).toBeTruthy();
    expect(screen.getByText(/创建时间：/)).toBeTruthy();
    expect(screen.getByText(/提交时间：/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "导出 CSV" })).toBeTruthy();
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/admin/skills?sort=updated_at&dir=desc&timeField=created_at",
    );
  });

  it("renders no-access copy for non-superuser without requesting admin skills", () => {
    authStatusMock.mockReturnValue({
      me: { handle: "user-logo", isSuperuser: false },
      isLoading: false,
    });

    renderWithProviders(<Route.options.component />);

    expect(screen.getByText(/当前账号无权访问管理后台。/i)).toBeTruthy();
    expect(apiRequestMock).not.toHaveBeenCalled();
  });

  it("does not request admin user review endpoints", async () => {
    authStatusMock.mockReturnValue({
      me: { handle: "superuserlogo", isSuperuser: true },
      isLoading: false,
    });
    apiRequestMock.mockResolvedValueOnce({ items: [] });

    renderWithProviders(<Route.options.component />);

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalled();
    });
    expect(apiRequestMock).not.toHaveBeenCalledWith(expect.stringMatching(/\/admin\/users/));
  });

  it("does not request superuser roster from the skills tab", async () => {
    authStatusMock.mockReturnValue({
      me: { handle: "superuserlogo", isSuperuser: true },
      isLoading: false,
    });
    apiRequestMock.mockResolvedValue({ items: [] });

    renderWithProviders(<Route.options.component />);

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/admin/skills?sort=updated_at&dir=desc&timeField=created_at");
    });
    expect(apiRequestMock).not.toHaveBeenCalledWith("/admin/superusers");
  });

  it("toggles highlighted status from management view", async () => {
    authStatusMock.mockReturnValue({
      me: { handle: "superuserlogo", isSuperuser: true },
      isLoading: false,
    });
    apiRequestMock.mockResolvedValueOnce({
      items: [
        {
          id: "s1",
          slug: "demo-skill",
          displayName: "Demo Skill",
          summary: null,
          tags: ["latest"],
          stats: { downloads: 0, installs: 0, versions: 1, stars: 0 },
          highlighted: false,
          createdAt: 1,
          updatedAt: 1,
          latestVersion: { version: "1.0.0", createdAt: 1, changelog: "init" },
          isDeleted: false,
          status: "active",
          owner: { handle: "zhibin", displayName: "Zhibin" },
        },
      ],
    });
    apiRequestMock.mockResolvedValueOnce({ ok: "updated", highlighted: true });
    apiRequestMock.mockResolvedValueOnce({ items: [] });

    renderWithProviders(<Route.options.component />);

    await waitFor(() => {
      expect(screen.getByText("Demo Skill")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "设为精选" }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/admin/skills/demo-skill/highlighted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ highlighted: true }),
      });
    });
  });

  it("prefers owner email over handle in management list", async () => {
    authStatusMock.mockReturnValue({
      me: { handle: "superuserlogo", isSuperuser: true },
      isLoading: false,
    });
    apiRequestMock.mockResolvedValueOnce({
      items: [
        {
          id: "s1",
          slug: "demo-skill",
          displayName: "Demo Skill",
          summary: null,
          tags: ["latest"],
          stats: { downloads: 0, installs: 0, versions: 1, stars: 0 },
          highlighted: false,
          createdAt: 1,
          updatedAt: 1,
          latestVersion: { version: "1.0.0", createdAt: 1, changelog: "init" },
          isDeleted: false,
          status: "active",
          owner: {
            handle: "uid-like-handle",
            displayName: "Zhibin",
            email: "test@example.com",
          },
        },
      ],
    });

    renderWithProviders(<Route.options.component />);

    await waitFor(() => {
      expect(screen.getByText(/作者：test@example\.com/i)).toBeTruthy();
    });
    expect(screen.queryByText(/作者：@uid-like-handle/i)).toBeNull();
  });

  it("renders maintenance tab without requesting admin skills", () => {
    searchMock = { tab: "maintenance" };
    authStatusMock.mockReturnValue({
      me: { handle: "superuserlogo", isSuperuser: true },
      isLoading: false,
    });

    renderWithProviders(<Route.options.component />);

    expect(screen.getByText("维护任务")).toBeTruthy();
    expect(screen.getByText("Maintenance Console")).toBeTruthy();
    expect(screen.getByText("安全执行窗口")).toBeTruthy();
    expect(screen.getByText(/只处理正常状态的技能/i)).toBeTruthy();
    expect(screen.getByText(/扫描所有缺失简介的正常技能/i)).toBeTruthy();
    expect(apiRequestMock).not.toHaveBeenCalled();
  });

  it("falls back to skills tab for invalid tab search", async () => {
    searchMock = { tab: "unknown" };
    authStatusMock.mockReturnValue({
      me: { handle: "superuserlogo", isSuperuser: true },
      isLoading: false,
    });
    apiRequestMock.mockResolvedValueOnce({ items: [] });

    renderWithProviders(<Route.options.component />);

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/admin/skills?sort=updated_at&dir=desc&timeField=created_at");
    });
  });

  it("syncs missing descriptions from maintenance tab and shows partial failure", async () => {
    searchMock = { tab: "maintenance" };
    authStatusMock.mockReturnValue({
      me: { handle: "superuserlogo", isSuperuser: true },
      isLoading: false,
    });
    apiRequestMock.mockResolvedValueOnce({
      running: false,
      locked: false,
      msg: "同步完成",
      scanned: 3,
      updated: 1,
      skipped: 1,
      failed: 1,
    });

    renderWithProviders(<Route.options.component />);

    fireEvent.click(screen.getByRole("button", { name: "同步缺失简介" }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/admin/maintenance/skill-descriptions/sync", {
        method: "POST",
      });
    });
    expect(await screen.findByText(/同步完成，但有部分技能处理失败。/i)).toBeTruthy();
    expect(screen.getByText("扫描")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("失败")).toBeTruthy();
  });

  it("shows running state when sync is locked", async () => {
    searchMock = { tab: "maintenance" };
    authStatusMock.mockReturnValue({
      me: { handle: "superuserlogo", isSuperuser: true },
      isLoading: false,
    });
    apiRequestMock.mockResolvedValueOnce({
      running: true,
      locked: true,
      msg: "同步任务正在运行",
      scanned: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    });

    renderWithProviders(<Route.options.component />);

    fireEvent.click(screen.getByRole("button", { name: "同步缺失简介" }));

    expect(await screen.findByText(/同步任务正在运行/i)).toBeTruthy();
    expect(screen.queryByText(/扫描: 0/i)).toBeNull();
  });

  it("disables the sync button while request is pending", async () => {
    searchMock = { tab: "maintenance" };
    authStatusMock.mockReturnValue({
      me: { handle: "superuserlogo", isSuperuser: true },
      isLoading: false,
    });
    let resolveSync: (value: unknown) => void = () => undefined;
    apiRequestMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSync = resolve;
      }),
    );

    renderWithProviders(<Route.options.component />);

    const button = screen.getByRole("button", { name: "同步缺失简介" }) as HTMLButtonElement;
    fireEvent.click(button);

    await waitFor(() => {
      expect(button.disabled).toBe(true);
    });
    resolveSync({
      running: true,
      locked: true,
      msg: "同步任务正在运行",
      scanned: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    });
    await waitFor(() => {
      expect(button.disabled).toBe(false);
    });
  });

  it("manages categories from the category tab", async () => {
    searchMock = { tab: "categories" };
    authStatusMock.mockReturnValue({
      me: { handle: "superuserlogo", isSuperuser: true },
      isLoading: false,
    });
    apiRequestMock.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path.startsWith("/admin/categories?") && !options) {
        return {
          items: [
            {
              slug: "automation",
              name: "自动化",
              description: "自动化工具",
              sortOrder: 10,
            },
          ],
        };
      }
      return { ok: true };
    });

    renderWithProviders(<Route.options.component />);

    expect(await screen.findByText("自动化")).toBeTruthy();
    expect(screen.getByLabelText("分类 slug")).toBeTruthy();
    expect(screen.getByLabelText("分类名称")).toBeTruthy();
    expect(screen.getByLabelText("排序值")).toHaveProperty("value", "20");
    expect(screen.getByLabelText("分类描述")).toBeTruthy();
    expect(screen.getByText("创建后用于 URL、API 和筛选参数，保存后不可编辑。")).toBeTruthy();
    expect(screen.getByText("自动建议为下一个 10 的步长，方便以后插入新分类。")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("分类 slug"), {
      target: { value: "productivity" },
    });
    fireEvent.change(screen.getByLabelText("分类名称"), {
      target: { value: "生产力" },
    });
    fireEvent.change(screen.getByLabelText("分类描述"), {
      target: { value: "效率工具" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建分类" }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "productivity",
          name: "生产力",
          description: "效率工具",
          sortOrder: 20,
        }),
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.change(screen.getByLabelText("分类名称"), {
      target: { value: "自动化更新" },
    });
    fireEvent.click(screen.getByRole("button", { name: "更新分类" }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/admin/categories/automation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "自动化更新",
          description: "自动化工具",
          sortOrder: 10,
        }),
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "删除" }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/admin/categories/automation", { method: "DELETE" });
    });
  });

  it("searches and paginates categories from the category tab", async () => {
    searchMock = { tab: "categories" };
    authStatusMock.mockReturnValue({
      me: { handle: "superuserlogo", isSuperuser: true },
      isLoading: false,
    });
    apiRequestMock.mockImplementation(async (path: string, options?: RequestInit) => {
      if (options) return { ok: true };
      if (path === "/admin/categories?limit=20") {
        return {
          items: [
            {
              slug: "automation",
              name: "自动化",
              description: "自动化工具",
              sortOrder: 10,
            },
          ],
          nextCursor: "10:automation",
        };
      }
      if (path === "/admin/categories?limit=20&cursor=10%3Aautomation") {
        return {
          items: [
            {
              slug: "security",
              name: "安全",
              description: "scanner and review",
              sortOrder: 20,
            },
          ],
          nextCursor: null,
        };
      }
      if (path === "/admin/categories?limit=20&q=scan") {
        return {
          items: [
            {
              slug: "security",
              name: "安全",
              description: "scanner and review",
              sortOrder: 20,
            },
          ],
          nextCursor: null,
        };
      }
      return { items: [], nextCursor: null };
    });

    renderWithProviders(<Route.options.component />);

    expect(await screen.findByText("自动化")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "加载更多分类" }));

    expect(await screen.findByText("安全")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("搜索分类名称、slug 或描述"), {
      target: { value: "scan" },
    });

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/admin/categories?limit=20&q=scan");
    });
  });

  it("shows category form validation errors before creating categories", async () => {
    searchMock = { tab: "categories" };
    authStatusMock.mockReturnValue({
      me: { handle: "superuserlogo", isSuperuser: true },
      isLoading: false,
    });
    apiRequestMock.mockResolvedValue({ items: [], nextCursor: null });

    renderWithProviders(<Route.options.component />);

    await screen.findByText("暂无分类。");
    expect(screen.getByLabelText("排序值")).toHaveProperty("value", "10");
    fireEvent.change(screen.getByLabelText("分类名称"), {
      target: { value: "生产力" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建分类" }));

    expect(screen.getByText("请填写分类 slug。")).toBeTruthy();
    expect(apiRequestMock).not.toHaveBeenCalledWith("/admin/categories", expect.anything());

    fireEvent.change(screen.getByLabelText("分类 slug"), {
      target: { value: "Bad Slug" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建分类" }));

    expect(screen.getByText("slug 只能包含小写字母、数字和短横线。")).toBeTruthy();
  });

  it("loads superuser roster lazily and separates configured from dynamic entries", async () => {
    searchMock = { tab: "superusers" };
    authStatusMock.mockReturnValue({
      me: { handle: "superuserlogo", isSuperuser: true },
      isLoading: false,
    });
    apiRequestMock.mockResolvedValue({
      configured: [
        {
          provider: "feishu",
          email: "config-super@example.com",
          source: "config",
          readOnly: true,
        },
      ],
      dynamic: [
        {
          id: "grant-1",
          provider: "feishu",
          email: "dynamic-admin@example.com",
          source: "dynamic",
          createdAt: "2026-06-02T09:00:00Z",
        },
      ],
    });

    renderWithProviders(<Route.options.component />);

    expect(await screen.findByText("配置文件管理员")).toBeTruthy();
    expect(await screen.findByText("config-super@example.com")).toBeTruthy();
    expect(screen.getByText("动态管理员")).toBeTruthy();
    expect(screen.getByText("dynamic-admin@example.com")).toBeTruthy();
    expect(screen.getByText(/配置项来自 YAML/)).toBeTruthy();
    const configuredPanel = screen.getByLabelText("配置文件管理员列表");
    expect(within(configuredPanel).queryByRole("button", { name: /删除/ })).toBeNull();
    expect(apiRequestMock).toHaveBeenCalledWith("/admin/superusers");
  });

  it("adds and deletes dynamic superusers from the superuser tab", async () => {
    searchMock = { tab: "superusers" };
    authStatusMock.mockReturnValue({
      me: { handle: "superuserlogo", isSuperuser: true },
      isLoading: false,
    });
    apiRequestMock.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/admin/superusers" && !options) {
        return {
          configured: [],
          dynamic: [
            {
              id: "grant-1",
              provider: "feishu",
              email: "dynamic-admin@example.com",
              source: "dynamic",
              createdAt: "2026-06-02T09:00:00Z",
            },
          ],
        };
      }
      return { ok: true, id: "grant-2", email: "new-admin@example.com" };
    });

    renderWithProviders(<Route.options.component />);

    expect(await screen.findByText("dynamic-admin@example.com")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("飞书邮箱"), {
      target: { value: "new-admin@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "添加管理员" }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/admin/superusers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "new-admin@example.com" }),
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "删除 dynamic-admin@example.com" }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/admin/superusers?email=dynamic-admin%40example.com", {
        method: "DELETE",
      });
    });
  });

  it("syncs superuser decision cache from the superuser tab", async () => {
    searchMock = { tab: "superusers" };
    authStatusMock.mockReturnValue({
      me: { handle: "superuserlogo", isSuperuser: true },
      isLoading: false,
    });
    apiRequestMock.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/admin/superusers" && !options) {
        return {
          configured: [
            {
              provider: "feishu",
              email: "config-super@example.com",
              source: "config",
              readOnly: true,
            },
          ],
          dynamic: [
            {
              id: "grant-1",
              provider: "feishu",
              email: "dynamic-admin@example.com",
              source: "dynamic",
              createdAt: "2026-06-02T09:00:00Z",
            },
          ],
        };
      }
      if (path === "/admin/superusers/sync-cache" && options?.method === "POST") {
        return { ok: true, configuredCount: 1, dynamicCount: 1 };
      }
      return { ok: true };
    });

    renderWithProviders(<Route.options.component />);

    expect(await screen.findByLabelText("超级管理员缓存同步")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "同步缓存" }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/admin/superusers/sync-cache", {
        method: "POST",
      });
    });
    expect(await screen.findByText("缓存已同步：配置 1 个，动态 1 个。")).toBeTruthy();
  });

  it("shows sync-cache failure from the superuser tab", async () => {
    searchMock = { tab: "superusers" };
    authStatusMock.mockReturnValue({
      me: { handle: "superuserlogo", isSuperuser: true },
      isLoading: false,
    });
    apiRequestMock.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/admin/superusers" && !options) {
        return { configured: [], dynamic: [] };
      }
      if (path === "/admin/superusers/sync-cache" && options?.method === "POST") {
        throw new Error("sync failed");
      }
      return { ok: true };
    });

    renderWithProviders(<Route.options.component />);

    await screen.findByText("暂无动态管理员。");
    fireEvent.click(screen.getByRole("button", { name: "同步缓存" }));

    expect(await screen.findByText("同步缓存失败。")).toBeTruthy();
  });

  it("validates superuser email before submitting", async () => {
    searchMock = { tab: "superusers" };
    authStatusMock.mockReturnValue({
      me: { handle: "superuserlogo", isSuperuser: true },
      isLoading: false,
    });
    apiRequestMock.mockResolvedValue({ configured: [], dynamic: [] });

    renderWithProviders(<Route.options.component />);

    await screen.findByText("暂无动态管理员。");
    fireEvent.click(screen.getByRole("button", { name: "添加管理员" }));
    expect(screen.getByText("请填写飞书邮箱。")).toBeTruthy();
    expect(apiRequestMock).not.toHaveBeenCalledWith("/admin/superusers", expect.objectContaining({ method: "POST" }));

    fireEvent.change(screen.getByLabelText("飞书邮箱"), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(screen.getByRole("button", { name: "添加管理员" }));
    expect(screen.getByText("请输入有效的邮箱地址。")).toBeTruthy();
  });

  it("saves per-skill category selections from the skills tab", async () => {
    authStatusMock.mockReturnValue({
      me: { handle: "superuserlogo", isSuperuser: true },
      isLoading: false,
    });
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path === "/admin/skills?sort=updated_at&dir=desc&timeField=created_at") {
        return {
          items: [
            {
              id: "s1",
              slug: "demo-skill",
              displayName: "Demo Skill",
              summary: null,
              tags: ["latest"],
              categories: [],
              stats: { downloads: 0, installs: 0, versions: 1, stars: 0 },
              highlighted: false,
              createdAt: 1,
              updatedAt: 1,
              latestVersion: { version: "1.0.0", createdAt: 1, changelog: "init" },
              isDeleted: false,
              status: "active",
              owner: { handle: "zhibin", displayName: "Zhibin" },
            },
          ],
        };
      }
      if (path.startsWith("/admin/categories?")) {
        return {
          items: [
            {
              slug: "automation",
              name: "自动化",
              description: "自动化工具",
              sortOrder: 10,
            },
          ],
        };
      }
      return { ok: true };
    });

    renderWithProviders(<Route.options.component />);

    expect(await screen.findByText("Demo Skill")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("自动化"));
    fireEvent.click(screen.getByRole("button", { name: "保存分类" }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/admin/skills/demo-skill/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categorySlugs: ["automation"] }),
      });
    });
  });
});
