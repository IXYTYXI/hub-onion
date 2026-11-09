import type { DocumentationLink } from "../types/api";
import { skillsCopy } from "../copy/skills";
import { getDocumentationLinkHostname } from "../lib/documentationLinks";

type DocumentationLinksProps = {
  links: DocumentationLink[];
  copy?: {
    title: string;
    subtitle: string;
  };
};

export function DocumentationLinks({
  links,
  copy = skillsCopy.detail.documentationLinks,
}: DocumentationLinksProps) {
  const displayLinks = links
    .map((link) => ({ ...link, hostname: getDocumentationLinkHostname(link.url) }))
    .filter((link) => link.hostname);

  if (displayLinks.length === 0) return null;

  return (
    <section className="card skill-documentation-links" aria-labelledby="documentation-links-title">
      <div>
        <h2 id="documentation-links-title" className="section-title">
          {copy.title}
        </h2>
        <p className="section-subtitle">{copy.subtitle}</p>
      </div>
      <ul className="skill-documentation-links-list">
        {displayLinks.map((link) => {
          const title = link.title?.trim();
          return (
            <li className="skill-documentation-link" key={link.url}>
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                {title || link.hostname}
              </a>
              {title ? <span>{link.hostname}</span> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export const SkillDocumentationLinks = DocumentationLinks;
