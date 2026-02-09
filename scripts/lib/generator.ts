import type { Section, SkillSpec, GeneratedSkill } from "./types.ts";
import { HAND_CRAFTED_SKILLS } from "./config.ts";
import { renderSkill } from "./skill-template.ts";
import { computeSourceHash } from "./hasher.ts";

/**
 * Generate a SKILL.md for a single feature SkillSpec.
 */
export function generateSkill(spec: SkillSpec): GeneratedSkill {
  const sourceHash = computeSourceHash(spec.content);
  const content = renderSkill(spec, sourceHash);
  return {
    name: spec.name,
    path: `skills/${spec.name}/SKILL.md`,
    content,
    sizeBytes: Buffer.byteLength(content, "utf8"),
    generated: true,
    sourceHash,
  };
}

/**
 * Generate the master router skill.
 * Maps all available skills (generated + hand-crafted) to their topics.
 */
export function generateRouter(
  specs: SkillSpec[],
  llmsTxtContent: string,
): GeneratedSkill {
  const rows: string[] = [];

  // Add hand-crafted AuthKit skills
  const authkitSkills = [
    {
      intent: "Install AuthKit in Next.js",
      name: "workos-authkit-nextjs",
      doc: "workos.com/docs/sdks/authkit-nextjs",
    },
    {
      intent: "Install AuthKit in React SPA",
      name: "workos-authkit-react",
      doc: "workos.com/docs/sdks/authkit-react",
    },
    {
      intent: "Install AuthKit with React Router",
      name: "workos-authkit-react-router",
      doc: "workos.com/docs/sdks/authkit-react-router",
    },
    {
      intent: "Install AuthKit with TanStack Start",
      name: "workos-authkit-tanstack-start",
      doc: "workos.com/docs/sdks/authkit-tanstack-start",
    },
    {
      intent: "Install AuthKit in vanilla JS",
      name: "workos-authkit-vanilla-js",
      doc: "workos.com/docs/sdks/authkit-js",
    },
    {
      intent: "AuthKit architecture reference",
      name: "workos-authkit-base",
      doc: "workos.com/docs/authkit",
    },
  ];

  for (const s of authkitSkills) {
    rows.push(`| ${s.intent.padEnd(45)} | ${s.name.padEnd(35)} | ${s.doc} |`);
  }

  // Add generated feature skills
  for (const spec of specs) {
    // Skip migration sub-skills from the main table — group them
    if (spec.anchor === "migrate") continue;
    const doc =
      spec.docUrls[0]?.replace("https://", "") ??
      `workos.com/docs/${spec.anchor}`;
    const intent = intentFromSpec(spec);
    rows.push(`| ${intent.padEnd(45)} | ${spec.name.padEnd(35)} | ${doc} |`);
  }

  // Add migration skills as a group
  const migrateSpecs = specs.filter((s) => s.anchor === "migrate");
  if (migrateSpecs.length > 0) {
    for (const ms of migrateSpecs) {
      const provider = ms.title.replace("WorkOS Migration: ", "");
      const doc =
        ms.docUrls[0]?.replace("https://", "") ?? `workos.com/docs/migrate`;
      rows.push(
        `| Migrate from ${provider.padEnd(31)} | ${ms.name.padEnd(35)} | ${doc} |`,
      );
    }
  }

  const sourceContent = rows.join("\n") + llmsTxtContent;
  const sourceHash = computeSourceHash(sourceContent);

  const content = `---
name: workos-router
description: Identify which WorkOS skill to load based on the user's task — covers AuthKit, SSO, RBAC, migrations, and all API references.
---

<!-- generated:sha256:${sourceHash} -->

# WorkOS Skill Router

## How to Use

When a user needs help with WorkOS, consult this table to load the right skill.

## Disambiguation Rules

- **Feature skill vs API reference**: Prefer feature skills (e.g., \`workos-sso\`) unless the user explicitly asks about API endpoints, request/response formats, or references "API docs."
- **AuthKit vs feature**: If the user mentions authentication, login, or sign-up, route to AuthKit (detect framework below). If they mention a specific feature like SSO or MFA by name, route to that feature skill instead.
- **Multiple features**: Load the most specific skill first. The user can ask for additional skills later.

## Topic → Skill Map

| User wants to...                              | Load skill                          | Doc reference |
| --------------------------------------------- | ----------------------------------- | ------------- |
${rows.join("\n")}

## If No Skill Matches

WebFetch the full docs index: https://workos.com/docs/llms.txt
Then WebFetch the specific section URL for the user's topic.

## AuthKit Installation Detection

If the user wants to install AuthKit, detect their framework. Check in this order (first match wins):

\`\`\`
1. @tanstack/start in deps     → workos-authkit-tanstack-start
2. react-router in deps         → workos-authkit-react-router
3. next.config.*                 → workos-authkit-nextjs
4. vite.config.* + react in deps → workos-authkit-react
5. No framework detected         → workos-authkit-vanilla-js
\`\`\`

Note: Check framework-specific deps (TanStack, React Router) BEFORE generic ones (Next.js, Vite+React) to avoid misrouting projects that use both.

## General Decision Flow

\`\`\`
User request about WorkOS?
  |
  +-- Mentions specific feature? → Load that feature skill
  |
  +-- Wants AuthKit/auth setup? → Detect framework → Load AuthKit skill
  |
  +-- Wants API reference? → Load workos-api-* skill for that domain
  |
  +-- Wants integration setup? → Load workos-integrations
  |
  +-- Wants to migrate? → Identify source → Load migration skill
  |
  +-- Not sure? → WebFetch llms.txt → Find matching section
\`\`\`
`;

  return {
    name: "workos-router",
    path: "skills/workos-router/SKILL.md",
    content,
    sizeBytes: Buffer.byteLength(content, "utf8"),
    generated: true,
    sourceHash,
  };
}

/**
 * Generate the integration router skill with provider lookup table.
 */
export function generateIntegrationRouter(
  integrationsSection: Section,
  llmsTxtUrls: Map<string, string[]>,
): GeneratedSkill {
  const integrationUrls = llmsTxtUrls.get("integrations") ?? [];

  // Parse provider entries from URLs
  interface ProviderEntry {
    name: string;
    type: string;
    url: string;
  }

  const providers: ProviderEntry[] = [];

  for (const url of integrationUrls) {
    const slug = url.split("/").pop() ?? "";
    if (!slug) continue;

    const { name, type } = parseProviderSlug(slug);
    providers.push({ name, type, url: url.replace("https://", "") });
  }

  // Sort by provider name
  providers.sort((a, b) => a.name.localeCompare(b.name));

  const providerRows = providers
    .map((p) => `| ${p.name.padEnd(30)} | ${p.type.padEnd(12)} | ${p.url} |`)
    .join("\n");

  const sourceHash = computeSourceHash(
    integrationsSection.content + providerRows,
  );

  const content = `---
name: workos-integrations
description: Set up identity provider integrations with WorkOS. Covers SSO, SCIM, and OAuth for 40+ providers.
---

<!-- generated:sha256:${sourceHash} -->

# WorkOS Integrations

## Step 1: Identify the Provider

Ask the user which identity provider they need to integrate. Then find it in the table below.

## Provider Lookup

| Provider                       | Type         | Doc URL |
| ------------------------------ | ------------ | ------- |
${providerRows}

## General Integration Flow

1. **WebFetch** the provider-specific doc URL from the table above
2. Follow the setup steps in the fetched documentation
3. Configure the connection in the WorkOS Dashboard
4. Test the integration with a test user

## Integration Type Decision Tree

\`\`\`
What type of integration?
  |
  +-- SSO (user login)
  |     |
  |     +-- Provider supports SAML? → Use SAML connection
  |     +-- Provider supports OIDC? → Use OIDC connection
  |     +-- Provider supports both? → Prefer SAML (more enterprise-ready)
  |
  +-- Directory Sync (user provisioning)
  |     |
  |     +-- Provider supports SCIM? → Use SCIM connection
  |     +-- No SCIM? → Check for custom directory sync option
  |
  +-- OAuth (social login)
        |
        +-- Find provider in OAuth section of table
        +-- Configure OAuth app in provider's developer console
        +-- Add credentials to WorkOS Dashboard
\`\`\`

## Common Setup Patterns

### SAML Configuration

Most SAML providers require:
1. An ACS URL (from WorkOS Dashboard)
2. An SP Entity ID (from WorkOS Dashboard)
3. IdP metadata URL or certificate upload

### SCIM Directory Setup

Most SCIM providers require:
1. A SCIM endpoint URL (from WorkOS Dashboard)
2. A Bearer token for authentication
3. User attribute mapping configuration

### OAuth Setup

Most OAuth providers require:
1. Create an OAuth app in the provider's developer console
2. Set the redirect URI from WorkOS Dashboard
3. Copy Client ID and Secret to WorkOS

## Verification

\`\`\`bash
# Check connection status via WorkOS API
curl -s -H "Authorization: Bearer \$WORKOS_API_KEY" \\
  https://api.workos.com/connections | jq '.data[] | {id, name, state}'

# Verify SSO connection is active
curl -s -H "Authorization: Bearer \$WORKOS_API_KEY" \\
  https://api.workos.com/connections | jq '.data[] | select(.state == "active") | .name'

# Check directory sync connections
curl -s -H "Authorization: Bearer \$WORKOS_API_KEY" \\
  https://api.workos.com/directories | jq '.data[] | {id, name, state}'
\`\`\`

Checklist:
- [ ] Connection appears in WorkOS Dashboard with "Active" state
- [ ] Test SSO login succeeds with a test user
- [ ] User profile attributes map correctly (email, name, groups)
- [ ] (If SCIM) Directory sync shows users from provider

## Error Recovery

| Problem | Cause | Fix |
|---------|-------|-----|
| Connection stuck in "Draft" | Missing IdP metadata | Upload IdP metadata XML or enter metadata URL in Dashboard |
| SAML assertion error | ACS URL mismatch | Copy exact ACS URL from WorkOS Dashboard to IdP config |
| SCIM provisioning fails | Invalid bearer token | Regenerate SCIM token in Dashboard, update IdP config |
| OAuth redirect error | Redirect URI mismatch | Ensure redirect URI in provider console matches WorkOS exactly |
| "Organization not found" | No org linked | Create organization in Dashboard, then link connection to it |

## Related Skills

- **workos-sso**: General SSO implementation and configuration
- **workos-directory-sync**: Directory Sync setup and management
- **workos-domain-verification**: Domain verification required for SSO
- **workos-admin-portal**: Let customers configure their own connections
`;

  return {
    name: "workos-integrations",
    path: "skills/workos-integrations/SKILL.md",
    content,
    sizeBytes: Buffer.byteLength(content, "utf8"),
    generated: true,
    sourceHash,
  };
}

// --- Helpers ---

/** Derive a user intent phrase from a SkillSpec */
function intentFromSpec(spec: SkillSpec): string {
  const intents: Record<string, string> = {
    "workos-sso": "Configure Single Sign-On",
    "workos-directory-sync": "Set up Directory Sync",
    "workos-rbac": "Implement RBAC / roles",
    "workos-fga": "Set up Fine-Grained Authorization",
    "workos-vault": "Encrypt data with Vault",
    "workos-widgets": "Add WorkOS Widgets",
    "workos-events": "Handle WorkOS Events / webhooks",
    "workos-audit-logs": "Set up Audit Logs",
    "workos-admin-portal": "Enable Admin Portal",
    "workos-mfa": "Add Multi-Factor Auth",
    "workos-magic-link": "Implement Magic Link auth",
    "workos-feature-flags": "Configure Feature Flags",
    "workos-domain-verification": "Verify a domain",
    "workos-custom-domains": "Set up Custom Domains",
    "workos-email": "Configure email delivery",
    "workos-pipes": "Set up Pipes connections",
    "workos-integrations": "Set up IdP integration",
  };
  return intents[spec.name] ?? `Implement ${spec.title.replace("WorkOS ", "")}`;
}

/** Parse a provider slug like "okta-saml" into { name: "Okta", type: "SAML" } */
function parseProviderSlug(slug: string): { name: string; type: string } {
  const typePatterns: Array<{ suffix: string; type: string }> = [
    { suffix: "-saml", type: "SAML" },
    { suffix: "-scim", type: "SCIM" },
    { suffix: "-oidc", type: "OIDC" },
    { suffix: "-oauth", type: "OAuth" },
    { suffix: "-directory-sync", type: "Directory" },
    { suffix: "-enterprise-connection", type: "Enterprise" },
  ];

  for (const { suffix, type } of typePatterns) {
    if (slug.endsWith(suffix)) {
      const nameSlug = slug.slice(0, -suffix.length);
      return { name: formatProviderName(nameSlug), type };
    }
  }

  // No type suffix — general integration
  return { name: formatProviderName(slug), type: "General" };
}

/** Format a slug into a readable provider name */
function formatProviderName(slug: string): string {
  const nameMap: Record<string, string> = {
    "entra-id": "Entra ID (Azure AD)",
    google: "Google Workspace",
    "microsoft-ad-fs": "Microsoft AD FS",
    auth0: "Auth0",
    "aws-cognito": "AWS Cognito",
    "login-gov": "Login.gov",
    "simple-saml-php": "SimpleSAMLphp",
    "net-iq": "NetIQ",
    "shibboleth-generic": "Shibboleth Generic",
    "shibboleth-unsolicited": "Shibboleth Unsolicited",
    "access-people-hr": "Access People HR",
    "breathe-hr": "Breathe HR",
    cezanne: "Cezanne HR",
    "react-native-expo": "React Native Expo",
    "next-auth": "NextAuth.js",
    "supabase-sso": "Supabase + WorkOS SSO",
    "supabase-authkit": "Supabase + AuthKit",
    cas: "CAS",
    adp: "ADP",
  };

  if (nameMap[slug]) return nameMap[slug];

  return slug
    .split("-")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
