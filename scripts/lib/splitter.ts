import type { Section, SkillSpec, SplitStrategy } from "./types.ts";
import { SECTION_CONFIG, HAND_CRAFTED_SKILLS } from "./config.ts";

/**
 * Parse llms.txt to extract a map of section slug → doc page URLs.
 *
 * Format per section:
 *   ## Section Name
 *   - [Title](https://workos.com/docs/slug/page): Description
 */
export function parseLlmsTxtUrls(llmsTxt: string): Map<string, string[]> {
  const urlMap = new Map<string, string[]>();
  let currentSlug: string | null = null;

  for (const line of llmsTxt.split("\n")) {
    const sectionMatch = line.match(/^## (.+)$/);
    if (sectionMatch) {
      // Derive slug from section name → lowercase, spaces to hyphens
      currentSlug = sectionNameToSlug(sectionMatch[1]);
      if (!urlMap.has(currentSlug)) {
        urlMap.set(currentSlug, []);
      }
      continue;
    }

    if (currentSlug) {
      const urlMatch = line.match(/\[.*?\]\((https?:\/\/[^)]+)\)/);
      if (urlMatch) {
        urlMap.get(currentSlug)!.push(urlMatch[1]);
      }
    }
  }

  return urlMap;
}

/** Convert a display section name to a slug matching llms-full.txt anchors */
export function sectionNameToSlug(name: string): string {
  const overrides: Record<string, string> = {
    "Single Sign-On": "sso",
    "Multi-Factor Auth": "mfa",
    "Magic Link": "magic-link",
    "API Reference": "reference",
    "On prem deployment": "on-prem-deployment",
    "Feature Flags": "feature-flags",
    "Domain Verification": "domain-verification",
    "Directory Sync": "directory-sync",
    "Custom Domains": "custom-domains",
    "Audit Logs": "audit-logs",
    "Admin Portal": "admin-portal",
    Migrations: "migrate",
    Sdks: "sdks",
  };
  if (overrides[name]) return overrides[name];
  return name.toLowerCase().replace(/\s+/g, "-");
}

/** Produce a human-readable title from an anchor slug */
function slugToTitle(slug: string): string {
  const titles: Record<string, string> = {
    sso: "WorkOS Single Sign-On",
    mfa: "WorkOS Multi-Factor Authentication",
    "magic-link": "WorkOS Magic Link",
    fga: "WorkOS Fine-Grained Authorization",
    rbac: "WorkOS Role-Based Access Control",
    "directory-sync": "WorkOS Directory Sync",
    "audit-logs": "WorkOS Audit Logs",
    "admin-portal": "WorkOS Admin Portal",
    "feature-flags": "WorkOS Feature Flags",
    "domain-verification": "WorkOS Domain Verification",
    "custom-domains": "WorkOS Custom Domains",
    events: "WorkOS Events",
    vault: "WorkOS Vault",
    widgets: "WorkOS Widgets",
    email: "WorkOS Email Delivery",
    pipes: "WorkOS Pipes",
    integrations: "WorkOS Integrations",
  };
  return (
    titles[slug] ??
    `WorkOS ${slug
      .split("-")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" ")}`
  );
}

/** Produce a short action-oriented description for frontmatter */
function slugToDescription(slug: string): string {
  const descriptions: Record<string, string> = {
    sso: "Configure Single Sign-On with SAML and OIDC identity providers.",
    mfa: "Add multi-factor authentication to your application.",
    "magic-link": "Implement passwordless authentication via Magic Link.",
    fga: "Implement fine-grained authorization with WorkOS FGA.",
    rbac: "Set up role-based access control for your application.",
    "directory-sync":
      "Sync user directories from identity providers like Okta, Azure AD, and Google.",
    "audit-logs": "Implement audit logging for compliance and security.",
    "admin-portal":
      "Enable self-service admin portal for your enterprise customers.",
    "feature-flags": "Manage feature flags and rollouts with WorkOS.",
    "domain-verification":
      "Verify organization domains for SSO and directory sync.",
    "custom-domains": "Configure custom domains for WorkOS-hosted pages.",
    events: "Subscribe to and handle WorkOS webhook events.",
    vault: "Encrypt, store, and manage sensitive data with WorkOS Vault.",
    widgets: "Embed WorkOS UI widgets in your application.",
    email: "Configure email delivery for WorkOS authentication flows.",
    pipes: "Connect external services and data sources with WorkOS Pipes.",
    integrations:
      "Set up identity provider integrations with WorkOS. Covers SSO, SCIM, and OAuth for 40+ providers.",
  };
  return (
    descriptions[slug] ??
    `Implement WorkOS ${slugToTitle(slug)} in your application.`
  );
}

/**
 * Split parsed sections into SkillSpecs using per-section strategies from config.
 */
export function splitSections(
  sections: Section[],
  llmsTxtUrls: Map<string, string[]>,
): SkillSpec[] {
  const specs: SkillSpec[] = [];
  const handCraftedSet = new Set<string>(HAND_CRAFTED_SKILLS);

  for (const section of sections) {
    const config = SECTION_CONFIG[section.anchor];
    if (!config) {
      console.warn(`No config for section '${section.anchor}', skipping`);
      continue;
    }

    if (config.skip) continue;

    const strategy = config.split;

    switch (strategy.strategy) {
      case "skip":
        break;

      case "single":
        addSpec(specs, section, llmsTxtUrls, handCraftedSet);
        break;

      case "per-subsection":
        addPerSubsection(specs, section, llmsTxtUrls, handCraftedSet);
        break;

      case "per-feature":
        // Not used in Phase 2 config but supported
        for (const feature of strategy.features) {
          const name = `workos-${feature}`;
          if (handCraftedSet.has(name)) continue;
          const urls = llmsTxtUrls.get(section.anchor) ?? [];
          specs.push({
            name,
            description: slugToDescription(feature),
            title: slugToTitle(feature),
            anchor: section.anchor,
            content: section.content,
            docUrls: urls,
            generated: true,
          });
        }
        break;

      case "per-api-domain":
        // Phase 3 — skip for now
        break;
    }
  }

  return specs;
}

/** Add a single skill spec for an entire section */
function addSpec(
  specs: SkillSpec[],
  section: Section,
  urlMap: Map<string, string[]>,
  handCrafted: Set<string>,
): void {
  const name = `workos-${section.anchor}`;
  if (handCrafted.has(name)) return;

  const urls =
    urlMap.get(section.anchor) ?? constructFallbackUrls(section.anchor);

  specs.push({
    name,
    description: slugToDescription(section.anchor),
    title: slugToTitle(section.anchor),
    anchor: section.anchor,
    content: section.content,
    docUrls: urls,
    generated: true,
  });
}

/**
 * Split section by top-level subsection headings, grouping child subsections
 * under their parent. For "migrate", only "Migrate from X" headings are
 * top-level; everything between them is content for that migration skill.
 */
function addPerSubsection(
  specs: SkillSpec[],
  section: Section,
  urlMap: Map<string, string[]>,
  handCrafted: Set<string>,
): void {
  const sectionUrls = urlMap.get(section.anchor) ?? [];

  if (section.subsections.length === 0) {
    addSpec(specs, section, urlMap, handCrafted);
    return;
  }

  // Group subsections: identify top-level headings, collect children under them
  const groups = groupSubsections(section.subsections, section.anchor);

  for (const group of groups) {
    const subSlug = group.slug;
    const name = `workos-${section.anchor}-${subSlug}`;
    if (handCrafted.has(name)) continue;

    // Find URLs that match this subsection
    const matchingUrls = sectionUrls.filter((url) => {
      const urlSlug = url.split("/").pop() ?? "";
      return (
        urlSlug === subSlug ||
        subSlug.includes(urlSlug) ||
        urlSlug.includes(subSlug)
      );
    });

    const docUrls =
      matchingUrls.length > 0
        ? matchingUrls
        : [`https://workos.com/docs/${section.anchor}/${subSlug}`];

    specs.push({
      name,
      description: `Migrate to WorkOS from ${group.displayName}.`,
      title: `WorkOS Migration: ${group.displayName}`,
      anchor: section.anchor,
      content: group.content,
      docUrls,
      generated: true,
    });
  }
}

interface SubsectionGroup {
  slug: string;
  displayName: string;
  content: string;
}

/**
 * Group subsections by top-level headings.
 * For "migrate", top-level = "Migrate from X". Everything else is a child.
 */
function groupSubsections(
  subsections: Section["subsections"],
  anchor: string,
): SubsectionGroup[] {
  const groups: SubsectionGroup[] = [];

  const isTopLevel = (title: string): boolean => {
    if (anchor === "migrate") {
      return /^Migrate from /i.test(title);
    }
    // Default: every subsection is top-level
    return true;
  };

  let currentGroup: SubsectionGroup | null = null;

  for (const sub of subsections) {
    if (isTopLevel(sub.title)) {
      if (currentGroup) groups.push(currentGroup);

      const displayName = sub.title.replace(/^Migrate\s+from\s+/i, "");
      const slug = displayName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      currentGroup = {
        slug,
        displayName,
        content: sub.content,
      };
    } else if (currentGroup) {
      // Append child subsection content to current group
      currentGroup.content += `\n\n### ${sub.title}\n\n${sub.content}`;
    }
  }

  if (currentGroup) groups.push(currentGroup);
  return groups;
}

/** Fallback: construct a doc URL from the anchor */
function constructFallbackUrls(anchor: string): string[] {
  return [`https://workos.com/docs/${anchor}`];
}
