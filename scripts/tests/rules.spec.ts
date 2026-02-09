import { describe, expect, it } from "bun:test";
import { loadRules, evaluateRules, formatRulesForPrompt } from "../lib/rules.ts";
import type { SkillRule } from "../lib/types.ts";

describe("loadRules", () => {
  it("returns empty array for skill with no .rules.yml", () => {
    const rules = loadRules("nonexistent-skill-xyz");
    expect(rules).toEqual([]);
  });

  it("loads rules from workos-directory-sync", () => {
    const rules = loadRules("workos-directory-sync");
    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0].id).toBe("dsync-webhooks-mandatory");
    expect(rules[0].severity).toBe("warn");
    expect(rules[0].promoted).toBe(false);
    expect(rules[0].must_contain).toBeDefined();
    expect(rules[0].must_not_contain).toBeDefined();
  });
});

describe("evaluateRules", () => {
  const baseRule: SkillRule = {
    id: "test-rule",
    description: "Test rule",
    severity: "error",
    promoted: false,
    must_contain: [{ pattern: "webhook", context: "Must mention webhooks" }],
    must_not_contain: [
      { pattern: "polling", context: "Polling is not supported" },
    ],
  };

  it("passes when all rules are satisfied", () => {
    const content = "Use webhook events to receive directory sync updates.";
    const violations = evaluateRules(content, [baseRule]);
    expect(violations).toEqual([]);
  });

  it("detects missing must_contain pattern", () => {
    const content = "Use events to receive updates.";
    const violations = evaluateRules(content, [baseRule]);
    expect(violations.length).toBe(1);
    expect(violations[0].type).toBe("missing");
    expect(violations[0].pattern).toBe("webhook");
  });

  it("detects present must_not_contain pattern", () => {
    const content = "Use webhook events. You can also try polling for changes.";
    const violations = evaluateRules(content, [baseRule]);
    expect(violations.length).toBe(1);
    expect(violations[0].type).toBe("forbidden");
    expect(violations[0].pattern).toBe("polling");
  });

  it("reports both missing and forbidden violations", () => {
    const content = "Use polling for changes.";
    const violations = evaluateRules(content, [baseRule]);
    expect(violations.length).toBe(2);
    expect(violations.map((v) => v.type).sort()).toEqual([
      "forbidden",
      "missing",
    ]);
  });

  it("non-promoted rules always use warn severity", () => {
    const rule: SkillRule = { ...baseRule, severity: "error", promoted: false };
    const content = "No relevant content here.";
    const violations = evaluateRules(content, [rule]);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.every((v) => v.severity === "warn")).toBe(true);
  });

  it("promoted rules use their specified severity", () => {
    const rule: SkillRule = { ...baseRule, severity: "error", promoted: true };
    const content = "No relevant content here.";
    const violations = evaluateRules(content, [rule]);
    expect(violations.some((v) => v.severity === "error")).toBe(true);
  });

  it("uses case-insensitive regex matching", () => {
    const rule: SkillRule = {
      ...baseRule,
      must_contain: [{ pattern: "WEBHOOK", context: "test" }],
      must_not_contain: [],
    };
    const content = "Configure webhook endpoints.";
    const violations = evaluateRules(content, [rule]);
    expect(violations).toEqual([]);
  });

  it("evaluates multiple rules", () => {
    const rule2: SkillRule = {
      id: "second-rule",
      description: "Second rule",
      severity: "warn",
      promoted: false,
      must_contain: [{ pattern: "API key", context: "Must mention API key" }],
    };
    const content = "Use webhook events.";
    const violations = evaluateRules(content, [baseRule, rule2]);
    // baseRule passes (webhook present, no polling), rule2 fails (no API key)
    expect(violations.length).toBe(1);
    expect(violations[0].ruleId).toBe("second-rule");
  });

  it("handles rules with no must_contain or must_not_contain", () => {
    const emptyRule: SkillRule = {
      id: "empty-rule",
      description: "No checks",
      severity: "warn",
      promoted: false,
    };
    const violations = evaluateRules("any content", [emptyRule]);
    expect(violations).toEqual([]);
  });

  it("skips invalid regex patterns without crashing", () => {
    const badRule: SkillRule = {
      id: "bad-regex",
      description: "Bad regex",
      severity: "warn",
      promoted: false,
      must_contain: [{ pattern: "[invalid(", context: "broken" }],
    };
    const violations = evaluateRules("content", [badRule]);
    // Should not throw — invalid regex is skipped
    expect(violations).toEqual([]);
  });
});

describe("formatRulesForPrompt", () => {
  it("returns empty string for no rules", () => {
    expect(formatRulesForPrompt([])).toBe("");
  });

  it("formats rules with must_contain and must_not_contain", () => {
    const rules: SkillRule[] = [
      {
        id: "test-rule",
        description: "Test rule description",
        severity: "warn",
        promoted: false,
        must_contain: [{ pattern: "webhook", context: "Must mention webhooks" }],
        must_not_contain: [
          { pattern: "polling", context: "Polling not supported" },
        ],
      },
    ];
    const result = formatRulesForPrompt(rules);
    expect(result).toContain("Domain Constraints");
    expect(result).toContain("test-rule");
    expect(result).toContain("MUST mention");
    expect(result).toContain("MUST NOT claim");
  });
});
