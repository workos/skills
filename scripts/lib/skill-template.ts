import type { SkillSpec } from "./types.ts";

/** Generate YAML frontmatter block */
export function renderFrontmatter(spec: SkillSpec): string {
  // Escape any quotes in description
  const desc = spec.description.replace(/"/g, '\\"');
  return `---\nname: ${spec.name}\ndescription: ${desc}\n---`;
}

/** Generate the full SKILL.md content from a SkillSpec */
export function renderSkill(spec: SkillSpec): string {
  const parts: string[] = [];

  parts.push(renderFrontmatter(spec));
  parts.push("");
  parts.push("<!-- generated -->");
  parts.push("");
  parts.push(`# ${spec.title}`);
  parts.push("");
  parts.push(renderDocFetchSection(spec.docUrls));
  parts.push(renderWhenToUse(spec));
  parts.push(renderPrerequisites(spec));
  parts.push(renderImplementationGuide(spec));
  parts.push(renderVerificationChecklist(spec));
  parts.push(renderErrorRecovery(spec));
  parts.push(renderRelatedSkills(spec));

  return parts.join("\n");
}

/** Step 1: Fetch Documentation section with doc URLs */
export function renderDocFetchSection(docUrls: string[]): string {
  const lines = [
    "## Step 1: Fetch Documentation",
    "",
    "**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**",
    "",
  ];

  if (docUrls.length === 0) {
    lines.push(
      "No specific doc URLs available. Check https://workos.com/docs for current documentation.",
    );
  } else {
    // Show up to 8 URLs to keep it focused
    const urls = docUrls.slice(0, 8);
    for (const url of urls) {
      lines.push(`- ${url}`);
    }
    if (docUrls.length > 8) {
      lines.push(
        `\n_${docUrls.length - 8} additional doc pages available at https://workos.com/docs_`,
      );
    }
  }

  lines.push("");
  return lines.join("\n");
}

/** Extract a "When to Use" section from the content */
export function renderWhenToUse(spec: SkillSpec): string {
  const lines = ["## When to Use", ""];

  // Try to extract intro paragraph (first non-empty paragraph before any heading)
  const intro = extractIntro(spec.content);
  if (intro) {
    lines.push(intro);
  } else {
    lines.push(
      `Use this skill when implementing ${spec.title.replace("WorkOS ", "")} in your application.`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

/** Extract prerequisites from content */
export function renderPrerequisites(spec: SkillSpec): string {
  const lines = [
    "## Prerequisites",
    "",
    "- A WorkOS account and API keys (`WORKOS_API_KEY`, `WORKOS_CLIENT_ID`)",
    "- WorkOS SDK installed in your project",
  ];

  // Look for prerequisite-like content
  const prereqs = extractPrerequisites(spec.content);
  for (const p of prereqs) {
    lines.push(`- ${p}`);
  }

  lines.push("");
  return lines.join("\n");
}

/** Build the implementation guide with decision trees and steps */
export function renderImplementationGuide(spec: SkillSpec): string {
  const lines = ["## Implementation Guide", ""];

  // Extract steps/flow from content
  const steps = extractSteps(spec.content);
  if (steps.length > 0) {
    for (const step of steps) {
      lines.push(step);
    }
  } else {
    lines.push(
      "Refer to the fetched documentation for step-by-step implementation details.",
    );
    lines.push("");
    lines.push("### General Flow");
    lines.push("");
    lines.push("1. Configure WorkOS Dashboard settings");
    lines.push("2. Install and configure the SDK");
    lines.push("3. Implement the feature endpoints/handlers");
    lines.push("4. Test the integration");
  }

  lines.push("");
  return lines.join("\n");
}

/** Build verification checklist */
export function renderVerificationChecklist(spec: SkillSpec): string {
  const lines = ["## Verification Checklist", ""];

  const checks = extractVerificationItems(spec.content);
  if (checks.length > 0) {
    for (const check of checks) {
      lines.push(`- [ ] ${check}`);
    }
  } else {
    lines.push("- [ ] WorkOS Dashboard configuration is complete");
    lines.push("- [ ] SDK is installed and imported correctly");
    lines.push("- [ ] Feature endpoints respond correctly");
    lines.push("- [ ] Error cases are handled gracefully");
    lines.push("- [ ] Application builds without errors");
  }

  lines.push("");
  return lines.join("\n");
}

/** Build error recovery section */
export function renderErrorRecovery(spec: SkillSpec): string {
  const lines = ["## Error Recovery", ""];

  const errors = extractErrorPatterns(spec.content);
  if (errors.length > 0) {
    for (const err of errors) {
      lines.push(`### ${err.title}`);
      lines.push("");
      lines.push(err.fix);
      lines.push("");
    }
  } else {
    lines.push("### API Key Issues");
    lines.push("");
    lines.push("- Verify `WORKOS_API_KEY` starts with `sk_`");
    lines.push("- Check key has appropriate permissions in WorkOS Dashboard");
    lines.push("");
    lines.push("### SDK Import Errors");
    lines.push("");
    lines.push("- Verify SDK package is installed");
    lines.push("- Check import paths match SDK version");
  }

  lines.push("");
  return lines.join("\n");
}

/** Build related skills section */
export function renderRelatedSkills(spec: SkillSpec): string {
  const related = getRelatedSkills(spec.anchor);
  if (related.length === 0) return "";

  const lines = ["## Related Skills", ""];
  for (const r of related) {
    lines.push(`- **${r.name}**: ${r.description}`);
  }
  lines.push("");
  return lines.join("\n");
}

// --- Content extraction helpers ---

/** Extract the intro paragraph before any heading */
function extractIntro(content: string): string | null {
  const lines = content.split("\n");
  const introParts: string[] = [];

  for (const line of lines) {
    if (line.startsWith("#")) break;
    if (line.startsWith("---")) break;
    const trimmed = line.trim();
    if (trimmed) introParts.push(trimmed);
    if (introParts.length > 0 && !trimmed) break; // Stop at first blank line after content
  }

  const intro = introParts.join(" ").trim();
  // Only return if we got something meaningful (>20 chars)
  return intro.length > 20 ? intro : null;
}

/** Extract prerequisite-like items from content */
function extractPrerequisites(content: string): string[] {
  const prereqs: string[] = [];
  const lines = content.split("\n");

  // Look for sections with "prerequisite", "before you", "requirements"
  let inPrereqSection = false;
  for (const line of lines) {
    if (
      /^#{2,4}\s.*(prerequisit|before you|requirement|getting started)/i.test(
        line,
      )
    ) {
      inPrereqSection = true;
      continue;
    }
    if (inPrereqSection && /^#{2,4}\s/.test(line)) {
      inPrereqSection = false;
      continue;
    }
    if (inPrereqSection && line.match(/^[-*]\s+(.+)/)) {
      prereqs.push(line.replace(/^[-*]\s+/, "").trim());
    }
  }

  return prereqs.slice(0, 6); // Cap at 6
}

/** Extract ordered steps from content */
function extractSteps(content: string): string[] {
  const steps: string[] = [];
  const lines = content.split("\n");

  // Look for ### headings that describe steps/flow
  let currentHeading = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^### (.+)/);
    if (headingMatch) {
      if (currentHeading && currentContent.length > 0) {
        steps.push(`### ${currentHeading}`);
        steps.push("");
        steps.push(...currentContent.slice(0, 8)); // Cap content per section
        steps.push("");
      }
      currentHeading = headingMatch[1];
      currentContent = [];
      continue;
    }
    if (currentHeading) {
      const trimmed = line.trim();
      if (trimmed) currentContent.push(trimmed);
    }
  }

  // Last section
  if (currentHeading && currentContent.length > 0) {
    steps.push(`### ${currentHeading}`);
    steps.push("");
    steps.push(...currentContent.slice(0, 8));
    steps.push("");
  }

  return steps.slice(0, 60); // Keep implementation guide reasonable
}

/** Extract verification-like items */
function extractVerificationItems(content: string): string[] {
  const checks: string[] = [];
  const lines = content.split("\n");

  // Look for checklist items, test steps, verification patterns
  for (const line of lines) {
    const checkMatch = line.match(/^[-*]\s+\[[ x]\]\s+(.+)/);
    if (checkMatch) {
      checks.push(checkMatch[1]);
      continue;
    }
    // Look for "verify", "confirm", "test" in list items
    const verifyMatch = line.match(
      /^[-*]\s+((?:verify|confirm|test|check|ensure).+)/i,
    );
    if (verifyMatch) {
      checks.push(verifyMatch[1]);
    }
  }

  return checks.slice(0, 8);
}

/** Extract error patterns from content */
function extractErrorPatterns(
  content: string,
): Array<{ title: string; fix: string }> {
  const errors: Array<{ title: string; fix: string }> = [];
  const lines = content.split("\n");

  // Look for error-related headings
  let inErrorSection = false;
  let errorTitle = "";
  let errorContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#{2,4}\s+(.+)/);
    if (headingMatch) {
      const title = headingMatch[1];
      if (/error|troubleshoot|debug|issue|problem|fix/i.test(title)) {
        if (errorTitle && errorContent.length > 0) {
          errors.push({ title: errorTitle, fix: errorContent.join("\n") });
        }
        inErrorSection = true;
        errorTitle = title;
        errorContent = [];
        continue;
      }
      if (inErrorSection) {
        if (errorTitle && errorContent.length > 0) {
          errors.push({ title: errorTitle, fix: errorContent.join("\n") });
        }
        inErrorSection = false;
        errorTitle = "";
        errorContent = [];
      }
    }
    if (inErrorSection) {
      const trimmed = line.trim();
      if (trimmed) errorContent.push(trimmed);
    }
  }

  if (errorTitle && errorContent.length > 0) {
    errors.push({ title: errorTitle, fix: errorContent.join("\n") });
  }

  return errors.slice(0, 5);
}

/** Map of anchor → related skill references */
function getRelatedSkills(
  anchor: string,
): Array<{ name: string; description: string }> {
  const relationships: Record<
    string,
    Array<{ name: string; description: string }>
  > = {
    sso: [
      {
        name: "workos-integrations",
        description: "Provider-specific SSO setup",
      },
      { name: "workos-rbac", description: "Role-based access after SSO" },
      {
        name: "workos-directory-sync",
        description: "Sync user directories from IdPs",
      },
    ],
    "directory-sync": [
      { name: "workos-sso", description: "Single Sign-On configuration" },
      {
        name: "workos-integrations",
        description: "Provider-specific directory setup",
      },
    ],
    rbac: [
      { name: "workos-fga", description: "Fine-grained authorization" },
      { name: "workos-sso", description: "SSO for authenticated access" },
    ],
    fga: [{ name: "workos-rbac", description: "Role-based access control" }],
    "audit-logs": [
      { name: "workos-events", description: "Webhook event handling" },
    ],
    events: [
      { name: "workos-audit-logs", description: "Audit log integration" },
    ],
    mfa: [
      { name: "workos-sso", description: "SSO for primary authentication" },
    ],
    "magic-link": [
      { name: "workos-mfa", description: "Add MFA to passwordless flows" },
    ],
    vault: [{ name: "workos-audit-logs", description: "Audit data access" }],
    widgets: [
      {
        name: "workos-admin-portal",
        description: "Admin Portal for enterprise management",
      },
    ],
    "admin-portal": [
      { name: "workos-sso", description: "SSO configuration via portal" },
      {
        name: "workos-directory-sync",
        description: "Directory setup via portal",
      },
      { name: "workos-widgets", description: "Embeddable UI components" },
    ],
    integrations: [
      { name: "workos-sso", description: "General SSO implementation" },
      { name: "workos-directory-sync", description: "Directory Sync setup" },
    ],
    "domain-verification": [
      { name: "workos-sso", description: "SSO requires verified domains" },
      {
        name: "workos-directory-sync",
        description: "Directory Sync requires verified domains",
      },
    ],
    "feature-flags": [],
    "custom-domains": [],
    email: [],
    pipes: [],
  };

  return relationships[anchor] ?? [];
}
