import { describe, expect, it } from "vitest";
import { getDocumentationLinkHostname, normalizeDocumentationLinkRows } from "./documentationLinks";

describe("documentation links", () => {
  it("trims values, ignores blank rows, and preserves order", () => {
    const result = normalizeDocumentationLinkRows([
      { title: "  使用文档  ", url: "  https://example.feishu.cn/docx/example?from=hub#usage  " },
      { title: "   ", url: " https://github.com/example/demo " },
      { title: "   ", url: "   " },
    ]);

    expect(result.issues).toEqual([]);
    expect(result.links).toEqual([
      {
        title: "使用文档",
        url: "https://example.feishu.cn/docx/example?from=hub#usage",
      },
      { url: "https://github.com/example/demo" },
    ]);
  });

  it.each([
    ["missing URL", [{ title: "使用文档", url: "" }], "missing-url"],
    ["relative URL", [{ title: "", url: "/docs" }], "invalid-url"],
    ["non-http URL", [{ title: "", url: "javascript:alert(1)" }], "invalid-url"],
    ["userinfo", [{ title: "", url: "https://user:password@example.com/docs" }], "userinfo"],
    [
      "duplicate URL",
      [
        { title: "", url: "https://example.com/docs" },
        { title: "", url: " https://example.com/docs " },
      ],
      "duplicate-url",
    ],
    [
      "title limit",
      [{ title: "文".repeat(81), url: "https://example.com/docs" }],
      "title-too-long",
    ],
    ["URL limit", [{ title: "", url: `https://example.com/${"a".repeat(2048)}` }], "url-too-long"],
  ] as const)("rejects %s", (_name, rows, expectedCode) => {
    const result = normalizeDocumentationLinkRows([...rows]);
    expect(result.issues.some((issue) => issue.code === expectedCode)).toBe(true);
  });

  it("rejects more than ten non-empty links", () => {
    const result = normalizeDocumentationLinkRows(
      Array.from({ length: 11 }, (_, index) => ({
        title: "",
        url: `https://example.com/docs/${index}`,
      })),
    );
    expect(result.issues).toContainEqual({ code: "too-many-links" });
  });

  it("returns a safe hostname for detail display", () => {
    expect(getDocumentationLinkHostname("https://docs.example.com/path")).toBe("docs.example.com");
    expect(getDocumentationLinkHostname("not-a-url")).toBe("");
  });
});
