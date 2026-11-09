import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { PublicCategory } from "../lib/publicUser";
import type { ManagedSkillListResponse, SearchResult } from "../types/api";
import { bundlesCopy } from "../copy/bundles";
import { useBundle } from "../hooks/useBundle";
import { useCategories } from "../hooks/useCategories";
import { usePublishBundle } from "../hooks/usePublishBundle";
import { useSearchSkills } from "../hooks/useSearchSkills";
import { ApiError } from "../lib/api-client";
import { mapBundleSkillItemToListEntry } from "../lib/apiBundles";
import { apiRequest } from "../lib/apiClient";
import {
  MAX_DOCUMENTATION_LINKS,
  MAX_DOCUMENTATION_LINK_TITLE_LENGTH,
  MAX_DOCUMENTATION_LINK_URL_LENGTH,
  normalizeDocumentationLinkRows,
  type DocumentationLinkRow,
  type DocumentationLinkValidationIssue,
} from "../lib/documentationLinks";
import { deriveSlugFromName } from "../lib/skillFrontmatter";
import { useAuthStatus } from "../lib/useAuthStatus";

const BUNDLE_SLUG_PATTERN = /^[a-z0-9-]+$/;
const MAX_BUNDLE_SKILLS = 50;

type BundleFormPageProps = {
  editSlug?: string;
  embedded?: boolean;
};

type BundleFormSkill = {
  slug: string;
  displayName?: string;
  summary?: string | null;
  version?: string | null;
  ownerHandle?: string | null;
  ownerDisplayName?: string | null;
  categories: PublicCategory[];
  deleted?: boolean;
};

function skillFromManaged(item: ManagedSkillListResponse["items"][number]): BundleFormSkill {
  return {
    slug: item.slug,
    displayName: item.displayName,
    summary: item.summary,
    version: item.latestVersion?.version ?? null,
    ownerHandle: item.owner?.handle ?? null,
    ownerDisplayName: item.owner?.displayName ?? null,
    categories: item.categories ?? [],
    deleted: item.isDeleted,
  };
}

function skillFromSearchResult(item: SearchResult): BundleFormSkill {
  return {
    slug: item.slug,
    displayName: item.displayName,
    summary: item.summary,
    version: item.version ?? null,
    ownerHandle: null,
    ownerDisplayName: null,
    categories: item.categories ?? [],
  };
}

function moveItem<T>(items: T[], from: number, to: number) {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function skillMeta(skill: BundleFormSkill) {
  const parts = [
    `/${skill.slug}`,
    skill.ownerDisplayName
      ? `@${skill.ownerDisplayName}`
      : skill.ownerHandle
        ? `@${skill.ownerHandle}`
        : null,
    skill.version ? `v${skill.version}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function formatDocumentationLinkIssue(
  issue: DocumentationLinkValidationIssue,
  copy: typeof bundlesCopy.form.validation,
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

export function BundleFormPage({ editSlug, embedded }: BundleFormPageProps) {
  const copy = bundlesCopy.form;
  const navigate = useNavigate();
  const { isAuthenticated, me, isLoading: isAuthLoading } = useAuthStatus();
  const isEdit = Boolean(editSlug);
  const bundleQuery = useBundle(editSlug ?? "", { enabled: Boolean(editSlug) && isAuthenticated });
  const categoriesQuery = useCategories({ enabled: isAuthenticated });
  const publishBundle = usePublishBundle();

  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(Boolean(editSlug));
  const [description, setDescription] = useState("");
  const [selectedCategorySlugs, setSelectedCategorySlugs] = useState<string[]>([]);
  const [documentationLinkRows, setDocumentationLinkRows] = useState<DocumentationLinkRow[]>([]);
  const documentationLinksTouchedRef = useRef(false);
  const [selectedSkills, setSelectedSkills] = useState<BundleFormSkill[]>([]);
  const [mySkillQuery, setMySkillQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [hasAttempted, setHasAttempted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const mySkillsQuery = useQuery({
    queryKey: ["my", "skills", "bundle-form", mySkillQuery],
    queryFn: () => {
      const params = new URLSearchParams({ status: "active" });
      if (mySkillQuery.trim()) params.set("q", mySkillQuery.trim());
      return apiRequest<ManagedSkillListResponse>(`/my/skills?${params.toString()}`);
    },
    enabled: isAuthenticated,
    retry: false,
  });
  const searchSkillsQuery = useSearchSkills(searchQuery, {
    enabled: isAuthenticated && searchQuery.trim().length > 0,
  });

  useEffect(() => {
    if (!editSlug || !bundleQuery.data) return;
    const bundle = bundleQuery.data.bundle;
    setDisplayName(bundle.displayName);
    setSlug(bundle.slug);
    setSlugTouched(true);
    setDescription(bundle.description ?? "");
    setSelectedCategorySlugs((bundle.categories ?? []).map((category) => category.slug));
    if (!documentationLinksTouchedRef.current) {
      setDocumentationLinkRows(
        (bundle.documentationLinks ?? []).map((link) => ({
          title: link.title ?? "",
          url: link.url,
        })),
      );
    }
    setSelectedSkills(bundleQuery.data.skills.map((skill) => mapBundleSkillItemToListEntry(skill)));
  }, [bundleQuery.data, editSlug]);

  const categoryOptions = useMemo(
    () =>
      (categoriesQuery.data?.items ?? []).filter((category) => category.slug !== "uncategorized"),
    [categoriesQuery.data?.items],
  );

  const selectedSkillSlugs = useMemo(
    () => new Set(selectedSkills.map((skill) => skill.slug)),
    [selectedSkills],
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
    [copy.validation, documentationLinksResult.issues],
  );

  const validation = useMemo(() => {
    const issues: string[] = [];
    const trimmedSlug = slug.trim();
    if (!displayName.trim()) issues.push(copy.validation.displayNameRequired);
    if (!trimmedSlug) {
      issues.push(copy.validation.slugRequired);
    } else if (trimmedSlug.length < 3 || trimmedSlug.length > 50) {
      issues.push(copy.validation.slugLength);
    } else if (!BUNDLE_SLUG_PATTERN.test(trimmedSlug)) {
      issues.push(copy.validation.slugFormat);
    }
    if (!description.trim()) issues.push(copy.validation.descriptionRequired);
    if (selectedSkills.length === 0) issues.push(copy.validation.skillsRequired);
    if (selectedSkills.length > MAX_BUNDLE_SKILLS) issues.push(copy.validation.skillsLimit);
    if (selectedSkillSlugs.size !== selectedSkills.length)
      issues.push(copy.validation.duplicateSkill);
    issues.push(...documentationLinkIssues);
    return { issues, ready: issues.length === 0 };
  }, [
    copy.validation,
    description,
    displayName,
    documentationLinkIssues,
    selectedSkillSlugs.size,
    selectedSkills.length,
    slug,
  ]);

  const canManage =
    !isEdit ||
    me?.isSuperuser === true ||
    (bundleQuery.data?.bundle.owner?.handle && bundleQuery.data.bundle.owner.handle === me?.handle);

  const addSkill = (skill: BundleFormSkill) => {
    setSelectedSkills((current) => {
      if (current.some((entry) => entry.slug === skill.slug)) return current;
      if (current.length >= MAX_BUNDLE_SKILLS) return current;
      return [...current, skill];
    });
  };

  const removeSkill = (targetSlug: string) => {
    setSelectedSkills((current) => current.filter((skill) => skill.slug !== targetSlug));
  };

  const updateDocumentationLinks = (
    updater: (current: DocumentationLinkRow[]) => DocumentationLinkRow[],
  ) => {
    documentationLinksTouchedRef.current = true;
    setDocumentationLinkRows(updater);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setHasAttempted(true);
    setSubmitError(null);
    if (!validation.ready) return;

    const trimmedSlug = slug.trim();
    publishBundle.mutate(
      {
        slug: trimmedSlug,
        displayName: displayName.trim(),
        description: description.trim(),
        categorySlugs: selectedCategorySlugs,
        ...(documentationLinksTouchedRef.current
          ? { documentationLinks: documentationLinksResult.links }
          : {}),
        skills: selectedSkills.map((skill, index) => ({
          slug: skill.slug,
          sortOrder: index + 1,
        })),
      },
      {
        onSuccess: () => {
          void navigate({ to: "/bundles/$slug", params: { slug: trimmedSlug } });
        },
        onError: (error) => {
          const status =
            typeof error === "object" && error && "status" in error ? error.status : null;
          const errorCode =
            error instanceof ApiError &&
            typeof error.data === "object" &&
            error.data &&
            "code" in error.data
              ? error.data.code
              : null;
          setSubmitError(
            errorCode === "invalid_documentation_link"
              ? copy.error.invalidDocumentationLink
              : status === 403
                ? copy.error.permissionDenied
                : copy.error.publishFailed,
          );
        },
      },
    );
  };

  if (isAuthLoading) {
    return (
      <main className="section">
        <div className="card">
          <div className="loading-indicator">{copy.loading}</div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated || !me) {
    return (
      <main className="section">
        <div className="card">{copy.authRequired}</div>
      </main>
    );
  }

  if (isEdit && bundleQuery.isLoading) {
    return (
      <main className="section">
        <div className="card">
          <div className="loading-indicator">{copy.loading}</div>
        </div>
      </main>
    );
  }

  if (isEdit && (bundleQuery.isError || !bundleQuery.data)) {
    return (
      <main className="section">
        <div className="card">{copy.notFound}</div>
      </main>
    );
  }

  if (!canManage) {
    return (
      <main className="section">
        <div className="card">{copy.error.permissionDenied}</div>
      </main>
    );
  }

  const formContent = (
    <form className="bundle-form-vertical" onSubmit={submit}>
      <div className="card upload-panel">
        <label className="form-label" htmlFor="bundle-display-name">
          <span className="required-dot" aria-hidden="true">
            *
          </span>
          {copy.fields.displayName}
        </label>
        <input
          id="bundle-display-name"
          className="form-input"
          value={displayName}
          onChange={(event) => {
            const next = event.target.value;
            setDisplayName(next);
            if (!slugTouched && !isEdit) setSlug(deriveSlugFromName(next));
          }}
          placeholder={copy.fields.displayNamePlaceholder}
        />

        <label className="form-label" htmlFor="bundle-slug">
          <span className="required-dot" aria-hidden="true">
            *
          </span>
          {copy.fields.slug}
        </label>
        <input
          id="bundle-slug"
          className="form-input mono"
          value={slug}
          disabled={isEdit}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.target.value.toLowerCase());
          }}
          placeholder={copy.fields.slugPlaceholder}
        />
        {isEdit ? <div className="stat">{copy.fields.slugReadonlyNote}</div> : null}

        <label className="form-label" htmlFor="bundle-description">
          <span className="required-dot" aria-hidden="true">
            *
          </span>
          {copy.fields.description}
        </label>
        <textarea
          id="bundle-description"
          className="form-input"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={copy.fields.descriptionPlaceholder}
          rows={6}
        />

        <div className="form-label">{copy.fields.categories}</div>
        {categoriesQuery.isLoading ? (
          <div className="stat">{copy.loadingCategories}</div>
        ) : categoryOptions.length === 0 ? (
          <div className="stat">{copy.noCategories}</div>
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
                  aria-label={copy.documentationLinks.remove.replace("{index}", String(index + 1))}
                  onClick={() =>
                    updateDocumentationLinks((current) =>
                      current.filter((_, currentIndex) => currentIndex !== index),
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
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
        <h2 className="upload-panel-title">{copy.fields.skills}</h2>
        <section style={{ display: "grid", gap: "0.75rem" }}>
          <h3 className="section-title" style={{ fontSize: "1rem", margin: 0 }}>
            {copy.skills.mySkills}
          </h3>
          <input
            className="form-input"
            value={mySkillQuery}
            onChange={(event) => setMySkillQuery(event.target.value)}
            placeholder={copy.skills.mySkillsSearchPlaceholder}
          />
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {mySkillsQuery.isLoading ? <div className="stat">{copy.loadingSkills}</div> : null}
            {(mySkillsQuery.data?.items ?? []).map((skill) => {
              const entry = skillFromManaged(skill);
              const isSelected = selectedSkillSlugs.has(entry.slug);
              return (
                <button
                  key={entry.slug}
                  className="btn btn-ghost"
                  type="button"
                  disabled={isSelected}
                  onClick={() => addSkill(entry)}
                  style={{ justifyContent: "space-between", gap: "0.5rem" }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      minWidth: 0,
                    }}
                  >
                    {entry.displayName} <span className="stat">{skillMeta(entry)}</span>
                  </span>
                  <span style={{ flexShrink: 0 }}>
                    {isSelected ? copy.skills.added : copy.skills.add}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section style={{ display: "grid", gap: "0.75rem", marginTop: "1.5rem" }}>
          <h3 className="section-title" style={{ fontSize: "1rem", margin: 0 }}>
            {copy.skills.searchSkills}
          </h3>
          <input
            className="form-input"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={copy.skills.searchPlaceholder}
          />
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {searchSkillsQuery.isLoading ? <div className="stat">{copy.loadingSkills}</div> : null}
            {(searchSkillsQuery.data?.results ?? []).map((skill) => {
              const entry = skillFromSearchResult(skill);
              const isSelected = selectedSkillSlugs.has(entry.slug);
              return (
                <button
                  key={entry.slug}
                  className="btn btn-ghost"
                  type="button"
                  disabled={isSelected}
                  onClick={() => addSkill(entry)}
                  style={{ justifyContent: "space-between", gap: "0.5rem" }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      minWidth: 0,
                    }}
                  >
                    {entry.displayName} <span className="stat">{skillMeta(entry)}</span>
                  </span>
                  <span style={{ flexShrink: 0 }}>
                    {isSelected ? copy.skills.added : copy.skills.add}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <div className="card upload-panel">
        <h2 className="upload-panel-title">{copy.skills.selectedTitle}</h2>
        {selectedSkills.length === 0 ? (
          <div className="stat">{copy.skills.emptySelected}</div>
        ) : null}
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {selectedSkills.map((skill, index) => (
            <article
              key={skill.slug}
              className="card"
              style={{ padding: "0.75rem", display: "grid", gap: "0.5rem", overflow: "hidden" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                <div style={{ overflow: "hidden", minWidth: 0 }}>
                  <strong
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "block",
                    }}
                  >
                    {skill.displayName ?? skill.slug}
                  </strong>
                  <div
                    className="stat"
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {skillMeta(skill)}
                  </div>
                  {skill.deleted ? <div className="form-error">{copy.skills.deleted}</div> : null}
                </div>
                <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    type="button"
                    disabled={index === 0}
                    onClick={() =>
                      setSelectedSkills((current) => moveItem(current, index, index - 1))
                    }
                  >
                    <ArrowUp className="h-3 w-3" aria-hidden="true" />
                    {copy.skills.moveUp}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    type="button"
                    disabled={index === selectedSkills.length - 1}
                    onClick={() =>
                      setSelectedSkills((current) => moveItem(current, index, index + 1))
                    }
                  >
                    <ArrowDown className="h-3 w-3" aria-hidden="true" />
                    {copy.skills.moveDown}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    type="button"
                    onClick={() => removeSkill(skill.slug)}
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                    {copy.skills.remove}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {hasAttempted && validation.issues.length > 0 ? (
          <ul className="validation-list">
            {validation.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : null}
        {submitError ? <p className="form-error">{submitError}</p> : null}

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
          <button className="btn btn-primary" type="submit" disabled={publishBundle.isPending}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {publishBundle.isPending
              ? isEdit
                ? copy.submit.updating
                : copy.submit.creating
              : isEdit
                ? copy.submit.update
                : copy.submit.create}
          </button>
          <Link
            to="/bundles"
            search={{ sort: "downloads", dir: "desc", view: undefined }}
            className="btn btn-ghost"
          >
            {copy.actions.cancel}
          </Link>
        </div>
      </div>
    </form>
  );

  if (embedded) return formContent;

  return (
    <main className="section">
      <header className="skills-header-top">
        <h1 className="section-title" style={{ marginBottom: 8 }}>
          {isEdit ? copy.titleEdit : copy.titleCreate}
        </h1>
        <p className="section-subtitle" style={{ marginBottom: 0 }}>
          {copy.subtitle}
        </p>
      </header>
      {formContent}
    </main>
  );
}
