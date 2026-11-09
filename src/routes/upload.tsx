import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import semver from "semver";
import type { SkillDetailResponse, VersionListResponse } from "../types/api";
import { uploadCopy } from "../copy/upload";
import { useCategories } from "../hooks/useCategories";
import { usePublishSkill } from "../hooks/usePublishSkill";
import { ApiError, apiRequest } from "../lib/apiClient";
import {
  MAX_DOCUMENTATION_LINKS,
  MAX_DOCUMENTATION_LINK_TITLE_LENGTH,
  MAX_DOCUMENTATION_LINK_URL_LENGTH,
  normalizeDocumentationLinkRows,
  type DocumentationLinkRow,
  type DocumentationLinkValidationIssue,
} from "../lib/documentationLinks";
import { getPublishFilePaths } from "../lib/publishPaths";
import { getSiteMode } from "../lib/site";
import {
  deriveDisplayNameFromName,
  deriveSlugFromName,
  findPrimarySkillFileIndex,
  getFrontmatterString,
  parseFrontmatter,
} from "../lib/skillFrontmatter";
import { expandDroppedItems, expandFilesWithReport } from "../lib/uploadFiles";
import { useAuthStatus } from "../lib/useAuthStatus";
import { formatBytes, formatPublishError, isTextFile, readText } from "./upload/-utils";
import { BundleFormPage } from "../components/BundleFormPage";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type SlugIntentState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "owned"; latestVersion: string | null }
  | { kind: "taken" }
  | { kind: "error" };

function formatDocumentationLinkIssue(
  issue: DocumentationLinkValidationIssue,
  copy: typeof uploadCopy.validation,
) {
  if (issue.code === "too-many-links") return copy.documentationTooMany;

  const index = String(issue.index + 1);
  switch (issue.code) {
    case "missing-url":
      return copy.documentationMissingUrl.replace("{index}", index);
    case "title-too-long":
      return copy.documentationTitleTooLong.replace("{index}", index);
    case "url-too-long":
      return copy.documentationUrlTooLong.replace("{index}", index);
    case "invalid-url":
      return copy.documentationInvalidUrl.replace("{index}", index);
    case "userinfo":
      return copy.documentationUserinfo.replace("{index}", index);
    case "duplicate-url":
      return copy.documentationDuplicate.replace("{index}", index);
  }
}

export const Route = createFileRoute("/upload")({
  validateSearch: (search) => ({
    updateSlug: typeof search.updateSlug === "string" ? search.updateSlug : undefined,
    type: search.type === "bundle" ? ("bundle" as const) : ("skill" as const),
  }),
  component: Upload,
});

export function Upload() {
  const copy = uploadCopy;
  const { isAuthenticated, me } = useAuthStatus();
  const { updateSlug, type } = useSearch({ from: "/upload" });
  const siteMode = getSiteMode();
  const isSoulMode = siteMode === "souls";
  const requiredFileLabel = isSoulMode ? "SOUL.md" : "SKILL.md";
  const contentLabel = isSoulMode ? copy.nouns.soul : copy.nouns.skill;

  // Use new publish skill hook
  const publishSkill = usePublishSkill();
  const categoriesQuery = useCategories({ enabled: isAuthenticated });

  const [hasAttempted, setHasAttempted] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [ignoredMacJunkPaths, setIgnoredMacJunkPaths] = useState<string[]>([]);
  const [slug, setSlug] = useState(updateSlug ?? "");
  const [displayName, setDisplayName] = useState("");
  const [slugTouched, setSlugTouched] = useState(Boolean(updateSlug?.trim()));
  const [displayNameTouched, setDisplayNameTouched] = useState(false);
  const [version, setVersion] = useState("1.0.0");
  const [tags, setTags] = useState("latest");
  const [selectedCategorySlugs, setSelectedCategorySlugs] = useState<string[]>([]);
  const [documentationLinkRows, setDocumentationLinkRows] = useState<DocumentationLinkRow[]>([]);
  const documentationLinksTouchedRef = useRef(false);
  const [changelog, setChangelog] = useState("");
  const [changelogSource, setChangelogSource] = useState<"auto" | "user" | null>(null);
  const changelogTouchedRef = useRef(false);
  const [status, setStatus] = useState<string | null>(null);
  const isSubmitting = status !== null;
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [slugIntent, setSlugIntent] = useState<SlugIntentState>({ kind: "idle" });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const slugCheckIdRef = useRef(0);
  const validationRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const maxBytes = 50 * 1024 * 1024;
  const totalBytes = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);
  const normalizedPaths = useMemo(() => getPublishFilePaths(files), [files]);
  const hasRequiredFile = useMemo(
    () =>
      normalizedPaths.some((path) => {
        const lower = path.trim().toLowerCase();
        return isSoulMode ? lower === "soul.md" : lower === "skill.md" || lower === "skills.md";
      }),
    [isSoulMode, normalizedPaths],
  );
  const sizeLabel = totalBytes ? formatBytes(totalBytes) : "0 B";
  const ignoredMacJunkNote = useMemo(() => {
    if (ignoredMacJunkPaths.length === 0) return null;
    const labels = Array.from(
      new Set(ignoredMacJunkPaths.map((path) => path.split("/").at(-1) ?? path)),
    ).slice(0, 3);
    const suffix = ignoredMacJunkPaths.length > 3 ? ", ..." : "";
    const count = ignoredMacJunkPaths.length;
    return copy.dropzone.ignoredMacJunk
      .replace("{count}", String(count))
      .replace("{labels}", labels.join(", "))
      .replace("{suffix}", suffix);
  }, [ignoredMacJunkPaths]);
  const [autofillNote, setAutofillNote] = useState<string | null>(null);
  const trimmedSlug = slug.trim();
  const trimmedName = displayName.trim();
  const trimmedChangelog = changelog.trim();
  const currentUserHandle = me?.handle?.trim() ?? "";
  const latestOwnedVersion = slugIntent.kind === "owned" ? slugIntent.latestVersion : null;

  // Phase 1: Skip auto-changelog generation (backend API not available yet)
  // Removed: useEffect for existing skill lookup and changelog auto-generation

  const parsedTags = useMemo(
    () =>
      tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [tags],
  );
  const categoryOptions = useMemo(
    () =>
      (categoriesQuery.data?.items ?? []).filter((category) => category.slug !== "uncategorized"),
    [categoriesQuery.data?.items],
  );
  const documentationLinksResult = useMemo(
    () => normalizeDocumentationLinkRows(documentationLinkRows),
    [documentationLinkRows],
  );
  const documentationLinkIssues = useMemo(
    () =>
      documentationLinksResult.issues.map((issue) =>
        formatDocumentationLinkIssue(issue, copy.validation),
      ),
    [documentationLinksResult.issues],
  );
  const validation = useMemo(() => {
    const issues: string[] = [];
    if (!trimmedSlug) {
      issues.push(copy.validation.slugRequired);
    } else if (!SLUG_PATTERN.test(trimmedSlug)) {
      issues.push(copy.validation.slugFormat);
    } else if (slugIntent.kind === "taken") {
      issues.push(copy.validation.slugTaken);
    }
    if (!trimmedName) {
      issues.push(copy.validation.displayNameRequired);
    }
    if (!semver.valid(version)) {
      issues.push(copy.validation.versionInvalid);
    } else if (
      latestOwnedVersion &&
      semver.valid(latestOwnedVersion) &&
      !semver.gt(version, latestOwnedVersion)
    ) {
      issues.push(copy.validation.versionMustIncrease.replace("{version}", latestOwnedVersion));
    }
    if (parsedTags.length === 0) {
      issues.push(copy.validation.tagsRequired);
    }
    if (files.length === 0) {
      issues.push(copy.validation.filesRequired);
    }
    if (!hasRequiredFile) {
      issues.push(copy.validation.requiredFile.replace("{requiredFile}", requiredFileLabel));
    }
    const invalidFiles = files.filter((file) => !isTextFile(file));
    if (invalidFiles.length > 0) {
      issues.push(
        copy.validation.removeNonText.replace(
          "{names}",
          invalidFiles
            .slice(0, 3)
            .map((file) => file.name)
            .join(", "),
        ),
      );
    }
    if (totalBytes > maxBytes) {
      issues.push(copy.validation.sizeExceeded);
    }
    issues.push(...documentationLinkIssues);
    return {
      issues,
      ready: issues.length === 0,
    };
  }, [
    trimmedSlug,
    trimmedName,
    version,
    parsedTags.length,
    files,
    hasRequiredFile,
    totalBytes,
    requiredFileLabel,
    slugIntent.kind,
    latestOwnedVersion,
    documentationLinkIssues,
  ]);

  useEffect(() => {
    if (!trimmedSlug || !SLUG_PATTERN.test(trimmedSlug)) {
      slugCheckIdRef.current += 1;
      setSlugIntent({ kind: "idle" });
      return;
    }

    const requestId = slugCheckIdRef.current + 1;
    slugCheckIdRef.current = requestId;
    setSlugIntent({ kind: "checking" });

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const detail = await apiRequest<SkillDetailResponse>(
            `/skills/${encodeURIComponent(trimmedSlug)}`,
          );
          if (slugCheckIdRef.current !== requestId) return;

          const ownerHandle = detail.owner?.handle?.trim() ?? "";
          if (!currentUserHandle || ownerHandle !== currentUserHandle) {
            if (!documentationLinksTouchedRef.current) {
              setDocumentationLinkRows([]);
            }
            setSlugIntent({ kind: "taken" });
            return;
          }

          let latestVersion = detail.latestVersion?.version ?? null;
          if (!latestVersion) {
            try {
              const versions = await apiRequest<VersionListResponse>(
                `/skills/${encodeURIComponent(trimmedSlug)}/versions`,
              );
              if (slugCheckIdRef.current !== requestId) return;
              latestVersion = versions.items[0]?.version ?? null;
            } catch {
              if (slugCheckIdRef.current !== requestId) return;
            }
          }

          if (!documentationLinksTouchedRef.current) {
            setDocumentationLinkRows(
              (detail.skill.documentationLinks ?? []).map((link) => ({
                title: link.title ?? "",
                url: link.url,
              })),
            );
          }
          setSlugIntent({ kind: "owned", latestVersion });
        } catch (fetchError) {
          if (slugCheckIdRef.current !== requestId) return;
          if (fetchError instanceof ApiError && fetchError.status === 404) {
            if (!documentationLinksTouchedRef.current) {
              setDocumentationLinkRows([]);
            }
            setSlugIntent({ kind: "available" });
            return;
          }
          setSlugIntent({ kind: "error" });
        }
      })();
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [currentUserHandle, trimmedSlug]);

  useEffect(() => {
    if (!fileInputRef.current) return;
    fileInputRef.current.setAttribute("webkitdirectory", "");
    fileInputRef.current.setAttribute("directory", "");
  }, []);

  if (!isAuthenticated) {
    return (
      <main className="section">
        <div className="card">{copy.authRequired.replace("{type}", contentLabel)}</div>
      </main>
    );
  }

  async function applyExpandedFiles(selected: File[]) {
    const report = await expandFilesWithReport(selected);
    setFiles(report.files);
    setIgnoredMacJunkPaths(report.ignoredMacJunkPaths);
    setAutofillNote(null);

    const nextNormalizedPaths = getPublishFilePaths(report.files);
    const primaryIndex = findPrimarySkillFileIndex(nextNormalizedPaths);
    const primaryFile = primaryIndex >= 0 ? report.files[primaryIndex] : null;
    if (!primaryFile) return;

    try {
      const content = await readText(primaryFile);
      const parsed = parseFrontmatter(content);
      const parsedName = getFrontmatterString(parsed, "name");
      if (!parsedName) return;

      let didAutofill = false;
      if (!slugTouched && !slug.trim()) {
        setSlug(deriveSlugFromName(parsedName));
        didAutofill = true;
      }
      if (!displayNameTouched && !displayName.trim()) {
        setDisplayName(deriveDisplayNameFromName(parsedName));
        didAutofill = true;
      }
      if (didAutofill) {
        setAutofillNote(
          copy.status.autofilledFromSkill.replace("{requiredFile}", requiredFileLabel),
        );
      }
    } catch {
      // Ignore read/parse failures and leave manual entry path available.
    }
  }

  function handleRemoveFile(index: number) {
    setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function updateDocumentationLinks(
    updater: (current: DocumentationLinkRow[]) => DocumentationLinkRow[],
  ) {
    documentationLinksTouchedRef.current = true;
    setDocumentationLinkRows(updater);
  }

  const slugStatusNote = (() => {
    switch (slugIntent.kind) {
      case "checking":
        return <div className="stat">{copy.status.checkingSlug}</div>;
      case "available":
        return <div className="stat">{copy.status.slugAvailable}</div>;
      case "owned":
        return <div className="stat">{copy.status.slugOwned}</div>;
      case "taken":
        return <div className="error">{copy.validation.slugTaken}</div>;
      case "error":
        return <div className="stat">{copy.status.slugCheckFailed}</div>;
      default:
        return null;
    }
  })();

  const submitDisabled = !validation.ready || isSubmitting || slugIntent.kind === "checking";
  const submitLabel =
    slugIntent.kind === "owned"
      ? copy.actions.publishVersion
      : copy.actions.publish.replace("{type}", contentLabel);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setHasAttempted(true);
    if (!validation.ready) {
      if (validationRef.current && "scrollIntoView" in validationRef.current) {
        validationRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    setError(null);
    if (totalBytes > maxBytes) {
      setError(copy.validation.perVersionSizeExceeded);
      return;
    }
    if (!hasRequiredFile) {
      setError(copy.validation.requiredFile.replace("{requiredFile}", requiredFileLabel));
      return;
    }
    setStatus(copy.status.uploading);

    // Phase 1: Use new publish skill hook with simplified flow
    // Files are uploaded directly via the new API
    setStatus(copy.status.publishing);

    publishSkill.mutate(
      {
        payload: {
          slug: trimmedSlug,
          displayName: trimmedName,
          version,
          changelog: trimmedChangelog,
          tags: parsedTags,
          categorySlugs: selectedCategorySlugs,
          ...(documentationLinksTouchedRef.current || slugIntent.kind === "owned"
            ? { documentationLinks: documentationLinksResult.links }
            : {}),
        },
        files,
      },
      {
        onSuccess: () => {
          setStatus(null);
          setError(null);
          setHasAttempted(false);
          setChangelogSource("user");
          const ownerParam = me?.handle ?? "unknown";
          void navigate({
            to: isSoulMode ? "/souls/$slug" : "/$owner/$slug",
            params: isSoulMode ? { slug: trimmedSlug } : { owner: ownerParam, slug: trimmedSlug },
          });
        },
        onError: (publishError) => {
          setStatus(null);
          setError(formatPublishError(publishError));
        },
      },
    );
  }

  if (type === "bundle") {
    return (
      <main className="section upload-page">
        <header className="upload-page-header">
          <div>
            <h1 className="upload-page-title">{copy.title.replace("{type}", contentLabel)}</h1>
          </div>
        </header>
        <div className="tab-header" role="tablist" aria-label="上传类型">
          <button
            type="button"
            className="tab-button"
            role="tab"
            aria-selected={false}
            onClick={() => navigate({ to: "/upload", search: { updateSlug: undefined, type: "skill" as const } })}
          >
            技能
          </button>
          <button
            type="button"
            className="tab-button is-active"
            role="tab"
            aria-selected={true}
          >
            技能包
          </button>
        </div>
        <BundleFormPage embedded />
      </main>
    );
  }

  return (
    <main className="section upload-page">
      <header className="upload-page-header">
        <div>
          <h1 className="upload-page-title">{copy.title.replace("{type}", contentLabel)}</h1>
          <p className="upload-page-subtitle">
            {copy.subtitle
              .replace("{type}", contentLabel)
              .replace("{requiredFile}", requiredFileLabel)}
          </p>
        </div>
      </header>

      <div className="tab-header" role="tablist" aria-label="上传类型">
        <button
          type="button"
          className="tab-button is-active"
          role="tab"
          aria-selected={true}
        >
          技能
        </button>
        <button
          type="button"
          className="tab-button"
          role="tab"
          aria-selected={false}
          onClick={() => navigate({ to: "/upload", search: { updateSlug: undefined, type: "bundle" as const } })}
        >
          技能包
        </button>
      </div>

      <form onSubmit={handleSubmit} className="upload-grid">
        <div className="card upload-panel">
          <label className="form-label" htmlFor="slug">
            {copy.fields.slug}
          </label>
          <input
            className="form-input"
            id="slug"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
            placeholder={copy.placeholders.slug.replace("{type}", contentLabel)}
          />
          {slugStatusNote}

          <label className="form-label" htmlFor="displayName">
            {copy.fields.displayName}
          </label>
          <input
            className="form-input"
            id="displayName"
            value={displayName}
            onChange={(event) => {
              setDisplayNameTouched(true);
              setDisplayName(event.target.value);
            }}
            placeholder={copy.placeholders.displayName.replace("{type}", contentLabel)}
          />
          {autofillNote ? <div className="stat">{autofillNote}</div> : null}

          <label className="form-label" htmlFor="version">
            {copy.fields.version}
          </label>
          <input
            className="form-input"
            id="version"
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            placeholder="1.0.0"
          />
          {slugIntent.kind === "owned" && latestOwnedVersion ? (
            <div className="stat">
              {copy.status.latestVersion.replace("{version}", latestOwnedVersion)}
            </div>
          ) : null}

          <label className="form-label" htmlFor="tags">
            {copy.fields.tags}
          </label>
          <input
            className="form-input"
            id="tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="latest, stable"
          />
          <div className="form-label">分类</div>
          {categoriesQuery.isLoading ? (
            <div className="stat">正在加载分类...</div>
          ) : categoryOptions.length === 0 ? (
            <div className="stat">未选择分类时将发布为未分类。</div>
          ) : (
            <div className="category-checkbox-grid">
              {categoryOptions.map((category) => (
                <label key={category.slug} className="category-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedCategorySlugs.includes(category.slug)}
                    onChange={() => {
                      setSelectedCategorySlugs((current) =>
                        current.includes(category.slug)
                          ? current.filter((categorySlug) => categorySlug !== category.slug)
                          : [...current, category.slug],
                      );
                    }}
                  />
                  <span>{category.name}</span>
                </label>
              ))}
            </div>
          )}
          <div className="documentation-links-editor">
            <div className="documentation-links-editor-header">
              <div>
                <div className="form-label">{copy.documentationLinks.title}</div>
                <div className="stat">{copy.documentationLinks.description}</div>
              </div>
              <span className="stat">{copy.documentationLinks.limit}</span>
            </div>
            <div className="documentation-link-rows">
              {documentationLinkRows.map((link, index) => (
                <div className="documentation-link-row" key={index}>
                  <label className="form-label">
                    {copy.documentationLinks.titleLabel}
                    <input
                      className="form-input"
                      aria-label={`${copy.documentationLinks.titleLabel} ${index + 1}`}
                      value={link.title}
                      maxLength={MAX_DOCUMENTATION_LINK_TITLE_LENGTH}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateDocumentationLinks((current) =>
                          current.map((entry, currentIndex) =>
                            currentIndex === index ? { ...entry, title: value } : entry,
                          ),
                        );
                      }}
                      placeholder={copy.documentationLinks.titlePlaceholder}
                    />
                  </label>
                  <label className="form-label">
                    {copy.documentationLinks.urlLabel}
                    <input
                      className="form-input"
                      aria-label={`${copy.documentationLinks.urlLabel} ${index + 1}`}
                      value={link.url}
                      maxLength={MAX_DOCUMENTATION_LINK_URL_LENGTH}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateDocumentationLinks((current) =>
                          current.map((entry, currentIndex) =>
                            currentIndex === index ? { ...entry, url: value } : entry,
                          ),
                        );
                      }}
                      placeholder={copy.documentationLinks.urlPlaceholder}
                    />
                  </label>
                  <button
                    className="btn documentation-link-remove"
                    type="button"
                    aria-label={copy.documentationLinks.remove.replace(
                      "{index}",
                      String(index + 1),
                    )}
                    onClick={() =>
                      updateDocumentationLinks((current) =>
                        current.filter((_, currentIndex) => currentIndex !== index),
                      )
                    }
                  >
                    {copy.actions.removeFile}
                  </button>
                </div>
              ))}
            </div>
            <button
              className="btn documentation-link-add"
              type="button"
              disabled={documentationLinkRows.length >= MAX_DOCUMENTATION_LINKS}
              onClick={() =>
                updateDocumentationLinks((current) => [...current, { title: "", url: "" }])
              }
            >
              {copy.documentationLinks.add}
            </button>
          </div>
        </div>

        <div className="card upload-panel">
          <label
            className={`upload-dropzone${isDragging ? " is-dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              const items = event.dataTransfer.items;
              void (async () => {
                const dropped = items?.length
                  ? await expandDroppedItems(items)
                  : Array.from(event.dataTransfer.files);
                await applyExpandedFiles(dropped);
              })();
            }}
          >
            <input
              ref={fileInputRef}
              className="upload-file-input"
              id="upload-files"
              data-testid="upload-input"
              type="file"
              multiple
              // @ts-expect-error - non-standard attribute to allow folder selection
              webkitdirectory=""
              directory=""
              onChange={(event) => {
                const picked = Array.from(event.target.files ?? []);
                void applyExpandedFiles(picked);
              }}
            />
            <div className="upload-dropzone-copy">
              <div className="upload-dropzone-title-row">
                <strong>{copy.dropzone.title}</strong>
                <span className="upload-dropzone-count">
                  {files.length} 个文件 · {sizeLabel}
                </span>
              </div>
              <span className="upload-dropzone-hint">{copy.dropzone.hint}</span>
              <button
                className="btn upload-picker-btn"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                {copy.dropzone.chooseFolder}
              </button>
            </div>
          </label>

          <div className="upload-file-list">
            {files.length === 0 ? (
              <div className="stat">{copy.dropzone.noFiles}</div>
            ) : (
              normalizedPaths.map((path, index) => (
                <div key={path} className="upload-file-row">
                  <span>{path}</span>
                  <button
                    className="upload-remove"
                    type="button"
                    onClick={() => handleRemoveFile(index)}
                  >
                    {copy.actions.removeFile}
                  </button>
                </div>
              ))
            )}
          </div>
          {ignoredMacJunkNote ? <div className="stat">{ignoredMacJunkNote}</div> : null}
        </div>

        <div className="card upload-panel" ref={validationRef}>
          <h2 className="upload-panel-title">{copy.validation.title}</h2>
          {validation.issues.length === 0 ? (
            <div className="stat">{copy.validation.allPassed}</div>
          ) : (
            <ul className="validation-list">
              {validation.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="card upload-panel">
          <label className="form-label" htmlFor="changelog">
            {copy.fields.changelog}
          </label>
          <textarea
            className="form-input"
            id="changelog"
            rows={6}
            value={changelog}
            onChange={(event) => {
              changelogTouchedRef.current = true;
              setChangelogSource("user");
              setChangelog(event.target.value);
            }}
            placeholder={copy.placeholders.changelog.replace("{type}", contentLabel)}
          />
          {changelogSource === "user" && changelog ? (
            <div className="stat">{copy.status.changelogReady}</div>
          ) : null}
        </div>

        <div className="upload-submit-row">
          <div className="upload-submit-notes">
            {error ? (
              <div className="error" role="alert">
                {error}
              </div>
            ) : null}
            {status ? <div className="stat">{status}</div> : null}
            {hasAttempted && !validation.ready ? (
              <div className="stat">{copy.validation.fixIssues}</div>
            ) : null}
          </div>
          <button
            className="btn btn-primary upload-submit-btn"
            type="submit"
            disabled={submitDisabled}
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </main>
  );
}
