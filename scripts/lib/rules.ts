import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { parse } from "yaml";
import type { SkillRule, RuleViolation } from "./types.ts";

/**
 * Load domain rules from skills/{skillName}/.rules.yml.
 * Returns empty array if no file exists or on parse error.
 */
export function loadRules(skillName: string): SkillRule[] {
  const rulesPath = join(process.cwd(), "skills", skillName, ".rules.yml");

  if (!existsSync(rulesPath)) {
    return [];
  }

  try {
    const raw = readFileSync(rulesPath, "utf8");
    if (!raw.trim()) return [];

    const parsed = parse(raw) as { rules?: SkillRule[] };
    return parsed?.rules ?? [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ⚠ Failed to parse ${rulesPath}: ${msg}`);
    return [];
  }
}

/**
 * Evaluate rules against skill content.
 * Returns array of violations (empty = all pass).
 */
export function evaluateRules(
  skillContent: string,
  rules: SkillRule[],
): RuleViolation[] {
  const violations: RuleViolation[] = [];

  for (const rule of rules) {
    // Effective severity: non-promoted rules always warn
    const effectiveSeverity = rule.promoted ? rule.severity : "warn";

    // Check must_contain patterns
    if (rule.must_contain) {
      for (const check of rule.must_contain) {
        try {
          const regex = new RegExp(check.pattern, "i");
          if (!regex.test(skillContent)) {
            violations.push({
              ruleId: rule.id,
              description: rule.description,
              severity: effectiveSeverity,
              type: "missing",
              pattern: check.pattern,
              context: check.context,
            });
          }
        } catch {
          console.error(
            `  ⚠ Invalid regex in rule ${rule.id}: ${check.pattern}`,
          );
        }
      }
    }

    // Check must_not_contain patterns
    if (rule.must_not_contain) {
      for (const check of rule.must_not_contain) {
        try {
          const regex = new RegExp(check.pattern, "i");
          if (regex.test(skillContent)) {
            violations.push({
              ruleId: rule.id,
              description: rule.description,
              severity: effectiveSeverity,
              type: "forbidden",
              pattern: check.pattern,
              context: check.context,
            });
          }
        } catch {
          console.error(
            `  ⚠ Invalid regex in rule ${rule.id}: ${check.pattern}`,
          );
        }
      }
    }
  }

  return violations;
}

/**
 * Format rules as constraint text for refiner prompts.
 * Returns empty string if no rules exist.
 */
export function formatRulesForPrompt(rules: SkillRule[]): string {
  if (rules.length === 0) return "";

  const lines = [
    "\n## Domain Constraints (MUST respect)\n",
    "The following rules are enforced during quality validation. Your output MUST satisfy them:\n",
  ];

  for (const rule of rules) {
    lines.push(`- **${rule.id}**: ${rule.description}`);

    if (rule.must_contain) {
      for (const check of rule.must_contain) {
        lines.push(`  MUST mention: ${check.context}`);
      }
    }
    if (rule.must_not_contain) {
      for (const check of rule.must_not_contain) {
        lines.push(`  MUST NOT claim: ${check.context}`);
      }
    }
  }

  return lines.join("\n");
}
