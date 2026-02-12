import { describe, expect, it } from "bun:test";
import {
  generateSkill,
  generateRouter,
  generateIntegrationRouter,
} from "../lib/generator.ts";
import type { SkillSpec, Section } from "../lib/types.ts";

function makeSpec(overrides: Partial<SkillSpec> = {}): SkillSpec {
  return {
    name: "workos-sso",
    description: "Configure Single Sign-On.",
    title: "WorkOS Single Sign-On",
    anchor: "sso",
    content:
      "SSO content here.\n\n### Getting Started\n\nStart with SSO.\n\n### Configuration\n\nConfigure SSO settings.",
    docUrls: [
      "https://workos.com/docs/sso/index",
      "https://workos.com/docs/sso/test-sso",
    ],
    generated: true,
    ...overrides,
  };
}

describe("generateSkill", () => {
  it("produces valid YAML frontmatter", () => {
    const result = generateSkill(makeSpec());
    expect(result.content).toStartWith("---\n");
    expect(result.content).toContain("name: workos-sso");
    expect(result.content).toContain("description: Configure Single Sign-On.");
    // Frontmatter must close
    const frontmatterEnd = result.content.indexOf("---", 4);
    expect(frontmatterEnd).toBeGreaterThan(0);
  });

  it("includes generated marker with source hash", () => {
    const result = generateSkill(makeSpec());
    expect(result.content).toMatch(/<!-- generated:sha256:[a-f0-9]{12} -->/);
  });

  it("includes sourceHash on result", () => {
    const result = generateSkill(makeSpec());
    expect(result.sourceHash).toMatch(/^[a-f0-9]{12}$/);
  });

  it("includes doc URL references", () => {
    const result = generateSkill(makeSpec());
    expect(result.content).toContain("https://workos.com/docs/sso/index");
    expect(result.content).toContain("https://workos.com/docs/sso/test-sso");
  });

  it("includes required sections", () => {
    const result = generateSkill(makeSpec());
    expect(result.content).toContain("## Step 1: Fetch Documentation");
    expect(result.content).toContain("## When to Use");
    expect(result.content).toContain("## Prerequisites");
    expect(result.content).toContain("## Implementation Guide");
    expect(result.content).toContain("## Verification Checklist");
    expect(result.content).toContain("## Error Recovery");
  });

  it("sets correct path", () => {
    const result = generateSkill(makeSpec());
    expect(result.path).toBe("skills/workos/workos-sso.md");
  });

  it("calculates sizeBytes", () => {
    const result = generateSkill(makeSpec());
    expect(result.sizeBytes).toBe(Buffer.byteLength(result.content, "utf8"));
    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  it("marks generated: true", () => {
    const result = generateSkill(makeSpec());
    expect(result.generated).toBe(true);
  });

  it("includes related skills for SSO", () => {
    const result = generateSkill(makeSpec());
    expect(result.content).toContain("## Related Skills");
    expect(result.content).toContain("workos-integrations");
  });
});

describe("generateRouter", () => {
  it("includes all generated skill names in topic map", () => {
    const specs = [
      makeSpec({ name: "workos-sso", anchor: "sso" }),
      makeSpec({ name: "workos-vault", anchor: "vault" }),
    ];
    const result = generateRouter(specs, "");
    expect(result.content).toContain("workos-sso");
    expect(result.content).toContain("workos-vault");
  });

  it("includes hand-crafted AuthKit skills", () => {
    const result = generateRouter([], "");
    expect(result.content).toContain("workos-authkit-nextjs");
    expect(result.content).toContain("workos-authkit-react");
    expect(result.content).toContain("workos-authkit-react-router");
    expect(result.content).toContain("workos-authkit-tanstack-start");
    expect(result.content).toContain("workos-authkit-vanilla-js");
    expect(result.content).toContain("workos-authkit-base");
  });

  it("includes framework detection logic", () => {
    const result = generateRouter([], "");
    expect(result.content).toContain("next.config");
    expect(result.content).toContain("vite.config");
    expect(result.content).toContain("@tanstack/start");
  });

  it("has correct name and path", () => {
    const result = generateRouter([], "");
    expect(result.name).toBe("workos");
    expect(result.path).toBe("skills/workos/SKILL.md");
  });

  it("includes generated marker with source hash", () => {
    const result = generateRouter([], "");
    expect(result.content).toMatch(/<!-- generated:sha256:[a-f0-9]{12} -->/);
  });

  it("includes fallback instructions", () => {
    const result = generateRouter([], "");
    expect(result.content).toContain("llms.txt");
    expect(result.content).toContain("If No Skill Matches");
  });

  it("groups migration skills separately", () => {
    const specs = [
      makeSpec({
        name: "workos-migrate-auth0",
        anchor: "migrate",
        title: "WorkOS Migration: Auth0",
      }),
      makeSpec({ name: "workos-sso", anchor: "sso" }),
    ];
    const result = generateRouter(specs, "");
    expect(result.content).toContain("workos-migrate-auth0");
    expect(result.content).toContain("Migrate from Auth0");
  });
});

describe("generateIntegrationRouter", () => {
  const integrationsSection: Section = {
    name: "Integrations",
    anchor: "integrations",
    content: "Integration content",
    sizeBytes: 19,
    lineCount: 1,
    subsections: [],
  };

  it("includes provider lookup table", () => {
    const urls = new Map([
      [
        "integrations",
        [
          "https://workos.com/docs/integrations/okta-saml",
          "https://workos.com/docs/integrations/google-saml",
        ],
      ],
    ]);
    const result = generateIntegrationRouter(integrationsSection, urls);
    expect(result.content).toContain("Okta");
    expect(result.content).toContain("SAML");
    expect(result.content).toContain("Provider Lookup");
  });

  it("has correct name and path", () => {
    const urls = new Map<string, string[]>();
    const result = generateIntegrationRouter(integrationsSection, urls);
    expect(result.name).toBe("workos-integrations");
    expect(result.path).toBe("skills/workos/workos-integrations.md");
  });

  it("includes generated marker with source hash", () => {
    const urls = new Map<string, string[]>();
    const result = generateIntegrationRouter(integrationsSection, urls);
    expect(result.content).toMatch(/<!-- generated:sha256:[a-f0-9]{12} -->/);
  });

  it("includes decision tree for integration types", () => {
    const urls = new Map<string, string[]>();
    const result = generateIntegrationRouter(integrationsSection, urls);
    expect(result.content).toContain("SAML");
    expect(result.content).toContain("SCIM");
    expect(result.content).toContain("OAuth");
  });

  it("includes verification checklist", () => {
    const urls = new Map<string, string[]>();
    const result = generateIntegrationRouter(integrationsSection, urls);
    expect(result.content).toContain("Verify the Integration");
  });
});
