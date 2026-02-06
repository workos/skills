import type { GeneratedSkill } from "./types.ts";

export interface QualityResult {
  skillName: string;
  pass: boolean;
  score: number;
  issues: string[];
}

export interface QualityReport {
  total: number;
  passed: number;
  failed: number;
  results: QualityResult[];
}

/**
 * Run automated quality checks on generated skills.
 * Scoring rubric (100 points total):
 * - Valid frontmatter with name + description (20 pts)
 * - Has <!-- generated --> marker (5 pts)
 * - Has WebFetch doc references (20 pts)
 * - Has at least 2 structural sections (15 pts)
 * - Content length > 1KB (10 pts)
 * - Has verification checklist OR error recovery (15 pts)
 * - No raw doc content > 2KB without structural formatting (15 pts)
 *
 * Pass threshold: 70/100
 */
export function runQualityGate(skills: GeneratedSkill[]): QualityReport {
  const results: QualityResult[] = skills.map((skill) => scoreSkill(skill));

  return {
    total: results.length,
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
    results,
  };
}

function scoreSkill(skill: GeneratedSkill): QualityResult {
  const issues: string[] = [];
  let score = 0;
  const content = skill.content;

  // 1. Valid frontmatter (20 pts)
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const fm = frontmatterMatch[1];
    if (fm.includes("name:") && fm.includes("description:")) {
      score += 20;
    } else {
      score += 10;
      if (!fm.includes("name:")) issues.push("Frontmatter missing 'name'");
      if (!fm.includes("description:"))
        issues.push("Frontmatter missing 'description'");
    }
  } else {
    issues.push("No valid frontmatter found");
  }

  // 2. Generated marker (5 pts)
  if (content.includes("<!-- generated -->")) {
    score += 5;
  } else {
    issues.push("Missing <!-- generated --> marker");
  }

  // 3. WebFetch doc references (20 pts)
  const docUrlCount = (content.match(/https:\/\/workos\.com\/docs\//g) || [])
    .length;
  if (docUrlCount >= 3) {
    score += 20;
  } else if (docUrlCount >= 1) {
    score += 10;
    issues.push(`Only ${docUrlCount} doc URL reference(s), expected 3+`);
  } else {
    issues.push("No doc URL references found");
  }

  // 4. Structural sections (15 pts)
  const h2Count = (content.match(/^## /gm) || []).length;
  if (h2Count >= 4) {
    score += 15;
  } else if (h2Count >= 2) {
    score += 8;
    issues.push(`Only ${h2Count} sections, expected 4+`);
  } else {
    issues.push(`Only ${h2Count} section(s), skill lacks structure`);
  }

  // 5. Content length > 1KB (10 pts)
  if (skill.sizeBytes > 1024) {
    score += 10;
  } else {
    issues.push(`Content is only ${skill.sizeBytes}B, below 1KB minimum`);
  }

  // 6. Has verification or error recovery (15 pts)
  const hasVerification =
    /verification|checklist/i.test(content) && content.includes("- [ ]");
  const hasErrorRecovery =
    /error recovery/i.test(content) && /###/.test(content);
  const hasBashCommands = /```bash/i.test(content);

  if (hasVerification || hasErrorRecovery) {
    score += 10;
    if (hasBashCommands) {
      score += 5;
    } else {
      issues.push("No runnable bash commands in verification/error recovery");
    }
  } else {
    issues.push("Missing verification checklist or error recovery section");
  }

  // 7. No raw doc dump (15 pts)
  // Check for long paragraphs without markdown formatting
  const paragraphs = content.split(/\n\n+/);
  const longUnformattedBlocks = paragraphs.filter(
    (p) =>
      p.length > 2048 &&
      !p.includes("#") &&
      !p.includes("|") &&
      !p.includes("```") &&
      !p.includes("- "),
  );

  if (longUnformattedBlocks.length === 0) {
    score += 15;
  } else {
    score += 5;
    issues.push(
      `${longUnformattedBlocks.length} block(s) of unformatted content >2KB (possible doc dump)`,
    );
  }

  return {
    skillName: skill.name,
    pass: score >= 70,
    score,
    issues,
  };
}
