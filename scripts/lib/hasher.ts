import { createHash } from "crypto";

/**
 * Compute a 12-char hex SHA-256 hash of source content.
 * Used to detect when upstream docs change.
 */
export function computeSourceHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

/** Marker format: <!-- generated:sha256:abc123 --> or <!-- refined:sha256:abc123 --> */
const MARKER_RE = /<!--\s*(generated|refined):sha256:([a-f0-9]+)\s*-->/;

export interface MarkerInfo {
  state: "generated" | "refined" | "legacy" | "none";
  hash: string | null;
}

/** Parse the state and hash from a skill file's marker comment */
export function parseMarker(fileContent: string): MarkerInfo {
  const match = fileContent.match(MARKER_RE);
  if (match) {
    return { state: match[1] as "generated" | "refined", hash: match[2] };
  }
  if (fileContent.includes("<!-- generated -->")) {
    return { state: "legacy", hash: null };
  }
  return { state: "none", hash: null };
}

/** Determine whether a skill file should be regenerated */
export function shouldRegenerate(
  existingContent: string,
  newSourceHash: string,
  force: boolean,
): { skip: boolean; reason: string } {
  if (force) return { skip: false, reason: "forced" };

  const marker = parseMarker(existingContent);
  if (marker.state === "none") return { skip: false, reason: "no marker" };
  if (marker.state === "legacy")
    return { skip: false, reason: "legacy marker (no hash)" };
  if (marker.hash === newSourceHash)
    return { skip: true, reason: "source unchanged" };
  return { skip: false, reason: "source changed" };
}
