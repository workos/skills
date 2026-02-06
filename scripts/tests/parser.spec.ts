import { describe, expect, it } from "bun:test";
import { parseSections, parseSubsections } from "../lib/parser.ts";

describe("parseSections", () => {
  it("extracts sections delimited by ## Name {#anchor}", () => {
    const markdown = `# Header

Some intro text.

## Widgets {#widgets}

Widget content here.

### Widget A

A details.

## Vault {#vault}

Vault content here.
`;
    const sections = parseSections(markdown);
    expect(sections).toHaveLength(2);
    expect(sections[0].name).toBe("Widgets");
    expect(sections[0].anchor).toBe("widgets");
    expect(sections[0].content).toContain("Widget content here");
    expect(sections[1].name).toBe("Vault");
    expect(sections[1].anchor).toBe("vault");
  });

  it("does not split on ## inside fenced code blocks", () => {
    const markdown = `## Real Section {#real}

Some content.

\`\`\`markdown
## Fake Section {#fake}

This is inside a code block.
\`\`\`

More content after code block.

## Another Section {#another}

Another content.
`;
    const sections = parseSections(markdown);
    expect(sections).toHaveLength(2);
    expect(sections[0].anchor).toBe("real");
    expect(sections[0].content).toContain("Fake Section");
    expect(sections[1].anchor).toBe("another");
  });

  it("calculates sizeBytes and lineCount", () => {
    const markdown = `## Test {#test}

Line one.
Line two.
Line three.
`;
    const sections = parseSections(markdown);
    expect(sections[0].lineCount).toBe(3);
    expect(sections[0].sizeBytes).toBeGreaterThan(0);
  });

  it("handles empty content between headers", () => {
    const markdown = `## Empty {#empty}

## Next {#next}

Has content.
`;
    const sections = parseSections(markdown);
    expect(sections).toHaveLength(2);
    expect(sections[0].content).toBe("");
    expect(sections[1].content).toBe("Has content.");
  });

  it("extracts subsections", () => {
    const markdown = `## SSO {#sso}

### Getting Started

Start here.

### Configuration

Config details.

### FAQ

Questions.
`;
    const sections = parseSections(markdown);
    expect(sections[0].subsections).toHaveLength(3);
    expect(sections[0].subsections[0].title).toBe("Getting Started");
    expect(sections[0].subsections[1].title).toBe("Configuration");
    expect(sections[0].subsections[2].title).toBe("FAQ");
  });
});

describe("parseSubsections", () => {
  it("splits on ### headings", () => {
    const content = `
### First

First content.

### Second

Second content.
`;
    const subs = parseSubsections(content);
    expect(subs).toHaveLength(2);
    expect(subs[0].title).toBe("First");
    expect(subs[0].content).toBe("First content.");
    expect(subs[1].title).toBe("Second");
  });

  it("skips ### inside code blocks", () => {
    const content = `
### Real

\`\`\`
### Not a heading
\`\`\`

Real content.

### Also Real

More content.
`;
    const subs = parseSubsections(content);
    expect(subs).toHaveLength(2);
    expect(subs[0].title).toBe("Real");
    expect(subs[0].content).toContain("Not a heading");
    expect(subs[1].title).toBe("Also Real");
  });

  it("returns empty array for content with no subsections", () => {
    const subs = parseSubsections("Just plain content with no headings.");
    expect(subs).toHaveLength(0);
  });
});
