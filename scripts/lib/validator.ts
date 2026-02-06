import type { Section, ValidationResult } from "./types.ts";
import { KNOWN_ANCHORS, VALIDATION } from "./config.ts";

/**
 * Validate parsed sections against expected structure.
 * Fails loudly with actionable error messages when llms-full.txt format changes.
 */
export function validateSections(sections: Section[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const totalSize = sections.reduce((sum, s) => sum + s.sizeBytes, 0);

  // Section count check
  const countDiff = Math.abs(sections.length - VALIDATION.expectedSectionCount);
  if (countDiff > VALIDATION.sectionCountTolerance) {
    errors.push(
      `Expected ~${VALIDATION.expectedSectionCount} sections (±${VALIDATION.sectionCountTolerance}), got ${sections.length}`,
    );
  } else if (sections.length !== VALIDATION.expectedSectionCount) {
    warnings.push(
      `Section count changed: expected ${VALIDATION.expectedSectionCount}, got ${sections.length}`,
    );
  }

  // Known anchors present
  const foundAnchors = new Set(sections.map((s) => s.anchor));
  const missingAnchors = KNOWN_ANCHORS.filter((a) => !foundAnchors.has(a));
  if (missingAnchors.length > 0) {
    errors.push(`Missing expected sections: ${missingAnchors.join(", ")}`);
  }

  // Unexpected anchors
  const knownSet = new Set<string>(KNOWN_ANCHORS);
  const unexpectedAnchors = sections
    .map((s) => s.anchor)
    .filter((a) => !knownSet.has(a));
  if (unexpectedAnchors.length > 0) {
    warnings.push(`Unexpected new sections: ${unexpectedAnchors.join(", ")}`);
  }

  // Empty sections
  for (const section of sections) {
    if (section.sizeBytes === 0) {
      errors.push(`Section '${section.anchor}' has 0 bytes of content`);
    }
  }

  // Individual section size
  for (const section of sections) {
    if (section.sizeBytes > VALIDATION.maxSectionSize) {
      warnings.push(
        `Section '${section.anchor}' is ${(section.sizeBytes / 1024).toFixed(0)}KB — exceeds ${(VALIDATION.maxSectionSize / 1024).toFixed(0)}KB threshold`,
      );
    }
  }

  // Total content size
  if (totalSize < VALIDATION.minTotalSize) {
    errors.push(
      `Total content size ${(totalSize / 1024).toFixed(0)}KB is below minimum ${(VALIDATION.minTotalSize / 1024).toFixed(0)}KB — docs may be truncated`,
    );
  }
  if (totalSize > VALIDATION.maxTotalSize) {
    warnings.push(
      `Total content size ${(totalSize / 1024).toFixed(0)}KB exceeds ${(VALIDATION.maxTotalSize / 1024).toFixed(0)}KB — docs may have grown significantly`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sectionCount: sections.length,
    totalSize,
  };
}
