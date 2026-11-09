import type { DocumentationLink } from "../types/api";

export const MAX_DOCUMENTATION_LINKS = 10;
export const MAX_DOCUMENTATION_LINK_TITLE_LENGTH = 80;
export const MAX_DOCUMENTATION_LINK_URL_LENGTH = 2048;

export type DocumentationLinkRow = {
  title: string;
  url: string;
};

export type DocumentationLinkValidationIssue =
  | { code: "too-many-links" }
  | {
      code:
        | "missing-url"
        | "title-too-long"
        | "url-too-long"
        | "invalid-url"
        | "userinfo"
        | "duplicate-url";
      index: number;
    };

export function normalizeDocumentationLinkRows(rows: DocumentationLinkRow[]): {
  links: DocumentationLink[];
  issues: DocumentationLinkValidationIssue[];
} {
  const links: DocumentationLink[] = [];
  const issues: DocumentationLinkValidationIssue[] = [];
  const seenURLs = new Set<string>();

  rows.forEach((row, index) => {
    const title = row.title.trim();
    const url = row.url.trim();
    if (!title && !url) return;

    if (Array.from(title).length > MAX_DOCUMENTATION_LINK_TITLE_LENGTH) {
      issues.push({ code: "title-too-long", index });
    }
    if (!url) {
      issues.push({ code: "missing-url", index });
      return;
    }
    if (Array.from(url).length > MAX_DOCUMENTATION_LINK_URL_LENGTH) {
      issues.push({ code: "url-too-long", index });
      return;
    }

    const parsed = parseHttpURL(url);
    if (!parsed) {
      issues.push({ code: "invalid-url", index });
      return;
    }
    if (parsed.username || parsed.password) {
      issues.push({ code: "userinfo", index });
      return;
    }
    if (seenURLs.has(url)) {
      issues.push({ code: "duplicate-url", index });
      return;
    }

    seenURLs.add(url);
    links.push(title ? { title, url } : { url });
  });

  if (links.length > MAX_DOCUMENTATION_LINKS) {
    issues.push({ code: "too-many-links" });
  }

  return { links, issues };
}

export function getDocumentationLinkHostname(url: string): string {
  return parseHttpURL(url)?.hostname ?? "";
}

function parseHttpURL(value: string): URL | null {
  const authorityMatch = /^([a-z][a-z\d+.-]*):\/\/([^/?#]+)/i.exec(value);
  if (!authorityMatch) return null;

  const scheme = authorityMatch[1]?.toLowerCase();
  if (scheme !== "http" && scheme !== "https") return null;

  try {
    const parsed = new URL(value);
    if (!parsed.hostname) return null;
    return parsed;
  } catch {
    return null;
  }
}
