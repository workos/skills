import type { Section, Subsection } from "./types.ts";

/**
 * Find positions of all fenced code blocks (``` ... ```) so we can
 * skip any headers that appear inside them.
 */
function findCodeBlockRanges(
  content: string,
): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  const fenceRe = /^```/gm;
  let match: RegExpExecArray | null;
  let openStart: number | null = null;

  while ((match = fenceRe.exec(content)) !== null) {
    if (openStart === null) {
      openStart = match.index;
    } else {
      ranges.push({ start: openStart, end: match.index + match[0].length });
      openStart = null;
    }
  }

  return ranges;
}

function isInsideCodeBlock(
  position: number,
  ranges: Array<{ start: number; end: number }>,
): boolean {
  return ranges.some((r) => position >= r.start && position <= r.end);
}

/**
 * Parse llms-full.txt into a section tree.
 * Splits on ## SectionName {#anchor} boundaries.
 */
export function parseSections(markdown: string): Section[] {
  const codeBlockRanges = findCodeBlockRanges(markdown);
  const sections: Section[] = [];

  // Find all section header positions
  const headers: Array<{
    name: string;
    anchor: string;
    index: number;
    fullMatchEnd: number;
  }> = [];

  const re = /^## (.+?) \{#([a-z0-9-]+)\}\s*$/gm;
  let match: RegExpExecArray | null;

  while ((match = re.exec(markdown)) !== null) {
    if (!isInsideCodeBlock(match.index, codeBlockRanges)) {
      headers.push({
        name: match[1],
        anchor: match[2],
        index: match.index,
        fullMatchEnd: match.index + match[0].length,
      });
    }
  }

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const start = header.fullMatchEnd;
    const end = i + 1 < headers.length ? headers[i + 1].index : markdown.length;
    const content = markdown.slice(start, end).trim();

    const subsections = parseSubsections(content);

    sections.push({
      name: header.name,
      anchor: header.anchor,
      content,
      sizeBytes: Buffer.byteLength(content, "utf8"),
      lineCount: content.split("\n").length,
      subsections,
    });
  }

  return sections;
}

/**
 * Parse subsections within a section's content.
 * Splits on ### Heading boundaries, skipping headings inside code blocks.
 */
export function parseSubsections(sectionContent: string): Subsection[] {
  const codeBlockRanges = findCodeBlockRanges(sectionContent);
  const subsections: Subsection[] = [];

  const headers: Array<{
    title: string;
    index: number;
    fullMatchEnd: number;
  }> = [];

  const re = /^### (.+)$/gm;
  let match: RegExpExecArray | null;

  while ((match = re.exec(sectionContent)) !== null) {
    if (!isInsideCodeBlock(match.index, codeBlockRanges)) {
      headers.push({
        title: match[1],
        index: match.index,
        fullMatchEnd: match.index + match[0].length,
      });
    }
  }

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const start = header.fullMatchEnd;
    const end =
      i + 1 < headers.length ? headers[i + 1].index : sectionContent.length;
    const content = sectionContent.slice(start, end).trim();

    subsections.push({
      title: header.title,
      level: 3,
      content,
      sizeBytes: Buffer.byteLength(content, "utf8"),
    });
  }

  return subsections;
}
