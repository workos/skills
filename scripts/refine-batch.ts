import { join } from "path";
import { refineSkill, rateLimitDelay } from "./lib/refiner.ts";
import type { GeneratedSkill } from "./lib/types.ts";

/**
 * Standalone batch refiner. Reads existing SKILL.md scaffolds from disk,
 * refines them via Anthropic API, and writes back. Supports parallel execution
 * via --concurrency flag.
 *
 * Usage:
 *   bun run scripts/refine-batch.ts                     # all generated skills, concurrency=5
 *   bun run scripts/refine-batch.ts --concurrency=8     # all generated, 8 at a time
 *   bun run scripts/refine-batch.ts workos-sso workos-mfa  # specific skills only
 *   bun run scripts/refine-batch.ts --model=claude-opus-4-6  # use opus
 */

const SKIP = new Set(["workos-integrations"]);

const GENERATED_SKILLS = [
  "workos",
  "workos-email",
  "workos-widgets",
  "workos-vault",
  "workos-sso",
  "workos-rbac",
  "workos-migrate-supabase-auth",
  "workos-migrate-stytch",
  "workos-migrate-the-standalone-sso-api",
  "workos-migrate-other-services",
  "workos-migrate-firebase",
  "workos-migrate-descope",
  "workos-migrate-clerk",
  "workos-migrate-better-auth",
  "workos-migrate-aws-cognito",
  "workos-migrate-auth0",
  "workos-mfa",
  "workos-events",
  "workos-directory-sync",
  "workos-custom-domains",
  "workos-audit-logs",
  "workos-admin-portal",
  "workos-api-admin-portal",
  "workos-api-audit-logs",
  "workos-api-authkit",
  "workos-api-directory-sync",
  "workos-api-events",
  "workos-api-organization",
  "workos-api-roles",
  "workos-api-sso",
  "workos-api-vault",
  "workos-api-widgets",
];

function parseArgs() {
  const args = process.argv.slice(2);
  const concurrencyArg = args.find((a) => a.startsWith("--concurrency="));
  const modelArg = args.find((a) => a.startsWith("--model="));
  const skillNames = args.filter((a) => !a.startsWith("--"));

  return {
    concurrency: concurrencyArg ? parseInt(concurrencyArg.split("=")[1]) : 5,
    model: modelArg?.split("=")[1] ?? undefined,
    skills: skillNames.length > 0 ? skillNames : GENERATED_SKILLS,
  };
}

async function readSkillFromDisk(name: string): Promise<GeneratedSkill> {
  const path = `skills/${name}/SKILL.md`;
  const fullPath = join(process.cwd(), path);
  const content = await Bun.file(fullPath).text();
  return {
    name,
    path,
    content,
    sizeBytes: Buffer.byteLength(content, "utf8"),
    generated: true,
  };
}

async function writeSkillToDisk(skill: GeneratedSkill): Promise<void> {
  const fullPath = join(process.cwd(), skill.path);
  await Bun.write(fullPath, skill.content);
}

/** Process a batch of skills concurrently */
async function processBatch(
  skills: GeneratedSkill[],
  options: { apiKey: string; model?: string; goldStandard: string },
  batchNum: number,
  totalBatches: number,
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  const promises = skills.map(async (skill) => {
    try {
      const refined = await refineSkill(skill, options);
      await writeSkillToDisk(refined);
      const delta = (
        ((refined.sizeBytes - skill.sizeBytes) / skill.sizeBytes) *
        100
      ).toFixed(0);
      console.log(
        `  ✓ ${skill.name.padEnd(40)} ${(skill.sizeBytes / 1024).toFixed(1)}KB → ${(refined.sizeBytes / 1024).toFixed(1)}KB (${delta}%)`,
      );
      success++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${skill.name.padEnd(40)} FAILED: ${msg}`);
      failed++;
    }
  });

  await Promise.all(promises);
  return { success, failed };
}

async function main() {
  const flags = parseArgs();

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY env var required");
    process.exit(1);
  }

  const goldStandardPath = join(
    process.cwd(),
    "skills/workos-authkit-nextjs/SKILL.md",
  );
  const goldStandard = await Bun.file(goldStandardPath).text();

  const skillNames = flags.skills.filter((s) => !SKIP.has(s));
  console.log(
    `Refining ${skillNames.length} skills with concurrency=${flags.concurrency}`,
  );
  if (flags.model) console.log(`  Model: ${flags.model}`);
  console.log(
    `  Gold standard: workos-authkit-nextjs (${(goldStandard.length / 1024).toFixed(1)}KB)\n`,
  );

  // Read all scaffolds from disk
  const skills: GeneratedSkill[] = [];
  for (const name of skillNames) {
    try {
      skills.push(await readSkillFromDisk(name));
    } catch {
      console.error(`  ⚠ Skipping ${name}: SKILL.md not found on disk`);
    }
  }

  // Split into batches and process
  const options = {
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: flags.model,
    goldStandard,
  };

  let totalSuccess = 0;
  let totalFailed = 0;
  const batches: GeneratedSkill[][] = [];

  for (let i = 0; i < skills.length; i += flags.concurrency) {
    batches.push(skills.slice(i, i + flags.concurrency));
  }

  for (let b = 0; b < batches.length; b++) {
    console.log(
      `--- Batch ${b + 1}/${batches.length} (${batches[b].length} skills) ---`,
    );
    const { success, failed } = await processBatch(
      batches[b],
      options,
      b + 1,
      batches.length,
    );
    totalSuccess += success;
    totalFailed += failed;

    // Brief pause between batches to be nice to rate limits
    if (b < batches.length - 1) {
      await rateLimitDelay();
    }
  }

  console.log(
    `\n✓ Refinement complete. ${totalSuccess} succeeded, ${totalFailed} failed out of ${skills.length} total.`,
  );

  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
