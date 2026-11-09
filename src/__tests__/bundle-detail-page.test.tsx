import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { BundleDetailPage } from "../components/BundleDetailPage";
import { bundlesCopy } from "../copy/bundles";

const useBundleMock = vi.fn();
const useAuthStatusMock = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
  useNavigate: () => vi.fn(),
}));

vi.mock("../hooks/useBundle", () => ({
  useBundle: (...args: unknown[]) => useBundleMock(...args),
}));

vi.mock("../hooks/useDeleteBundle", () => ({
  useDeleteBundle: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("../lib/useAuthStatus", () => ({
  useAuthStatus: () => useAuthStatusMock(),
}));

function bundleResult(documentationLinks?: Array<{ title?: string; url: string }>) {
  return {
    bundle: {
      slug: "documentation-bundle",
      displayName: "Documentation Bundle",
      description: "A bundle with external documentation",
      documentationLinks,
      owner: { handle: "bundle-owner", displayName: "Bundle Owner" },
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
    missingSkills: ["missing-skill"],
  };
}

describe("BundleDetailPage documentation links", () => {
  beforeEach(() => {
    useBundleMock.mockReset();
    useAuthStatusMock.mockReset();
    useAuthStatusMock.mockReturnValue({ me: null });
  });

  it("renders safe links after the header and before warnings and installation", () => {
    useBundleMock.mockReturnValue({
      data: bundleResult([
        {
          title: "<img src=x onerror=alert(1)>",
          url: "https://docs.example.com/bundle?from=hub#usage",
        },
        { url: "https://gitlab.example.com/group/bundle" },
      ]),
      isError: false,
      isLoading: false,
    });

    const { container } = render(<BundleDetailPage slug="documentation-bundle" />);

    const bundleHeading = screen.getByRole("heading", { name: "Documentation Bundle" });
    const documentationHeading = screen.getByRole("heading", { name: "相关文档" });
    const warning = screen.getByText(bundlesCopy.detail.missingSkillsTitle);
    const installHeading = screen.getByRole("heading", {
      name: bundlesCopy.detail.installMethods.title,
    });
    expect(
      bundleHeading.compareDocumentPosition(documentationHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      documentationHeading.compareDocumentPosition(warning) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      documentationHeading.compareDocumentPosition(installHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const titledLink = screen.getByRole("link", {
      name: "<img src=x onerror=alert(1)>",
    }) as HTMLAnchorElement;
    expect(titledLink.href).toBe("https://docs.example.com/bundle?from=hub#usage");
    expect(titledLink.target).toBe("_blank");
    expect(titledLink.rel).toBe("noopener noreferrer");
    expect(screen.getByText("docs.example.com")).toBeTruthy();
    expect(container.querySelector(".skill-documentation-links img")).toBeNull();

    const fallbackLink = screen.getByRole("link", {
      name: "gitlab.example.com",
    }) as HTMLAnchorElement;
    expect(fallbackLink.target).toBe("_blank");
    expect(fallbackLink.rel).toBe("noopener noreferrer");
  });

  it.each([
    ["empty links", []],
    ["old response without the field", undefined],
  ])("does not render the documentation card for %s", (_name, documentationLinks) => {
    useBundleMock.mockReturnValue({
      data: bundleResult(documentationLinks),
      isError: false,
      isLoading: false,
    });

    render(<BundleDetailPage slug="documentation-bundle" />);

    expect(screen.queryByRole("heading", { name: "相关文档" })).toBeNull();
  });
});
