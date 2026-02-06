import { join } from "path";
import { mkdir } from "fs/promises";
import type { FetchResult, FetchOptions } from "./types.ts";

const LLMS_TXT_URL = "https://workos.com/docs/llms.txt";
const LLMS_FULL_TXT_URL = "https://workos.com/docs/llms-full.txt";

const DEFAULT_CACHE_DIR = ".cache";
const DEFAULT_MAX_AGE = 60 * 60 * 1000; // 1 hour
const DEFAULT_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

function getCacheFilePath(cacheDir: string, url: string): string {
  const filename = url.split("/").pop() ?? "unknown";
  return join(cacheDir, filename);
}

function getMetaFilePath(cachePath: string): string {
  return `${cachePath}.meta.json`;
}

async function readCache(
  cachePath: string,
  maxAge: number,
): Promise<FetchResult | null> {
  const metaPath = getMetaFilePath(cachePath);

  try {
    const meta = JSON.parse(await Bun.file(metaPath).text());
    const age = Date.now() - new Date(meta.fetchedAt).getTime();
    if (age > maxAge) return null;

    const content = await Bun.file(cachePath).text();

    return {
      content,
      source: "cache",
      fetchedAt: new Date(meta.fetchedAt),
    };
  } catch {
    return null;
  }
}

async function writeCache(
  cachePath: string,
  content: string,
  fetchedAt: Date,
): Promise<void> {
  try {
    await mkdir(cachePath.split("/").slice(0, -1).join("/"), {
      recursive: true,
    });
    await Bun.write(cachePath, content);
    await Bun.write(
      getMetaFilePath(cachePath),
      JSON.stringify({ fetchedAt: fetchedAt.toISOString() }),
    );
  } catch (err) {
    console.warn(`Warning: Could not write cache to ${cachePath}:`, err);
  }
}

async function fetchWithRetry(url: string, retries: number): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.text();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await Bun.sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw new Error(
    `Failed to fetch ${url} after ${retries} retries. Last error: ${lastError?.message}`,
  );
}

export async function fetchDocs(
  url: string,
  opts?: FetchOptions,
): Promise<FetchResult> {
  const cacheDir = opts?.cacheDir ?? DEFAULT_CACHE_DIR;
  const maxAge = opts?.maxAge ?? DEFAULT_MAX_AGE;
  const retries = opts?.retries ?? DEFAULT_RETRIES;

  const cachePath = getCacheFilePath(cacheDir, url);

  const cached = await readCache(cachePath, maxAge);
  if (cached) return cached;

  const content = await fetchWithRetry(url, retries);
  const fetchedAt = new Date();

  await writeCache(cachePath, content, fetchedAt);

  return { content, source: "network", fetchedAt };
}

export async function fetchLlmsTxt(opts?: FetchOptions): Promise<FetchResult> {
  return fetchDocs(LLMS_TXT_URL, opts);
}

export async function fetchLlmsFullTxt(
  opts?: FetchOptions,
): Promise<FetchResult> {
  return fetchDocs(LLMS_FULL_TXT_URL, opts);
}
