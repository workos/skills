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
name: workos
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
    name: "workos",
    path: "skills/workos/SKILL.md",
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

## Step 2: Set Up the Connection

**WebFetch** the provider-specific doc URL from the table above, then follow the protocol for the connection type.

### SAML SSO Setup

1. In WorkOS Dashboard, navigate to **Organizations > [Org] > Authentication**
2. Click **Add Connection** and select SAML
3. Copy these values from the connection detail page:
   - **ACS URL** (Assertion Consumer Service) — paste into IdP's SSO config
   - **SP Entity ID** — paste into IdP's audience/entity field
4. In the IdP admin console, create a new SAML application:
   a. Set the ACS URL and SP Entity ID from step 3
   b. Configure attribute mapping: \`id\` → NameID, \`email\` → email, \`firstName\` → first name, \`lastName\` → last name
   c. Download or copy the **IdP Metadata URL** (or download the metadata XML file)
5. Back in WorkOS Dashboard, upload the IdP metadata (URL or XML file)
6. Connection state transitions: **Draft → Validating → Active**
   - If it stays in Draft, see Troubleshooting below

### SCIM Directory Sync Setup

1. In WorkOS Dashboard, navigate to **Organizations > [Org] > Directory Sync**
2. Click **Add Directory** and select the provider
3. Copy these values from the directory detail page:
   - **SCIM Endpoint URL** (e.g., \`https://api.workos.com/directories/<DIR_ID>/scim/v2\`)
   - **SCIM Bearer Token** — treat as a secret, never log or commit
4. In the IdP admin console, configure SCIM provisioning:
   a. Set the SCIM Base URL to the endpoint from step 3
   b. Set Authentication to **Bearer Token** and paste the token
   c. Enable provisioning actions: Create Users, Update User Attributes, Deactivate Users
   d. Map user attributes: \`userName\` → email, \`name.givenName\` → first name, \`name.familyName\` → last name
5. Run a test push/sync from the IdP to verify users appear in WorkOS
6. Directory state transitions: **Inactive → Validating → Linked**

### OAuth Social Login Setup

1. In the OAuth provider's developer console, create a new OAuth application
2. Set the **Redirect URI** to the value from WorkOS Dashboard:
   - Format: \`https://auth.workos.com/sso/oauth/callback/<CONNECTION_ID>\`
3. Copy the **Client ID** and **Client Secret** from the provider
4. In WorkOS Dashboard, navigate to **Authentication > Social Login**
5. Select the provider and paste the Client ID and Client Secret
6. Configure scopes (typically: \`openid\`, \`profile\`, \`email\`)
7. Test by initiating a login flow through your application

## Step 3: Verify the Integration

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
- [ ] Connection appears in WorkOS Dashboard with "Active" (SSO) or "Linked" (directory) state
- [ ] Test SSO login succeeds with a test user
- [ ] User profile attributes map correctly (email, first name, last name, groups)
- [ ] (If SCIM) Directory sync shows users from provider
- [ ] (If OAuth) Social login redirects correctly and returns user profile

## Integration Type Decision Tree

\`\`\`
What type of integration?
  |
  +-- SSO (user login)
  |     |
  |     +-- Provider supports SAML? → Use SAML connection (preferred for enterprise)
  |     +-- Provider supports OIDC only? → Use OIDC connection
  |     +-- Provider supports both? → Prefer SAML (wider enterprise support, more attributes)
  |
  +-- Directory Sync (user provisioning)
  |     |
  |     +-- Provider supports SCIM? → Use SCIM connection
  |     +-- No SCIM but has API? → Check if WorkOS has a native directory for this provider
  |     +-- No directory support? → Consider SFTP-based import or manual sync
  |
  +-- OAuth (social login)
        |
        +-- Find provider in OAuth section of table above
        +-- Follow OAuth setup steps in Step 2
\`\`\`

## Troubleshooting Decision Tree

\`\`\`
Connection not working?
  |
  +-- Connection stuck in "Draft"
  |     |
  |     +-- Did you upload IdP metadata? → Upload XML or enter metadata URL in Dashboard
  |     +-- Metadata uploaded but still Draft? → Check metadata is valid XML, not HTML login page
  |     +-- Using metadata URL? → Verify URL is publicly reachable (not behind firewall)
  |
  +-- Connection stuck in "Validating"
  |     |
  |     +-- IdP metadata certificate expired? → Upload new cert or fresh metadata
  |     +-- ACS URL contains typo? → Re-copy from Dashboard, paste exactly
  |     +-- SP Entity ID mismatch? → Ensure IdP audience matches WorkOS SP Entity ID exactly
  |
  +-- SAML assertion errors
  |     |
  |     +-- "Recipient mismatch" → ACS URL in IdP config does not match WorkOS; re-copy it
  |     +-- "Audience mismatch" → SP Entity ID in IdP does not match; re-copy it
  |     +-- "Signature invalid" → IdP metadata/certificate is stale; re-upload current metadata
  |     +-- "Response expired" → Clock skew between IdP and SP; verify NTP sync on IdP server
  |     +-- "NameID missing" → IdP not sending NameID; add NameID mapping in IdP attribute config
  |
  +-- SCIM sync failing
  |     |
  |     +-- 401 Unauthorized → Bearer token is wrong or expired; regenerate in Dashboard
  |     +-- 404 Not Found → SCIM endpoint URL is wrong; re-copy from Dashboard
  |     +-- Users sync but no attributes → Check attribute mapping in IdP; must map userName, name.*
  |     +-- Users created but not updated → Ensure "Update User Attributes" is enabled in IdP provisioning
  |     +-- Deactivated users still active → Enable "Deactivate Users" in IdP provisioning settings
  |
  +-- OAuth redirect errors
  |     |
  |     +-- "redirect_uri_mismatch" → Redirect URI in provider console doesn't match WorkOS; copy exact URI
  |     +-- "invalid_client" → Client ID or Secret is wrong; re-copy from provider console
  |     +-- "access_denied" → User denied consent, or OAuth app not approved; check provider app status
  |     +-- Scopes error → Remove unsupported scopes; start with openid, profile, email
  |
  +-- "Organization not found"
        |
        +-- No org exists → Create organization in Dashboard first
        +-- Org exists but connection not linked → Link connection to organization in Dashboard
        +-- Domain not verified → Verify domain under Organizations > Domains (required for SSO)
\`\`\`

## Error Recovery Reference

| Problem | Root Cause | Fix |
|---------|-----------|-----|
| Connection stuck in "Draft" | IdP metadata not uploaded or invalid | Upload valid IdP metadata XML or enter a reachable metadata URL in Dashboard |
| Connection stuck in "Validating" | Certificate expired or ACS/Entity ID mismatch | Re-upload fresh metadata; verify ACS URL and SP Entity ID match exactly |
| SAML "Recipient mismatch" | ACS URL in IdP does not match WorkOS value | Copy exact ACS URL from WorkOS Dashboard > Connection > Details |
| SAML "Audience mismatch" | SP Entity ID in IdP does not match WorkOS | Copy exact SP Entity ID from Dashboard; paste into IdP audience/entity field |
| SAML "Signature invalid" | IdP certificate rotated but WorkOS has old cert | Re-download IdP metadata and re-upload to WorkOS Dashboard |
| SAML "Response expired" | Clock skew between IdP server and WorkOS | Sync IdP server time via NTP; most assertions allow 5-minute skew |
| SCIM 401 Unauthorized | Bearer token is expired or was regenerated | Copy current token from Dashboard > Directory > SCIM Config |
| SCIM 404 Not Found | Endpoint URL has wrong directory ID or path | Re-copy full SCIM endpoint URL from Dashboard |
| SCIM sync no attributes | Attribute mapping missing in IdP | Map userName, name.givenName, name.familyName in IdP SCIM config |
| SCIM users not deactivated | Deprovisioning not enabled | Enable "Deactivate Users" in IdP provisioning settings |
| OAuth "redirect_uri_mismatch" | Redirect URI in provider console is different | Paste exact redirect URI from WorkOS Dashboard into provider OAuth app |
| OAuth "invalid_client" | Client ID or Secret is wrong | Re-copy Client ID and Secret from provider developer console |
| "Organization not found" | Connection not linked to an organization | Create org in Dashboard, then link the connection to it |
| "Domain not verified" | SSO requires a verified domain | Go to Organizations > Domains, add and verify the domain |

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
