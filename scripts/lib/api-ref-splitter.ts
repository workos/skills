import type { Section, SkillSpec } from "./types.ts";

/** API domains to generate skills for (feature-relevant domains) */
const API_DOMAINS: Record<string, { title: string; description: string }> = {
  sso: {
    title: "WorkOS SSO API Reference",
    description:
      "WorkOS SSO API endpoints — connections, profiles, authorization URLs, and logout.",
  },
  "directory-sync": {
    title: "WorkOS Directory Sync API Reference",
    description:
      "WorkOS Directory Sync API endpoints — directories, users, groups, and sync events.",
  },
  organization: {
    title: "WorkOS Organizations API Reference",
    description:
      "WorkOS Organizations API endpoints — create, update, list, and manage organizations.",
  },
  authkit: {
    title: "WorkOS AuthKit API Reference",
    description:
      "WorkOS AuthKit API endpoints — users, sessions, authentication, MFA, and organization memberships.",
  },
  "audit-logs": {
    title: "WorkOS Audit Logs API Reference",
    description:
      "WorkOS Audit Logs API endpoints — create events, manage schemas, exports, and retention.",
  },
  events: {
    title: "WorkOS Events API Reference",
    description:
      "WorkOS Events/Webhooks API endpoints — list events, manage webhook endpoints.",
  },
  vault: {
    title: "WorkOS Vault API Reference",
    description:
      "WorkOS Vault API endpoints — create, read, update, delete encrypted objects.",
  },
  roles: {
    title: "WorkOS Roles & Permissions API Reference",
    description:
      "WorkOS RBAC API endpoints — roles, permissions, and role assignments.",
  },
  widgets: {
    title: "WorkOS Widgets API Reference",
    description:
      "WorkOS Widgets API endpoints — generate widget tokens and manage widget configuration.",
  },
  "admin-portal": {
    title: "WorkOS Admin Portal API Reference",
    description:
      "WorkOS Admin Portal API endpoints — generate portal links for customer self-service.",
  },
};

/** Meta/general domains to skip (not feature-specific) */
const SKIP_DOMAINS = new Set([
  "testing",
  "rate-limits",
  "pagination",
  "errors",
  "idempotency",
  "client-libraries",
  "api-authentication",
  "workos-connect",
]);

interface ApiEndpoint {
  domain: string;
  path: string;
  description: string;
  url: string;
}

/**
 * Parse API reference URLs from llms.txt and group by domain.
 * Returns a map of domain slug → endpoint info.
 */
export function parseApiReferenceUrls(
  llmsTxt: string,
): Map<string, ApiEndpoint[]> {
  const domains = new Map<string, ApiEndpoint[]>();

  // Extract API Reference section
  const lines = llmsTxt.split("\n");
  let inRefSection = false;

  for (const line of lines) {
    if (line === "## API Reference") {
      inRefSection = true;
      continue;
    }
    if (inRefSection && line.startsWith("## ") && line !== "## API Reference") {
      break;
    }

    if (!inRefSection) continue;

    // Parse lines like: - [domain - resource - action](url): description
    const match = line.match(
      /^- \[([^\]]+)\]\((https:\/\/workos\.com\/docs\/reference\/[^)]+)\)(?::\s*(.+))?/,
    );
    if (!match) continue;

    const [, label, url, description] = match;
    const parts = label.split(" - ").map((s) => s.trim());
    const domain = parts[0];

    if (SKIP_DOMAINS.has(domain)) continue;

    // Build a readable path from the label parts
    const pathParts = parts.slice(1);
    const path =
      pathParts.length > 0 ? `/${pathParts.join("/")}` : `/${domain}`;

    if (!domains.has(domain)) {
      domains.set(domain, []);
    }

    domains.get(domain)!.push({
      domain,
      path,
      description: description?.trim() ?? label,
      url,
    });
  }

  return domains;
}

/**
 * Split the API reference section into SkillSpecs, one per domain.
 */
export function splitApiReference(
  referenceSection: Section,
  llmsTxtUrls: Map<string, ApiEndpoint[]>,
): SkillSpec[] {
  const specs: SkillSpec[] = [];

  for (const [domain, endpoints] of llmsTxtUrls) {
    const config = API_DOMAINS[domain];
    if (!config) continue; // Skip domains not in our config

    const name = `workos-api-${domain}`;
    const docUrls = endpoints.map((e) => e.url);

    // Build endpoint table content
    const endpointTable = buildEndpointTable(endpoints);

    // Find relevant content from the reference section subsections
    const relevantContent = referenceSection.subsections
      .filter(
        (s) =>
          s.title.toLowerCase() === domain ||
          s.title.toLowerCase().replace(/\s+/g, "-") === domain,
      )
      .map((s) => s.content)
      .join("\n\n");

    const content = `${endpointTable}\n\n${relevantContent}`.trim();

    specs.push({
      name,
      description: config.description,
      title: config.title,
      anchor: "reference",
      content,
      docUrls: docUrls.slice(0, 10), // Cap at 10 URLs for the doc fetch section
      generated: true,
    });
  }

  return specs;
}

/** Build a markdown endpoint table from parsed endpoints */
function buildEndpointTable(endpoints: ApiEndpoint[]): string {
  if (endpoints.length === 0) return "";

  const lines = [
    "| Endpoint | Description |",
    "| -------- | ----------- |",
  ];

  for (const ep of endpoints) {
    const desc = ep.description.length > 80
      ? ep.description.substring(0, 77) + "..."
      : ep.description;
    lines.push(`| \`${ep.path}\` | ${desc} |`);
  }

  return lines.join("\n");
}
