import { describe, expect, it } from "bun:test";
import { validateSections } from "../lib/validator.ts";
import { KNOWN_ANCHORS } from "../lib/config.ts";
import type { Section } from "../lib/types.ts";

function makeSection(anchor: string, sizeBytes = 1000): Section {
  return {
    name: anchor,
    anchor,
    content: "x".repeat(sizeBytes),
    sizeBytes,
    lineCount: 10,
    subsections: [],
  };
}

function makeAllSections(sizeBytes = 50_000): Section[] {
  return KNOWN_ANCHORS.map((a) => makeSection(a, sizeBytes));
}

describe("validateSections", () => {
  it("passes with all expected sections", () => {
    const result = validateSections(makeAllSections());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.sectionCount).toBe(KNOWN_ANCHORS.length);
  });

  it("fails when section count is way off", () => {
    const sections = [makeSection("sso"), makeSection("vault")];
    const result = validateSections(sections);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Expected ~24"))).toBe(true);
  });

  it("fails when known anchors are missing", () => {
    const sections = makeAllSections().filter((s) => s.anchor !== "sso");
    const result = validateSections(sections);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("Missing expected sections: sso")),
    ).toBe(true);
  });

  it("warns on unexpected anchors", () => {
    const sections = [...makeAllSections(), makeSection("new-feature")];
    const result = validateSections(sections);
    expect(
      result.warnings.some((w) =>
        w.includes("Unexpected new sections: new-feature"),
      ),
    ).toBe(true);
  });

  it("fails on empty section content", () => {
    const sections = makeAllSections();
    sections[0] = { ...sections[0], sizeBytes: 0 };
    const result = validateSections(sections);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("0 bytes"))).toBe(true);
  });

  it("warns on oversized section", () => {
    const sections = makeAllSections();
    sections[0] = { ...sections[0], sizeBytes: 700_000 };
    const result = validateSections(sections);
    expect(result.warnings.some((w) => w.includes("exceeds"))).toBe(true);
  });

  it("fails when total size is too small", () => {
    const sections = makeAllSections(100);
    const result = validateSections(sections);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("below minimum"))).toBe(true);
  });
});
