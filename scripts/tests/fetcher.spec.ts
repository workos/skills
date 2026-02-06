import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { fetchDocs } from "../lib/fetcher.ts";
import { rm, mkdir } from "fs/promises";
import { join } from "path";

const TEST_CACHE_DIR = ".cache-test";

beforeEach(async () => {
  await rm(TEST_CACHE_DIR, { recursive: true, force: true });
});

afterEach(async () => {
  await rm(TEST_CACHE_DIR, { recursive: true, force: true });
});

describe("fetchDocs", () => {
  it("fetches from network and caches", async () => {
    const result = await fetchDocs("https://workos.com/docs/llms.txt", {
      cacheDir: TEST_CACHE_DIR,
      retries: 2,
    });

    expect(result.source).toBe("network");
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content).toContain("WorkOS");

    // Second fetch should hit cache
    const cached = await fetchDocs("https://workos.com/docs/llms.txt", {
      cacheDir: TEST_CACHE_DIR,
      retries: 2,
    });

    expect(cached.source).toBe("cache");
    expect(cached.content).toBe(result.content);
  });

  it("bypasses expired cache", async () => {
    // Pre-populate cache
    await fetchDocs("https://workos.com/docs/llms.txt", {
      cacheDir: TEST_CACHE_DIR,
      retries: 2,
    });

    // Fetch with 0 TTL — should go to network
    const result = await fetchDocs("https://workos.com/docs/llms.txt", {
      cacheDir: TEST_CACHE_DIR,
      maxAge: 0,
      retries: 2,
    });

    expect(result.source).toBe("network");
  });

  it("throws on unreachable URL after retries", async () => {
    await expect(
      fetchDocs("https://localhost:19999/not-a-real-server", {
        cacheDir: TEST_CACHE_DIR,
        retries: 1,
      }),
    ).rejects.toThrow("Failed to fetch");
  });
});
