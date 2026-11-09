import { getClawhubFilePath } from "./fileRelativePath";

export type PublishFileEntry = {
  file: File;
  path: string;
};

export function normalizePublishPath(path: string) {
  let normalized = path.replaceAll("\u0000", "").replaceAll("\\", "/").trim();

  while (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }
  normalized = normalized.replace(/^\/+/, "");

  return normalized;
}

export function getPublishFilePath(file: File) {
  return normalizePublishPath(getClawhubFilePath(file));
}

export function getPublishFileEntries(files: File[]): PublishFileEntry[] {
  const paths = files.map(getPublishFilePath);
  const stripRoot = getSingleTopLevelFolder(paths);

  return files.map((file, index) => {
    const path = paths[index] ?? "";
    return {
      file,
      path: stripRoot && path.startsWith(`${stripRoot}/`) ? path.slice(stripRoot.length + 1) : path,
    };
  });
}

export function getPublishFilePaths(files: File[]) {
  return getPublishFileEntries(files).map((entry) => entry.path);
}

function getSingleTopLevelFolder(paths: string[]) {
  if (paths.length === 0) return null;
  if (!paths.every((path) => path.includes("/"))) return null;

  const firstSegment = paths[0]?.split("/")[0];
  if (!firstSegment) return null;
  if (!paths.every((path) => path.startsWith(`${firstSegment}/`))) return null;

  return firstSegment;
}
