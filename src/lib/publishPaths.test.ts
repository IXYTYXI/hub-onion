import { describe, expect, it } from "vitest";
import { setClawhubRelativePath } from "./fileRelativePath";
import { getPublishFileEntries, getPublishFilePaths, normalizePublishPath } from "./publishPaths";

function makeFile(name: string, webkitRelativePath?: string) {
  const file = new File(["content"], name, { type: "text/plain" });
  if (webkitRelativePath !== undefined) {
    Object.defineProperty(file, "webkitRelativePath", {
      configurable: true,
      value: webkitRelativePath,
    });
  }
  return file;
}

describe("publish path helpers", () => {
  it("normalizes separators and leading relative markers", () => {
    expect(normalizePublishPath("./bundle\\scripts\\run.sh")).toBe("bundle/scripts/run.sh");
    expect(normalizePublishPath("/bundle/SKILL.md")).toBe("bundle/SKILL.md");
  });

  it("strips one shared top-level folder from directory uploads", () => {
    const files = [
      makeFile("SKILL.md", "bundle/SKILL.md"),
      makeFile("run.sh", "bundle/scripts/run.sh"),
    ];

    expect(getPublishFilePaths(files)).toEqual(["SKILL.md", "scripts/run.sh"]);
  });

  it("preserves archive-expanded relative paths", () => {
    const files = [
      makeFile("SKILL.md", "SKILL.md"),
      setClawhubRelativePath(makeFile("run.sh"), "scripts/run.sh"),
    ];

    expect(getPublishFileEntries(files).map((entry) => entry.path)).toEqual([
      "SKILL.md",
      "scripts/run.sh",
    ]);
  });

  it("does not strip different top-level folders", () => {
    const files = [makeFile("SKILL.md", "first/SKILL.md"), makeFile("SKILL.md", "second/SKILL.md")];

    expect(getPublishFilePaths(files)).toEqual(["first/SKILL.md", "second/SKILL.md"]);
  });
});
