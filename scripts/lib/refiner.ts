import type { GeneratedSkill } from "./types.ts";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
const MAX_TOKENS = 4096;

/** Delay between API calls to avoid rate limiting */
const RATE_LIMIT_DELAY_MS = 1000;

export interface RefineOptions {
  apiKey: string;
  model?: string;
  /** The gold standard skill content (e.g., workos-authkit-nextjs SKILL.md) */
  goldStandard: string;
}

/**
 * Refine a generated skill scaffold by calling the Anthropic API
 * to transform doc prose into procedural agent instructions.
 *
 * Preserves: frontmatter, `<!-- generated -->` marker, doc URLs
 * Rewrites: implementation guide, verification, error recovery, when to use
 */
export async function refineSkill(
  skill: GeneratedSkill,
  options: RefineOptions,
): Promise<GeneratedSkill> {
  const { frontmatter, body } = splitFrontmatter(skill.content);
  const docUrls = extractDocUrls(body);
  const skillName = skill.name;

  const prompt = buildRefinePrompt(
    skillName,
    frontmatter,
    body,
    docUrls,
    options.goldStandard,
  );

  const refined = await callAnthropic(prompt, options);
  const content = ensureMarkers(frontmatter, refined);

  return {
    ...skill,
    content,
    sizeBytes: Buffer.byteLength(content, "utf8"),
  };
}

/** Build the system + user prompt for refinement */
function buildRefinePrompt(
  skillName: string,
  frontmatter: string,
  body: string,
  docUrls: string[],
  goldStandard: string,
): { system: string; user: string } {
  const system = `You are a skill refinement agent. Your job is to transform auto-generated skill scaffolds into high-quality procedural agent instructions.

A "skill" is a markdown file that tells an AI coding agent HOW to implement a feature — not WHAT the feature is. Skills encode procedural knowledge: numbered steps, decision trees, verification commands, and error recovery.

## What makes a great skill

Study this gold standard example carefully — it is the quality bar:

<gold-standard>
${goldStandard}
</gold-standard>

Key patterns from the gold standard:
1. **Numbered steps** (Step 1, Step 2...) telling the agent what to DO
2. **Blocking gates**: "STOP. Do not proceed until complete."
3. **Decision trees** with ASCII art for conditional flows
4. **Concrete verification commands** — actual bash one-liners with pass/fail
5. **Specific error messages** mapped to specific fixes with root causes
6. **WebFetch as source of truth** — doc URLs for runtime fetching, not baked-in content
7. **Imperative voice** — "Detect package manager" not "The package manager can be detected"
8. **No marketing prose, no screenshots, no feature descriptions**
9. **Code examples only for tricky patterns** — not API reference dumps

## Rules for refinement

1. Output ONLY the skill body (everything after frontmatter). Do NOT include frontmatter or the \`<!-- generated -->\` marker — those are added automatically.
2. KEEP the "Step 1: Fetch Documentation" section with these exact doc URLs: ${docUrls.map((u) => `\n   - ${u}`).join("")}
3. REPLACE all descriptive/marketing prose with procedural steps
4. ADD decision trees where there are meaningful branches
5. ADD a verification checklist with RUNNABLE bash commands (grep, curl, ls, etc.)
6. ADD specific error messages with root causes and fixes (not generic "check API key")
7. REMOVE all image markdown links (agents cannot render images)
8. REMOVE all baked-in documentation content — the agent will WebFetch at runtime
9. REMOVE truncated or broken code blocks
10. Keep the skill focused — aim for 2-5KB of procedural content, not 10KB of docs
11. Include a "Related Skills" section if relevant cross-references exist`;

  const user = `Refine this skill scaffold for "${skillName}". Transform the doc prose into procedural agent instructions matching the gold standard quality.

<scaffold>
${body}
</scaffold>

Output ONLY the refined skill body markdown. No frontmatter, no \`<!-- generated -->\` marker, no wrapping code fences.`;

  return { system, user };
}

/** Call the Anthropic Messages API */
async function callAnthropic(
  prompt: { system: string; user: string },
  options: RefineOptions,
): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": options.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Anthropic API error ${response.status}: ${errorBody}`,
    );
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };

  const text = data.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");

  if (!text.trim()) {
    throw new Error("Anthropic API returned empty response");
  }

  return text.trim();
}

/** Split frontmatter from body */
function splitFrontmatter(content: string): {
  frontmatter: string;
  body: string;
} {
  const match = content.match(/^(---\n[\s\S]*?\n---)\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: "", body: content };
  }
  return { frontmatter: match[1], body: match[2].trim() };
}

/** Extract doc URLs from the skill body */
function extractDocUrls(body: string): string[] {
  const urls: string[] = [];
  const re = /- (https:\/\/workos\.com\/docs\/[^\s]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

/** Reassemble frontmatter + marker + refined body */
function ensureMarkers(frontmatter: string, body: string): string {
  // Strip any frontmatter the LLM may have included
  let cleanBody = body;
  if (cleanBody.startsWith("---")) {
    const endIdx = cleanBody.indexOf("---", 3);
    if (endIdx !== -1) {
      cleanBody = cleanBody.slice(endIdx + 3).trim();
    }
  }

  // Strip generated marker if LLM included it
  cleanBody = cleanBody.replace(/<!--\s*generated\s*-->\s*\n?/, "").trim();

  return `${frontmatter}\n\n<!-- generated -->\n\n${cleanBody}\n`;
}

/** Sleep for rate limiting between API calls */
export function rateLimitDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
}
