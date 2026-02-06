import { describe, expect, it } from "bun:test";
import {
  parseApiReferenceUrls,
  splitApiReference,
} from "../lib/api-ref-splitter.ts";
import type { Section } from "../lib/types.ts";

describe("parseApiReferenceUrls", () => {
  it("extracts endpoints grouped by domain", () => {
    const llmsTxt = `## API Reference

- [API Reference](https://workos.com/docs/reference)
- [sso](https://workos.com/docs/reference/sso)
- [sso - connection](https://workos.com/docs/reference/sso/connection)
- [sso - connection - get](https://workos.com/docs/reference/sso/connection/get)
- [sso - profile](https://workos.com/docs/reference/sso/profile)
- [audit-logs](https://workos.com/docs/reference/audit-logs)
- [audit-logs - event](https://workos.com/docs/reference/audit-logs/event)
- [audit-logs - event - create](https://workos.com/docs/reference/audit-logs/event/create): Create an audit log event.

## Next Section
`;
    const domains = parseApiReferenceUrls(llmsTxt);
    expect(domains.has("sso")).toBe(true);
    expect(domains.has("audit-logs")).toBe(true);
    expect(domains.get("sso")!.length).toBeGreaterThanOrEqual(3);
    expect(domains.get("audit-logs")!.length).toBeGreaterThanOrEqual(2);
  });

  it("skips meta domains like testing, rate-limits, errors", () => {
    const llmsTxt = `## API Reference

- [testing](https://workos.com/docs/reference/testing)
- [rate-limits](https://workos.com/docs/reference/rate-limits)
- [errors](https://workos.com/docs/reference/errors)
- [sso](https://workos.com/docs/reference/sso)

## Next
`;
    const domains = parseApiReferenceUrls(llmsTxt);
    expect(domains.has("testing")).toBe(false);
    expect(domains.has("rate-limits")).toBe(false);
    expect(domains.has("errors")).toBe(false);
    expect(domains.has("sso")).toBe(true);
  });

  it("returns empty map for empty input", () => {
    const domains = parseApiReferenceUrls("");
    expect(domains.size).toBe(0);
  });

  it("captures descriptions from URLs", () => {
    const llmsTxt = `## API Reference

- [vault - object - create](https://workos.com/docs/reference/vault/object/create): Create an encrypted vault object.

## Next
`;
    const domains = parseApiReferenceUrls(llmsTxt);
    expect(domains.get("vault")![0].description).toBe(
      "Create an encrypted vault object.",
    );
  });
});

describe("splitApiReference", () => {
  const refSection: Section = {
    name: "API Reference",
    anchor: "reference",
    content: "### Single Sign-On\n\nSSO API content here.",
    sizeBytes: 40,
    lineCount: 3,
    subsections: [
      {
        title: "Single Sign-On",
        level: 3,
        content: "SSO API content here.",
        sizeBytes: 21,
      },
    ],
  };

  it("produces SkillSpecs for configured domains", () => {
    const urls = new Map([
      [
        "sso",
        [
          {
            domain: "sso",
            path: "/connection/get",
            description: "Get SSO connection",
            url: "https://workos.com/docs/reference/sso/connection/get",
          },
        ],
      ],
    ]);
    const specs = splitApiReference(refSection, urls);
    expect(specs.length).toBeGreaterThanOrEqual(1);
    const ssoSpec = specs.find((s) => s.name === "workos-api-sso");
    expect(ssoSpec).toBeDefined();
    expect(ssoSpec!.generated).toBe(true);
    expect(ssoSpec!.anchor).toBe("reference");
  });

  it("skips domains not in config", () => {
    const urls = new Map([
      [
        "unknown-domain",
        [
          {
            domain: "unknown-domain",
            path: "/foo",
            description: "foo",
            url: "https://workos.com/docs/reference/unknown-domain/foo",
          },
        ],
      ],
    ]);
    const specs = splitApiReference(refSection, urls);
    expect(specs).toHaveLength(0);
  });

  it("includes endpoint table in content", () => {
    const urls = new Map([
      [
        "vault",
        [
          {
            domain: "vault",
            path: "/object/create",
            description: "Create object",
            url: "https://workos.com/docs/reference/vault/object/create",
          },
          {
            domain: "vault",
            path: "/object/get",
            description: "Get object",
            url: "https://workos.com/docs/reference/vault/object/get",
          },
        ],
      ],
    ]);
    const specs = splitApiReference(refSection, urls);
    const vault = specs.find((s) => s.name === "workos-api-vault");
    expect(vault).toBeDefined();
    expect(vault!.content).toContain("/object/create");
    expect(vault!.content).toContain("/object/get");
    expect(vault!.content).toContain("| Endpoint");
  });

  it("caps doc URLs at 10", () => {
    const endpoints = Array.from({ length: 15 }, (_, i) => ({
      domain: "authkit",
      path: `/endpoint-${i}`,
      description: `Endpoint ${i}`,
      url: `https://workos.com/docs/reference/authkit/endpoint-${i}`,
    }));
    const urls = new Map([["authkit", endpoints]]);
    const specs = splitApiReference(refSection, urls);
    const authkit = specs.find((s) => s.name === "workos-api-authkit");
    expect(authkit!.docUrls.length).toBeLessThanOrEqual(10);
  });
});
