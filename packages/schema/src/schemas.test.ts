/* @vitest-environment node */

import { describe, expect, it } from "vitest";
import { parseArk } from "./ark";
import {
  ApiSearchResponseSchema,
  ApiV1SkillListResponseSchema,
  ApiV1SkillResponseSchema,
  CliPublishRequestSchema,
  CliSkillDeleteRequestSchema,
  LockfileSchema,
  WellKnownConfigSchema,
} from "./schemas";

describe("clawhub-schema", () => {
  it("parses lockfile records", () => {
    const lock = parseArk(
      LockfileSchema,
      { version: 1, skills: { demo: { version: "1.0.0", installedAt: 123 } } },
      "Lockfile",
    );
    expect(lock.skills.demo?.version).toBe("1.0.0");
  });

  it("allows publish payload without tags", () => {
    const payload = parseArk(
      CliPublishRequestSchema,
      {
        slug: "demo",
        displayName: "Demo",
        version: "1.0.0",
        changelog: "",
        files: [{ path: "SKILL.md", size: 1, storageId: "s", sha256: "x" }],
      },
      "Publish payload",
    );
    expect(payload.tags).toBeUndefined();
    expect(payload.files[0]?.path).toBe("SKILL.md");
  });

  it("accepts publish payload with github source", () => {
    const payload = parseArk(
      CliPublishRequestSchema,
      {
        slug: "demo",
        displayName: "Demo",
        version: "1.0.0",
        changelog: "",
        source: {
          kind: "github",
          url: "https://github.com/example/demo",
          repo: "example/demo",
          ref: "main",
          commit: "abc123",
          path: ".",
          importedAt: 123,
        },
        files: [{ path: "SKILL.md", size: 1, storageId: "s", sha256: "x" }],
      },
      "Publish payload",
    );
    expect(payload.source?.repo).toBe("example/demo");
  });

  it("accepts publish payload with gitlab source", () => {
    const payload = parseArk(
      CliPublishRequestSchema,
      {
        slug: "demo",
        displayName: "Demo",
        version: "1.0.0",
        changelog: "",
        source: {
          kind: "gitlab",
          url: "https://gitlab.com/example/demo",
          repo: "example/demo",
          ref: "main",
          commit: "abc123",
          path: ".",
          importedAt: 123,
        },
        files: [{ path: "SKILL.md", size: 1, storageId: "s", sha256: "x" }],
      },
      "Publish payload",
    );
    expect(payload.source?.kind).toBe("gitlab");
  });

  it("accepts optional documentation links in publish payloads", () => {
    const payload = parseArk(
      CliPublishRequestSchema,
      {
        slug: "demo",
        displayName: "Demo",
        version: "1.0.0",
        changelog: "",
        documentationLinks: [
          { title: "使用文档", url: "https://example.feishu.cn/docx/example" },
          { url: "https://github.com/example/demo" },
        ],
        files: [{ path: "SKILL.md", size: 1, storageId: "s", sha256: "x" }],
      },
      "Publish payload",
    );

    expect(payload.documentationLinks).toEqual([
      { title: "使用文档", url: "https://example.feishu.cn/docx/example" },
      { url: "https://github.com/example/demo" },
    ]);
  });

  it("rejects malformed documentation links in publish payloads", () => {
    expect(() =>
      parseArk(
        CliPublishRequestSchema,
        {
          slug: "demo",
          displayName: "Demo",
          version: "1.0.0",
          changelog: "",
          documentationLinks: [{ title: 123, url: false }],
          files: [{ path: "SKILL.md", size: 1, storageId: "s", sha256: "x" }],
        },
        "Publish payload",
      ),
    ).toThrow(/documentationLinks/);
  });

  it("parses documentation links in skill responses and tolerates older responses", () => {
    const item = {
      slug: "demo",
      displayName: "Demo",
      summary: null,
      tags: [],
      stats: {},
      createdAt: 1,
      updatedAt: 2,
    };
    const olderList = parseArk(
      ApiV1SkillListResponseSchema,
      { items: [item], nextCursor: null },
      "Skill list",
    );
    expect(olderList.items[0]?.documentationLinks).toBeUndefined();

    const detail = parseArk(
      ApiV1SkillResponseSchema,
      {
        skill: {
          ...item,
          documentationLinks: [
            { title: "使用文档", url: "https://docs.example.com/usage" },
            { url: "https://gitlab.example.com/group/project" },
          ],
        },
        latestVersion: null,
        owner: null,
      },
      "Skill detail",
    );
    expect(detail.skill?.documentationLinks).toHaveLength(2);
  });

  it("parses well-known config", () => {
    expect(
      parseArk(WellKnownConfigSchema, { registry: "https://example.convex.site" }, "WellKnown"),
    ).toEqual({ registry: "https://example.convex.site" });

    expect(
      parseArk(
        WellKnownConfigSchema,
        { registry: "https://example.convex.site", authBase: "https://clawhub.ai" },
        "WellKnown",
      ),
    ).toEqual({ registry: "https://example.convex.site", authBase: "https://clawhub.ai" });

    expect(
      parseArk(
        WellKnownConfigSchema,
        { apiBase: "https://example.convex.site", minCliVersion: "0.1.0" },
        "WellKnown",
      ),
    ).toEqual({ apiBase: "https://example.convex.site", minCliVersion: "0.1.0" });

    const combined = parseArk(
      WellKnownConfigSchema,
      {
        apiBase: "https://clawhub.ai",
        registry: "https://clawhub.ai",
        authBase: "https://clawhub.ai",
      },
      "WellKnown",
    ) as unknown as Record<string, unknown>;
    expect(combined.apiBase).toBe("https://clawhub.ai");
    expect(combined.registry).toBe("https://clawhub.ai");
  });

  it("throws labeled errors", () => {
    expect(() => parseArk(LockfileSchema, null, "Lockfile")).toThrow(/Lockfile:/);
  });

  it("truncates error messages when there are more than 3 errors", () => {
    const invalidPayload = {
      slug: 123,
      displayName: 456,
      version: 789,
      changelog: true,
      files: "not-an-array",
    };
    expect(() => parseArk(CliPublishRequestSchema, invalidPayload, "Publish")).toThrow("+");
  });

  it("parses search results arrays", () => {
    expect(parseArk(ApiSearchResponseSchema, { results: [] }, "Search")).toEqual({ results: [] });

    const parsed = parseArk(
      ApiSearchResponseSchema,
      {
        results: [
          {
            slug: "a",
            displayName: "A",
            version: "1.0.0",
            score: 0.9,
            owner: { handle: "alice", displayName: "Alice", image: null },
            stats: { downloads: 10, installs: 4, versions: 2, stars: 1 },
            latestVersion: { version: "1.0.0", createdAt: 123, changelog: "latest" },
          },
          { slug: "b", displayName: "B", version: null, score: 0.1 },
        ],
      },
      "Search",
    );
    expect(parsed.results).toHaveLength(2);
    expect(parsed.results[0]?.slug).toBe("a");
    expect(parsed.results[0]?.stats?.downloads).toBe(10);
    expect(parsed.results[0]?.latestVersion?.version).toBe("1.0.0");
  });

  it("parses delete request payload", () => {
    expect(parseArk(CliSkillDeleteRequestSchema, { slug: "demo" }, "Delete")).toEqual({
      slug: "demo",
    });
  });
});
