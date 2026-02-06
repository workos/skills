import { mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fetchLlmsFullTxt, fetchLlmsTxt } from "./lib/fetcher.ts";
import { parseSections } from "./lib/parser.ts";
import { validateSections } from "./lib/validator.ts";
import { parseLlmsTxtUrls, splitSections } from "./lib/splitter.ts";
import {
  parseApiReferenceUrls,
  splitApiReference,
} from "./lib/api-ref-splitter.ts";
import {
  generateSkill,
  generateRouter,
  generateIntegrationRouter,
} from "./lib/generator.ts";
import { refineSkill, rateLimitDelay } from "./lib/refiner.ts";
import { runQualityGate } from "./lib/quality-gate.ts";
import { HAND_CRAFTED_SKILLS, VALIDATION } from "./lib/config.ts";
import type { GeneratedSkill } from "./lib/types.ts";

/** Skills that should NOT be refined (already well-structured or endpoint tables) */
const SKIP_REFINE = new Set([
  "workos-router",
  "workos-integrations",
  // API ref skills are endpoint tables — refining them would lose the table format
]);

function parseArgs(): {
  refine: boolean;
  refineOnly: string | null;
  model: string | null;
} {
  const args = process.argv.slice(2);
  return {
    refine: args.includes("--refine"),
    refineOnly:
      args.find((a) => a.startsWith("--refine-only="))?.split("=")[1] ?? null,
    model: args.find((a) => a.startsWith("--model="))?.split("=")[1] ?? null,
  };
}

async function main() {
  const flags = parseArgs();
  const shouldRefine = flags.refine || flags.refineOnly !== null;

  if (shouldRefine && !process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY env var required for --refine");
    process.exit(1);
  }

  // --- Phase 1: Fetch & Parse ---

  console.log("Fetching docs...");
  const [fullTxtResult, llmsTxtResult] = await Promise.all([
    fetchLlmsFullTxt(),
    fetchLlmsTxt(),
  ]);
  console.log(
    `  llms-full.txt: ${fullTxtResult.source}, ${(fullTxtResult.content.length / 1024).toFixed(0)}KB`,
  );
  console.log(
    `  llms.txt: ${llmsTxtResult.source}, ${(llmsTxtResult.content.length / 1024).toFixed(0)}KB`,
  );

  console.log("\nParsing sections...");
  const sections = parseSections(fullTxtResult.content);
  console.log(`  Found ${sections.length} sections`);

  for (const section of sections) {
    const subs = section.subsections.length;
    console.log(
      `  ${section.anchor.padEnd(20)} ${(section.sizeBytes / 1024).toFixed(0).padStart(5)}KB  ${subs} subsections`,
    );
  }

  console.log("\nValidating...");
  const result = validateSections(sections);

  if (result.warnings.length > 0) {
    console.log("\nWarnings:");
    for (const w of result.warnings) {
      console.log(`  ⚠ ${w}`);
    }
  }

  if (!result.valid) {
    console.error("\nValidation FAILED:");
    for (const e of result.errors) {
      console.error(`  ✗ ${e}`);
    }
    process.exit(1);
  }

  console.log(
    `\n✓ Validation passed. ${result.sectionCount} sections, ${(result.totalSize / 1024).toFixed(0)}KB total`,
  );

  // --- Phase 2: Split & Generate ---

  console.log("\nParsing llms.txt URL index...");
  const llmsTxtUrls = parseLlmsTxtUrls(llmsTxtResult.content);
  console.log(`  ${llmsTxtUrls.size} section URL groups`);

  console.log("\nSplitting sections into skill specs...");
  const specs = splitSections(sections, llmsTxtUrls);
  console.log(`  ${specs.length} skill specs produced`);

  console.log("\nGenerating skills...");
  const generatedSkills: GeneratedSkill[] = [];

  // Generate feature skills
  for (const spec of specs) {
    // Integration router is generated separately
    if (spec.name === "workos-integrations") continue;

    const skill = generateSkill(spec);
    generatedSkills.push(skill);
    console.log(
      `  ${skill.name.padEnd(35)} ${(skill.sizeBytes / 1024).toFixed(1).padStart(5)}KB`,
    );
  }

  // Generate integration router
  const integrationsSection = sections.find((s) => s.anchor === "integrations");
  if (integrationsSection) {
    const integrationRouter = generateIntegrationRouter(
      integrationsSection,
      llmsTxtUrls,
    );
    generatedSkills.push(integrationRouter);
    console.log(
      `  ${integrationRouter.name.padEnd(35)} ${(integrationRouter.sizeBytes / 1024).toFixed(1).padStart(5)}KB  (integration router)`,
    );
  }

  // Generate API reference skills
  const referenceSection = sections.find((s) => s.anchor === "reference");
  if (referenceSection) {
    console.log("\nGenerating API reference skills...");
    const apiRefUrls = parseApiReferenceUrls(llmsTxtResult.content);
    const apiRefSpecs = splitApiReference(referenceSection, apiRefUrls);
    console.log(`  ${apiRefSpecs.length} API reference specs produced`);

    for (const spec of apiRefSpecs) {
      const skill = generateSkill(spec);
      generatedSkills.push(skill);
      specs.push(spec); // Add to specs so router includes them
      console.log(
        `  ${skill.name.padEnd(35)} ${(skill.sizeBytes / 1024).toFixed(1).padStart(5)}KB  (api-ref)`,
      );
    }
  }

  // Generate master router (after all specs are collected)
  const router = generateRouter(specs, llmsTxtResult.content);
  generatedSkills.push(router);
  console.log(
    `  ${router.name.padEnd(35)} ${(router.sizeBytes / 1024).toFixed(1).padStart(5)}KB  (router)`,
  );

  // --- Phase 2.5: Refine (optional) ---

  if (shouldRefine) {
    console.log("\n--- Refinement Pass ---");

    const goldStandardPath = join(
      process.cwd(),
      "skills/workos-authkit-nextjs/SKILL.md",
    );
    const goldStandard = await Bun.file(goldStandardPath).text();
    console.log(
      `  Gold standard: ${goldStandardPath} (${(goldStandard.length / 1024).toFixed(1)}KB)`,
    );

    const apiKey = process.env.ANTHROPIC_API_KEY!;
    const refineOptions = {
      apiKey,
      model: flags.model ?? undefined,
      goldStandard,
    };

    const toRefine = flags.refineOnly
      ? generatedSkills.filter((s) => s.name === flags.refineOnly)
      : generatedSkills.filter(
          (s) => !SKIP_REFINE.has(s.name) && !s.name.startsWith("workos-api-"),
        );

    if (toRefine.length === 0) {
      console.warn("  No skills matched for refinement");
    }

    console.log(`  Refining ${toRefine.length} skills...\n`);

    for (let i = 0; i < toRefine.length; i++) {
      const skill = toRefine[i];
      const idx = generatedSkills.indexOf(skill);
      console.log(`  [${i + 1}/${toRefine.length}] Refining ${skill.name}...`);

      try {
        const refined = await refineSkill(skill, refineOptions);
        generatedSkills[idx] = refined;
        console.log(
          `    ✓ ${(skill.sizeBytes / 1024).toFixed(1)}KB → ${(refined.sizeBytes / 1024).toFixed(1)}KB`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`    ✗ Failed: ${msg}`);
        console.error(`    Keeping original scaffold for ${skill.name}`);
      }

      // Rate limit between calls
      if (i < toRefine.length - 1) {
        await rateLimitDelay();
      }
    }

    console.log("\n  Refinement complete.");
  }

  // --- Phase 3: Validate & Write ---

  console.log("\nValidating generated skills...");
  const handCraftedSet = new Set<string>(HAND_CRAFTED_SKILLS);
  let hasErrors = false;

  for (const skill of generatedSkills) {
    if (handCraftedSet.has(skill.name)) {
      console.error(`  ✗ ${skill.name} conflicts with hand-crafted skill!`);
      hasErrors = true;
      continue;
    }
    if (skill.sizeBytes > VALIDATION.maxSkillSize) {
      console.warn(
        `  ⚠ ${skill.name} is ${(skill.sizeBytes / 1024).toFixed(0)}KB — exceeds ${(VALIDATION.maxSkillSize / 1024).toFixed(0)}KB limit`,
      );
    }
    if (skill.sizeBytes < VALIDATION.minSkillSize) {
      console.warn(
        `  ⚠ ${skill.name} is only ${skill.sizeBytes}B — below ${VALIDATION.minSkillSize}B minimum`,
      );
    }
  }

  if (hasErrors) {
    console.error("\nGeneration FAILED: hand-crafted skill conflicts detected");
    process.exit(1);
  }

  console.log("\nWriting skills to disk...");
  for (const skill of generatedSkills) {
    const fullPath = join(process.cwd(), skill.path);
    await mkdir(dirname(fullPath), { recursive: true });
    await Bun.write(fullPath, skill.content);
    console.log(`  ✓ ${skill.path}`);
  }

  console.log(
    `\n✓ Generated ${generatedSkills.length} skills. Hand-crafted skills untouched: ${HAND_CRAFTED_SKILLS.length}`,
  );

  // --- Phase 4: Quality Gate ---

  console.log("\n--- Quality Gate ---");
  const qualityReport = runQualityGate(generatedSkills);

  for (const r of qualityReport.results) {
    const status = r.pass ? "✓" : "✗";
    const issueStr = r.issues.length > 0 ? ` — ${r.issues[0]}` : "";
    console.log(
      `  ${status} ${r.skillName.padEnd(40)} ${r.score}/100${issueStr}`,
    );
  }

  // Write quality report
  const reportPath = join(process.cwd(), "scripts/output/quality-report.json");
  await mkdir(dirname(reportPath), { recursive: true });
  await Bun.write(reportPath, JSON.stringify(qualityReport, null, 2));
  console.log(`\n  Report: ${reportPath}`);
  console.log(
    `  ${qualityReport.passed} passed, ${qualityReport.failed} failed out of ${qualityReport.total}`,
  );

  if (qualityReport.failed > 0) {
    console.warn(
      `\n⚠ ${qualityReport.failed} skill(s) below quality threshold. Review quality-report.json for details.`,
    );
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
