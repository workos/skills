import type { SectionConfig } from "./types.ts";

/** Known section anchors from llms-full.txt as of 2026-02-06 */
export const KNOWN_ANCHORS = [
  "postman",
  "on-prem-deployment",
  "glossary",
  "email",
  "widgets",
  "vault",
  "sso",
  "sdks",
  "reference",
  "rbac",
  "pipes",
  "migrate",
  "mfa",
  "magic-link",
  "integrations",
  "fga",
  "feature-flags",
  "events",
  "domain-verification",
  "directory-sync",
  "custom-domains",
  "authkit",
  "audit-logs",
  "admin-portal",
] as const;

/** Hand-crafted skill names that must never be overwritten */
export const HAND_CRAFTED_SKILLS = [
  "workos-authkit-base",
  "workos-authkit-nextjs",
  "workos-authkit-react",
  "workos-authkit-react-router",
  "workos-authkit-tanstack-start",
  "workos-authkit-vanilla-js",
] as const;

/** Per-section split strategy configuration */
export const SECTION_CONFIG: Record<string, SectionConfig> = {
  postman: { split: { strategy: "single" }, skip: true },
  "on-prem-deployment": { split: { strategy: "single" }, skip: true },
  glossary: { split: { strategy: "single" }, skip: true },
  email: { split: { strategy: "single" } },
  widgets: { split: { strategy: "single" } },
  vault: { split: { strategy: "single" } },
  sso: { split: { strategy: "single" } },
  sdks: { split: { strategy: "single" }, skip: true },
  reference: { split: { strategy: "per-api-domain" } },
  rbac: { split: { strategy: "single" } },
  pipes: { split: { strategy: "single" }, skip: true },
  migrate: { split: { strategy: "per-subsection" } },
  mfa: { split: { strategy: "single" } },
  "magic-link": { split: { strategy: "single" }, skip: true },
  integrations: { split: { strategy: "single" } },
  fga: { split: { strategy: "single" }, skip: true },
  "feature-flags": { split: { strategy: "single" }, skip: true },
  events: { split: { strategy: "single" } },
  "domain-verification": { split: { strategy: "single" }, skip: true },
  "directory-sync": { split: { strategy: "single" } },
  "custom-domains": { split: { strategy: "single" } },
  authkit: { split: { strategy: "skip" } },
  "audit-logs": { split: { strategy: "single" } },
  "admin-portal": { split: { strategy: "single" } },
};

/** Validation thresholds */
export const VALIDATION = {
  expectedSectionCount: 24,
  sectionCountTolerance: 3,
  maxSectionSize: 600_000,
  minTotalSize: 700_000,
  maxTotalSize: 1_800_000,
  minSkillSize: 500,
  maxSkillSize: 50_000,
} as const;
