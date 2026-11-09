import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { BundleFormPage } from "../components/BundleFormPage";
import { bundlesCopy } from "../copy/bundles";
import { ApiError } from "../lib/api-client";

const navigateMock = vi.fn();
const useAuthStatusMock = vi.fn();
const useBundleMock = vi.fn();
const publishMutateMock = vi.fn();
const apiRequestMock = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
  useNavigate: () => navigateMock,
}));

vi.mock("../lib/useAuthStatus", () => ({
  useAuthStatus: () => useAuthStatusMock(),
}));

vi.mock("../hooks/useBundle", () => ({
  useBundle: (...args: unknown[]) => useBundleMock(...args),
}));

vi.mock("../hooks/useCategories", () => ({
  useCategories: () => ({
    data: { items: [] },
    isLoading: false,
  }),
}));

vi.mock("../hooks/usePublishBundle", () => ({
  usePublishBundle: () => ({
    mutate: publishMutateMock,
    isPending: false,
  }),
}));

vi.mock("../hooks/useSearchSkills", () => ({
  useSearchSkills: () => ({
    data: { results: [] },
    isLoading: false,
  }),
}));

vi.mock("../lib/apiClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function renderWithQueryClient(ui: ReactNode) {
  const queryClient = createQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

async function addMySkill() {
  const addButton = await screen.findByRole("button", { name: /My Skill.*添加/ });
  fireEvent.click(addButton);
}

function fillBundleMetadata() {
  fireEvent.change(screen.getByPlaceholderText(bundlesCopy.form.fields.displayNamePlaceholder), {
    target: { value: "Documentation Bundle" },
  });
  fireEvent.change(screen.getByPlaceholderText(bundlesCopy.form.fields.slugPlaceholder), {
    target: { value: "documentation-bundle" },
  });
  fireEvent.change(screen.getByPlaceholderText(bundlesCopy.form.fields.descriptionPlaceholder), {
    target: { value: "A bundle with documentation links" },
  });
}

describe("BundleFormPage documentation links", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    useAuthStatusMock.mockReset();
    useBundleMock.mockReset();
    publishMutateMock.mockReset();
    apiRequestMock.mockReset();

    useAuthStatusMock.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      me: { id: "user-1", handle: "bundle-owner", isSuperuser: false },
    });
    useBundleMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });
    apiRequestMock.mockResolvedValue({
      items: [
        {
          id: "skill-1",
          slug: "my-skill",
          displayName: "My Skill",
          summary: "A skill",
          categories: [],
          stats: { downloads: 0, installs: 0, versions: 1 },
          highlighted: false,
          createdAt: 1,
          updatedAt: 1,
          isDeleted: false,
          status: "active",
        },
      ],
    });
    publishMutateMock.mockImplementation((_payload, options) => {
      options?.onSuccess?.({ ok: "true", bundleId: "bundle-1" });
    });
  });

  it("submits normalized links in order and ignores a blank row", async () => {
    renderWithQueryClient(<BundleFormPage />);
    fillBundleMetadata();
    await addMySkill();

    const addLinkButton = screen.getByRole("button", { name: "添加文档链接" });
    fireEvent.click(addLinkButton);
    fireEvent.change(screen.getByLabelText("文档标题 1"), {
      target: { value: "  使用文档  " },
    });
    fireEvent.change(screen.getByLabelText("文档 URL 1"), {
      target: { value: "  https://docs.example.com/bundle?from=hub#usage  " },
    });
    fireEvent.click(addLinkButton);
    fireEvent.change(screen.getByLabelText("文档 URL 2"), {
      target: { value: " https://github.com/example/bundle " },
    });
    fireEvent.click(addLinkButton);

    fireEvent.click(screen.getByRole("button", { name: bundlesCopy.form.submit.create }));

    await waitFor(() => {
      expect(publishMutateMock).toHaveBeenCalled();
    });
    expect(publishMutateMock.mock.calls[0]?.[0].documentationLinks).toEqual([
      {
        title: "使用文档",
        url: "https://docs.example.com/bundle?from=hub#usage",
      },
      { url: "https://github.com/example/bundle" },
    ]);
  });

  it("blocks invalid links and maps the server validation error", async () => {
    renderWithQueryClient(<BundleFormPage />);
    fillBundleMetadata();
    await addMySkill();

    fireEvent.click(screen.getByRole("button", { name: "添加文档链接" }));
    fireEvent.change(screen.getByLabelText("文档标题 1"), {
      target: { value: "使用文档" },
    });
    fireEvent.click(screen.getByRole("button", { name: bundlesCopy.form.submit.create }));

    expect(await screen.findByText("第 1 个文档链接必须填写 URL。")).toBeTruthy();
    expect(publishMutateMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("文档 URL 1"), {
      target: { value: "https://docs.example.com/bundle" },
    });
    publishMutateMock.mockImplementationOnce((_payload, options) => {
      options?.onError?.(
        new ApiError("validation failed", 400, {
          code: "invalid_documentation_link",
        }),
      );
    });
    fireEvent.click(screen.getByRole("button", { name: bundlesCopy.form.submit.create }));

    expect(await screen.findByText(bundlesCopy.form.error.invalidDocumentationLink)).toBeTruthy();
  });

  it("limits documentation link rows to ten and allows removing a row", () => {
    renderWithQueryClient(<BundleFormPage />);
    const addLinkButton = screen.getByRole("button", {
      name: bundlesCopy.form.documentationLinks.add,
    }) as HTMLButtonElement;

    for (let index = 0; index < 10; index += 1) {
      fireEvent.click(addLinkButton);
    }

    expect(screen.getAllByLabelText(/文档 URL \d+/)).toHaveLength(10);
    expect(addLinkButton.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "删除文档链接 1" }));
    expect(screen.getAllByLabelText(/文档 URL \d+/)).toHaveLength(9);
    expect(addLinkButton.disabled).toBe(false);
  });

  it("prefills edit links and submits an explicit empty array after clearing", async () => {
    useBundleMock.mockReturnValue({
      data: {
        bundle: {
          slug: "documentation-bundle",
          displayName: "Documentation Bundle",
          description: "A bundle with links",
          documentationLinks: [
            { title: "使用文档", url: "https://docs.example.com/bundle" },
            { url: "https://github.com/example/bundle" },
          ],
          owner: { handle: "bundle-owner" },
          categories: [],
          stats: { downloads: 0, installs: 0, skills: 1 },
          skills: ["my-skill"],
          createdAt: 1,
          updatedAt: 1,
        },
        skills: [
          {
            slug: "my-skill",
            displayName: "My Skill",
            categories: [],
          },
        ],
      },
      isLoading: false,
      isError: false,
    });

    renderWithQueryClient(<BundleFormPage editSlug="documentation-bundle" />);

    expect(((await screen.findByLabelText("文档 URL 1")) as HTMLInputElement).value).toBe(
      "https://docs.example.com/bundle",
    );
    fireEvent.click(screen.getByRole("button", { name: "删除文档链接 2" }));
    fireEvent.click(screen.getByRole("button", { name: "删除文档链接 1" }));
    fireEvent.click(screen.getByRole("button", { name: bundlesCopy.form.submit.update }));

    await waitFor(() => {
      expect(publishMutateMock).toHaveBeenCalled();
    });
    expect(publishMutateMock.mock.calls[0]?.[0].documentationLinks).toEqual([]);
  });

  it("does not overwrite touched links when refreshed bundle data arrives", async () => {
    let bundleData = {
      bundle: {
        slug: "documentation-bundle",
        displayName: "Documentation Bundle",
        description: "A bundle with links",
        documentationLinks: [{ url: "https://remote.example.com/original" }],
        owner: { handle: "bundle-owner" },
        categories: [],
        stats: { downloads: 0, installs: 0, skills: 1 },
        skills: ["my-skill"],
        createdAt: 1,
        updatedAt: 1,
      },
      skills: [{ slug: "my-skill", displayName: "My Skill", categories: [] }],
    };
    useBundleMock.mockImplementation(() => ({
      data: bundleData,
      isLoading: false,
      isError: false,
    }));

    const view = renderWithQueryClient(<BundleFormPage editSlug="documentation-bundle" />);
    const urlInput = (await screen.findByLabelText("文档 URL 1")) as HTMLInputElement;
    fireEvent.change(urlInput, {
      target: { value: "https://local.example.com/edited" },
    });

    bundleData = {
      ...bundleData,
      bundle: {
        ...bundleData.bundle,
        documentationLinks: [{ url: "https://remote.example.com/refreshed" }],
        updatedAt: 2,
      },
    };
    view.rerender(
      <QueryClientProvider client={createQueryClient()}>
        <BundleFormPage editSlug="documentation-bundle" />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect((screen.getByLabelText("文档 URL 1") as HTMLInputElement).value).toBe(
        "https://local.example.com/edited",
      );
    });
  });
});
