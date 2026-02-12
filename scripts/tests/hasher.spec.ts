import { describe, expect, it } from "bun:test";
import {
  computeSourceHash,
  parseMarker,
  shouldRegenerate,
} from "../lib/hasher.ts";

describe("computeSourceHash", () => {
  it("returns consistent hash for same input", () => {
    const hash1 = computeSourceHash("hello world");
    const hash2 = computeSourceHash("hello world");
    expect(hash1).toBe(hash2);
  });

  it("returns different hash for different input", () => {
    const hash1 = computeSourceHash("hello world");
    const hash2 = computeSourceHash("hello world!");
    expect(hash1).not.toBe(hash2);
  });

  it("returns 12-char hex string", () => {
    const hash = computeSourceHash("test content");
    expect(hash).toMatch(/^[a-f0-9]{12}$/);
  });
});

describe("parseMarker", () => {
  it("parses generated marker with hash", () => {
    const result = parseMarker(
      "some\n<!-- generated:sha256:abc123def456 -->\ncontent",
    );
    expect(result.state).toBe("generated");
    expect(result.hash).toBe("abc123def456");
  });

  it("parses refined marker with hash", () => {
    const result = parseMarker(
      "some\n<!-- refined:sha256:abc123def456 -->\ncontent",
    );
    expect(result.state).toBe("refined");
    expect(result.hash).toBe("abc123def456");
  });

  it("parses legacy generated marker (no hash)", () => {
    const result = parseMarker("some\n<!-- generated -->\ncontent");
    expect(result.state).toBe("legacy");
    expect(result.hash).toBeNull();
  });

  it("returns none when no marker present", () => {
    const result = parseMarker("just some content");
    expect(result.state).toBe("none");
    expect(result.hash).toBeNull();
  });

  it("handles marker with extra whitespace", () => {
    const result = parseMarker("<!--  generated:sha256:abc123def456  -->");
    expect(result.state).toBe("generated");
    expect(result.hash).toBe("abc123def456");
  });
});

describe("shouldRegenerate", () => {
  const hash = "abc123def456";

  it("skips when hashes match", () => {
    const content = `<!-- generated:sha256:${hash} -->`;
    const result = shouldRegenerate(content, hash, false);
    expect(result.skip).toBe(true);
    expect(result.reason).toBe("source unchanged");
  });

  it("skips when refined hash matches", () => {
    const content = `<!-- refined:sha256:${hash} -->`;
    const result = shouldRegenerate(content, hash, false);
    expect(result.skip).toBe(true);
    expect(result.reason).toBe("source unchanged");
  });

  it("does not skip when hashes differ", () => {
    const content = `<!-- generated:sha256:999888777666 -->`;
    const result = shouldRegenerate(content, hash, false);
    expect(result.skip).toBe(false);
    expect(result.reason).toBe("source changed");
  });

  it("does not skip legacy markers", () => {
    const content = "<!-- generated -->";
    const result = shouldRegenerate(content, hash, false);
    expect(result.skip).toBe(false);
    expect(result.reason).toBe("legacy marker (no hash)");
  });

  it("does not skip when no marker present", () => {
    const result = shouldRegenerate("no marker", hash, false);
    expect(result.skip).toBe(false);
    expect(result.reason).toBe("no marker");
  });

  it("does not skip when force is true regardless of matching hash", () => {
    const content = `<!-- generated:sha256:${hash} -->`;
    const result = shouldRegenerate(content, hash, true);
    expect(result.skip).toBe(false);
    expect(result.reason).toBe("forced");
  });
});
