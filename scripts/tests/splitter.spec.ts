import { describe, expect, it } from "bun:test";
import {
  parseLlmsTxtUrls,
  sectionNameToSlug,
  splitSections,
} from "../lib/splitter.ts";
import type { Section } from "../lib/types.ts";

describe("parseLlmsTxtUrls", () => {
  it("extracts URLs grouped by section slug", () => {
    const llmsTxt = `# WorkOS Documentation

## Widgets

- [Quick Start](https://workos.com/docs/widgets/quick-start): A guide.
- [User Profile Widget](https://workos.com/docs/widgets/user-profile): A widget.

## Vault

- [Quick Start](https://workos.com/docs/vault/quick-start): Vault guide.
`;
    const urls = parseLlmsTxtUrls(llmsTxt);
    expect(urls.get("widgets")).toHaveLength(2);
    expect(urls.get("widgets")![0]).toBe(
      "https://workos.com/docs/widgets/quick-start",
    );
    expect(urls.get("vault")).toHaveLength(1);
  });

  it("maps section names to correct slugs", () => {
    const llmsTxt = `## Single Sign-On

- [SSO](https://workos.com/docs/sso/index): SSO docs.

## Multi-Factor Auth

- [MFA](https://workos.com/docs/mfa/index): MFA docs.

## Migrations

- [Auth0](https://workos.com/docs/migrate/auth0): Auth0 migration.
`;
    const urls = parseLlmsTxtUrls(llmsTxt);
    expect(urls.has("sso")).toBe(true);
    expect(urls.has("mfa")).toBe(true);
    expect(urls.has("migrate")).toBe(true);
  });

  it("returns empty map for empty input", () => {
    const urls = parseLlmsTxtUrls("");
    expect(urls.size).toBe(0);
  });
});

describe("sectionNameToSlug", () => {
  it("maps known overrides", () => {
    expect(sectionNameToSlug("Single Sign-On")).toBe("sso");
    expect(sectionNameToSlug("Multi-Factor Auth")).toBe("mfa");
    expect(sectionNameToSlug("Migrations")).toBe("migrate");
    expect(sectionNameToSlug("API Reference")).toBe("reference");
  });

  it("falls back to lowercase-hyphenated", () => {
    expect(sectionNameToSlug("Widgets")).toBe("widgets");
    expect(sectionNameToSlug("Some New Feature")).toBe("some-new-feature");
  });
});

describe("splitSections", () => {
  function makeSection(
    anchor: string,
    content = "Some content",
    subsections: Section["subsections"] = [],
  ): Section {
    return {
      name: anchor,
      anchor,
      content,
      sizeBytes: Buffer.byteLength(content),
      lineCount: content.split("\n").length,
      subsections,
    };
  }

  it("applies single strategy — produces one spec per section", () => {
    const sections = [makeSection("sso"), makeSection("vault")];
    const urls = new Map([
      ["sso", ["https://workos.com/docs/sso/index"]],
      ["vault", ["https://workos.com/docs/vault/index"]],
    ]);

    const specs = splitSections(sections, urls);
    expect(specs).toHaveLength(2);
    expect(specs[0].name).toBe("workos-sso");
    expect(specs[1].name).toBe("workos-vault");
    expect(specs[0].generated).toBe(true);
  });

  it("skips sections with skip: true in config", () => {
    const sections = [makeSection("postman"), makeSection("sso")];
    const urls = new Map<string, string[]>();
    const specs = splitSections(sections, urls);
    // postman has skip: true
    expect(specs).toHaveLength(1);
    expect(specs[0].name).toBe("workos-sso");
  });

  it("skips sections with strategy: skip", () => {
    const sections = [makeSection("authkit"), makeSection("sso")];
    const urls = new Map<string, string[]>();
    const specs = splitSections(sections, urls);
    // authkit has strategy: skip
    expect(specs).toHaveLength(1);
    expect(specs[0].name).toBe("workos-sso");
  });

  it("does not generate specs that conflict with hand-crafted skill names", () => {
    // "workos-authkit-base" etc. are hand-crafted and should never be generated
    const sections = [makeSection("sso")];
    const urls = new Map<string, string[]>();
    const specs = splitSections(sections, urls);
    const names = specs.map((s) => s.name);
    expect(names).not.toContain("workos-authkit-base");
    expect(names).not.toContain("workos-authkit-nextjs");
  });

  it("applies per-subsection strategy for migrate — groups child subsections", () => {
    const subsections = [
      { title: "Migrate from Auth0", level: 3, content: "Auth0 intro", sizeBytes: 11 },
      { title: "Exporting Passwords", level: 3, content: "Export steps", sizeBytes: 12 },
      { title: "Importing Passwords", level: 3, content: "Import steps", sizeBytes: 12 },
      { title: "Migrate from Firebase", level: 3, content: "Firebase intro", sizeBytes: 14 },
      { title: "Social Auth Providers", level: 3, content: "Social steps", sizeBytes: 12 },
    ];
    const sections = [makeSection("migrate", "Migration docs", subsections)];
    const urls = new Map([
      [
        "migrate",
        [
          "https://workos.com/docs/migrate/auth0",
          "https://workos.com/docs/migrate/firebase",
        ],
      ],
    ]);

    const specs = splitSections(sections, urls);
    // Should produce 2 skills (Auth0, Firebase), not 5
    expect(specs).toHaveLength(2);
    expect(specs[0].name).toBe("workos-migrate-auth0");
    expect(specs[1].name).toBe("workos-migrate-firebase");
    // Auth0 skill should include child subsection content
    expect(specs[0].content).toContain("Export steps");
    expect(specs[0].content).toContain("Import steps");
    expect(specs[0].docUrls).toContain("https://workos.com/docs/migrate/auth0");
    // Firebase skill should include its child
    expect(specs[1].content).toContain("Social steps");
  });

  it("falls back to single when per-subsection has no subsections", () => {
    const sections = [makeSection("migrate", "No subsections here")];
    const urls = new Map<string, string[]>();
    const specs = splitSections(sections, urls);
    expect(specs).toHaveLength(1);
    expect(specs[0].name).toBe("workos-migrate");
  });

  it("attaches doc URLs from llms.txt", () => {
    const sections = [makeSection("widgets")];
    const urls = new Map([
      [
        "widgets",
        [
          "https://workos.com/docs/widgets/quick-start",
          "https://workos.com/docs/widgets/user-profile",
        ],
      ],
    ]);
    const specs = splitSections(sections, urls);
    expect(specs[0].docUrls).toHaveLength(2);
  });

  it("constructs fallback URL when no llms.txt URLs exist", () => {
    const sections = [makeSection("email")];
    const urls = new Map<string, string[]>();
    const specs = splitSections(sections, urls);
    expect(specs[0].docUrls).toEqual(["https://workos.com/docs/email"]);
  });
});
