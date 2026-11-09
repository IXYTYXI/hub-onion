import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { skillsCopy } from "../copy/skills";
import { SkillFilesPanel } from "./SkillFilesPanel";

const getFileTextMock = vi.fn();
const writeTextMock = vi.fn();

vi.mock("../lib/skillFiles", () => ({
  getSkillFileText: (...args: unknown[]) => getFileTextMock(...args),
}));

vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));

vi.mock("remark-gfm", () => ({
  default: {},
}));

type SkillFile = {
  path: string;
  size: number;
  storageId?: string;
  sha256?: string;
  contentType?: string;
};

function makeFile(path: string, size: number): SkillFile {
  return { path, size } as unknown as SkillFile;
}

describe("SkillFilesPanel", () => {
  beforeEach(() => {
    getFileTextMock.mockReset();
    writeTextMock.mockReset();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });
  });

  it("caches loaded files and avoids duplicate fetches", async () => {
    getFileTextMock.mockResolvedValue({
      text: "echo hello",
      size: 10,
      sha256: "a".repeat(64),
    });

    render(
      <SkillFilesPanel
        slug={"demo"}
        version={"1.0.0"}
        readmeContent={"# skill"}
        readmeError={null}
        latestFiles={[makeFile("scripts/run.sh", 10)]}
      />,
    );

    const fileButton = screen.getByRole("button", { name: /scripts\/run\.sh/i });
    fireEvent.click(fileButton);

    await screen.findByText("echo hello");

    fireEvent.click(fileButton);

    await waitFor(() => {
      expect(getFileTextMock).toHaveBeenCalledTimes(1);
    });
  });

  it("ignores stale responses when newer file selection is active", async () => {
    const resolvers: Record<
      string,
      (value: { text: string; size: number; sha256: string }) => void
    > = {};

    getFileTextMock.mockImplementation(
      ({ path }: { path: string }) =>
        new Promise<{ text: string; size: number; sha256: string }>((resolve) => {
          resolvers[path] = resolve;
        }),
    );

    render(
      <SkillFilesPanel
        slug={"demo"}
        version={"1.0.0"}
        readmeContent={"# skill"}
        readmeError={null}
        latestFiles={[makeFile("a.txt", 5), makeFile("b.txt", 6)]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /a\.txt/i }));
    fireEvent.click(screen.getByRole("button", { name: /b\.txt/i }));

    resolvers["a.txt"]({ text: "alpha", size: 5, sha256: "b".repeat(64) });
    resolvers["b.txt"]({ text: "beta", size: 6, sha256: "c".repeat(64) });

    await screen.findByText("beta");
  });

  it("copies the current loaded file content and shows copied state", async () => {
    writeTextMock.mockResolvedValue(undefined);
    getFileTextMock.mockResolvedValue({
      text: "echo hello",
      size: 10,
      sha256: "a".repeat(64),
    });

    render(
      <SkillFilesPanel
        slug={"demo"}
        version={"1.0.0"}
        readmeContent={"# skill"}
        readmeError={null}
        latestFiles={[makeFile("scripts/run.sh", 10)]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /scripts\/run\.sh/i }));
    await screen.findByText("echo hello");

    fireEvent.click(
      screen.getByRole("button", { name: skillsCopy.detail.files.copyFileAriaLabel }),
    );

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("echo hello");
    });
    expect(
      screen.getByRole("button", { name: skillsCopy.detail.files.copiedFileAriaLabel }),
    ).toBeTruthy();
  });

  it("treats empty file content as loaded and copyable", async () => {
    writeTextMock.mockResolvedValue(undefined);
    getFileTextMock.mockResolvedValue({
      text: "",
      size: 0,
      sha256: "b".repeat(64),
    });

    render(
      <SkillFilesPanel
        slug={"demo"}
        version={"1.0.0"}
        readmeContent={"# skill"}
        readmeError={null}
        latestFiles={[makeFile("empty.txt", 0)]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /empty\.txt/i }));

    await waitFor(() => {
      expect(screen.queryByText(skillsCopy.detail.files.selectPrompt)).toBeNull();
      expect(
        screen.getByRole("button", { name: skillsCopy.detail.files.copyFileAriaLabel }),
      ).toBeTruthy();
    });

    fireEvent.click(
      screen.getByRole("button", { name: skillsCopy.detail.files.copyFileAriaLabel }),
    );

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("");
    });
  });

  it("does not allow copying before selected file content loads", async () => {
    getFileTextMock.mockReturnValue(new Promise(() => {}));

    render(
      <SkillFilesPanel
        slug={"demo"}
        version={"1.0.0"}
        readmeContent={"# skill"}
        readmeError={null}
        latestFiles={[makeFile("slow.txt", 5)]}
      />,
    );

    expect(
      screen.queryByRole("button", { name: skillsCopy.detail.files.copyFileAriaLabel }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /slow\.txt/i }));
    const copyButton = await screen.findByRole("button", {
      name: skillsCopy.detail.files.copyFileAriaLabel,
    });
    expect((copyButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(copyButton);
    expect(writeTextMock).not.toHaveBeenCalled();
  });

  it("copies the latest selected file content after switching files", async () => {
    writeTextMock.mockResolvedValue(undefined);
    getFileTextMock.mockImplementation(({ path }: { path: string }) =>
      Promise.resolve({
        text: path === "a.txt" ? "alpha" : "beta",
        size: 5,
        sha256: path === "a.txt" ? "a".repeat(64) : "b".repeat(64),
      }),
    );

    render(
      <SkillFilesPanel
        slug={"demo"}
        version={"1.0.0"}
        readmeContent={"# skill"}
        readmeError={null}
        latestFiles={[makeFile("a.txt", 5), makeFile("b.txt", 4)]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /a\.txt/i }));
    await screen.findByText("alpha");

    fireEvent.click(screen.getByRole("button", { name: /b\.txt/i }));
    await screen.findByText("beta");

    fireEvent.click(
      screen.getByRole("button", { name: skillsCopy.detail.files.copyFileAriaLabel }),
    );

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenLastCalledWith("beta");
    });
  });
});
