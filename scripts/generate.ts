import { fetchLlmsFullTxt } from "./lib/fetcher.ts";
import { parseSections } from "./lib/parser.ts";
import { validateSections } from "./lib/validator.ts";

async function main() {
  console.log("Fetching llms-full.txt...");
  const { content, source } = await fetchLlmsFullTxt();
  console.log(`  Source: ${source}, ${(content.length / 1024).toFixed(0)}KB`);

  console.log("\nParsing sections...");
  const sections = parseSections(content);
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
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
