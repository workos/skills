import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import type { EvalReport, ErrorCategory } from './types.ts';

const OUTPUT_DIR = join(process.cwd(), 'scripts', 'output');

// ANSI color codes
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function colorDelta(delta: number): string {
  const prefix = delta > 0 ? '+' : '';
  const str = `${prefix}${delta}%`;
  if (delta >= 20) return `${GREEN}${str}${RESET}`;
  if (delta >= 10) return `${YELLOW}${str}${RESET}`;
  return `${RED}${str}${RESET}`;
}

function sign(n: number): string {
  return n > 0 ? '+' : '';
}

/** Return the median of a numeric array. Returns 0 for empty input. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Return the p-th percentile of a numeric array. Returns 0 for empty input. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/** Print the eval results as a console table */
export function printTable(report: EvalReport): void {
  if (report.summary.length === 0) {
    console.log('\nNo results to display.\n');
    return;
  }

  console.log(`\n${'─'.repeat(90)}`);
  console.log(`WorkOS Skill Eval Report`);
  console.log(`Model: ${report.model} | Cases: ${report.totalCases} | Date: ${report.runId.split('T')[0]}`);
  console.log(`${'─'.repeat(90)}\n`);

  // Header
  const h = [
    'Product'.padEnd(18),
    'Cases'.padStart(5),
    'With Skill'.padStart(11),
    'Without'.padStart(8),
    'Delta'.padStart(8),
    'Top Errors',
  ];
  console.log(h.join('  '));
  console.log(`${'─'.repeat(90)}`);

  // Rows
  const multiSample = report.summary.some((s) => s.avgDeltaStddev > 0);
  for (const s of report.summary) {
    const suffix = s.skillType === 'hand-crafted' ? ' *' : '';
    const deltaDisplay =
      multiSample && s.avgDeltaStddev > 0 ? `${colorDelta(s.avgDelta)}±${s.avgDeltaStddev}` : colorDelta(s.avgDelta);
    const row = [
      `${s.product}${suffix}`.padEnd(18),
      String(s.caseCount).padStart(5),
      `${s.avgWithSkill}%`.padStart(11),
      `${s.avgWithoutSkill}%`.padStart(8),
      deltaDisplay.padStart(8 + 9), // ANSI codes add ~9 chars
      s.topErrors.join(', ') || DIM + 'none' + RESET,
    ];
    console.log(row.join('  '));
  }

  console.log(`\n${DIM}* = hand-crafted skill${RESET}\n`);
}

/** Print summary stats */
export function printSummary(report: EvalReport): void {
  if (report.results.length === 0) return;

  const generated = report.summary.filter((s) => s.skillType === 'generated');
  const handCrafted = report.summary.filter((s) => s.skillType === 'hand-crafted');

  if (generated.length > 0) {
    const avgGenWith = Math.round(generated.reduce((s, g) => s + g.avgWithSkill, 0) / generated.length);
    const avgGenDelta = Math.round(generated.reduce((s, g) => s + g.avgDelta, 0) / generated.length);
    console.log(`Generated avg:     ${avgGenWith}%  (delta: ${colorDelta(avgGenDelta)})`);
  }

  if (handCrafted.length > 0) {
    const avgHcWith = Math.round(handCrafted.reduce((s, h) => s + h.avgWithSkill, 0) / handCrafted.length);
    const avgHcDelta = Math.round(handCrafted.reduce((s, h) => s + h.avgDelta, 0) / handCrafted.length);
    console.log(`Hand-crafted avg:  ${avgHcWith}%  (delta: ${colorDelta(avgHcDelta)})`);
  }

  // Distribution stats
  if (report.summary.length > 0) {
    console.log('\n  Distribution:');
    for (const s of report.summary) {
      const stddevSuffix = s.avgDeltaStddev > 0 ? `  σ: ${s.avgDeltaStddev}` : '';
      console.log(
        `    ${s.product.padEnd(18)} median: ${sign(s.medianDelta)}${s.medianDelta}%  p80: ${sign(s.p80Delta)}${s.p80Delta}%  range: [${s.minDelta}%, ${s.maxDelta}%]${stddevSuffix}`,
      );
    }
  }

  const widgetsResults = report.results.filter((r) => r.withSkill.scores.widgetsRecommendation !== undefined);
  if (widgetsResults.length > 0) {
    console.log('\n  Widgets recommendation evidence (bounded heuristic, not semantic proof; first sample):');
    for (const r of widgetsResults) {
      console.log(
        `    ${r.caseId}: with=${r.withSkill.scores.widgetsRecommendation}, without=${r.withoutSkill.scores.widgetsRecommendation}`,
      );
    }
  }

  // Token usage estimate
  const totalTokens = report.results.reduce(
    (sum, r) =>
      sum +
      r.withSkill.tokenUsage.input +
      r.withSkill.tokenUsage.output +
      r.withoutSkill.tokenUsage.input +
      r.withoutSkill.tokenUsage.output,
    0,
  );
  console.log(
    `\n${DIM}Total tokens: ${totalTokens.toLocaleString()} (~$${(totalTokens * 0.000005).toFixed(2)} est.)${RESET}`,
  );
}

/** Write the full report to a JSON file */
export async function writeJsonReport(report: EvalReport): Promise<string> {
  await mkdir(OUTPUT_DIR, { recursive: true });

  // Strip outputs from the JSON report to keep it manageable
  const slimResults = report.results.map((r) => ({
    ...r,
    withSkill: {
      scores: r.withSkill.scores,
      tokenUsage: r.withSkill.tokenUsage,
    },
    withoutSkill: {
      scores: r.withoutSkill.scores,
      tokenUsage: r.withoutSkill.tokenUsage,
    },
  }));

  const slimReport = { ...report, results: slimResults };
  const filename = `eval-report-${report.runId.replace(/[:.]/g, '-')}.json`;
  const filepath = join(OUTPUT_DIR, filename);

  await writeFile(filepath, JSON.stringify(slimReport, null, 2));
  console.log(`\n${DIM}Report written to ${filepath}${RESET}`);
  return filepath;
}

/** Write full model outputs for manual transcript review. */
export async function writeTranscripts(report: EvalReport): Promise<string> {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const filename = `eval-transcripts-${report.runId.replace(/[:.]/g, '-')}.json`;
  const filepath = join(OUTPUT_DIR, filename);

  const payload = {
    runId: report.runId,
    model: report.model,
    totalCases: report.totalCases,
    ...(report.widgetsSources && { widgetsSources: report.widgetsSources }),
    transcripts: report.results.map((r) => ({
      caseId: r.caseId,
      product: r.product,
      language: r.language,
      skillType: r.skillType,
      delta: r.delta,
      sampleCount: r.sampleCount,
      withSkillStddev: r.withSkillStddev,
      withoutSkillStddev: r.withoutSkillStddev,
      deltaStddev: r.deltaStddev,
      withSkill: {
        output: r.withSkill.output,
        scores: r.withSkill.scores,
      },
      withoutSkill: {
        output: r.withoutSkill.output,
        scores: r.withoutSkill.scores,
      },
      ...(r.allSampleOutputs && { allSampleOutputs: r.allSampleOutputs }),
    })),
  };

  await writeFile(filepath, JSON.stringify(payload, null, 2));
  console.log(`${DIM}Transcripts written to ${filepath}${RESET}`);
  return filepath;
}

/** Print per-language stats. Skipped when ≤1 language. */
export function printLanguageBreakdown(report: EvalReport): void {
  if (!report.languageBreakdown || Object.keys(report.languageBreakdown).length <= 1) return;

  console.log('\n  Language Breakdown:');
  for (const [lang, stats] of Object.entries(report.languageBreakdown)) {
    console.log(
      `    ${lang.padEnd(10)} ${String(stats.caseCount).padStart(3)} cases  avg with: ${stats.avgWithSkill}%  avg without: ${stats.avgWithoutSkill}%  delta: ${colorDelta(stats.avgDelta)}`,
    );
  }
}

/** Print error reduction table: without-skill errors vs with-skill errors. */
export function printErrorReductions(report: EvalReport): void {
  const withoutCounts = new Map<ErrorCategory, number>();
  const withCounts = new Map<ErrorCategory, number>();

  for (const r of report.results) {
    for (const e of r.withoutSkillErrors ?? r.topErrors) {
      withoutCounts.set(e, (withoutCounts.get(e) ?? 0) + 1);
    }
    for (const e of r.withSkillErrors ?? []) {
      withCounts.set(e, (withCounts.get(e) ?? 0) + 1);
    }
  }

  const allCategories = new Set([...withoutCounts.keys(), ...withCounts.keys()]);
  if (allCategories.size === 0) return;

  console.log('\n  Error Reductions:');
  console.log(`    ${'Category'.padEnd(25)} Without  With  Reduction`);
  console.log(`    ${'─'.repeat(55)}`);

  for (const cat of [...allCategories].sort()) {
    const without = withoutCounts.get(cat) ?? 0;
    const withCount = withCounts.get(cat) ?? 0;
    const reduction = without - withCount;
    const reductionStr =
      reduction > 0 ? `${GREEN}-${reduction}${RESET}` : reduction < 0 ? `${RED}+${Math.abs(reduction)}${RESET}` : '0';
    console.log(
      `    ${cat.padEnd(25)} ${String(without).padStart(7)}  ${String(withCount).padStart(4)}  ${reductionStr}`,
    );
  }
}

/** Check regression gates. Returns pass/fail with failure reasons. */
export function checkGates(report: EvalReport): {
  passed: boolean;
  failures: string[];
} {
  const failures: string[] = [];

  // Gate 1: No product shows negative average delta
  for (const s of report.summary) {
    if (s.avgDelta < 0) {
      failures.push(`${s.product} has negative avg delta: ${s.avgDelta}%`);
    }
  }

  // Gate 2: Hallucination reduction >= 50%
  let withHallucinations = 0;
  let withoutHallucinations = 0;
  for (const r of report.results) {
    withHallucinations += r.withSkill.scores.hallucinationCount;
    withoutHallucinations += r.withoutSkill.scores.hallucinationCount;
  }
  if (withoutHallucinations > 0) {
    const reduction = (withoutHallucinations - withHallucinations) / withoutHallucinations;
    if (reduction < 0.5) {
      failures.push(
        `Hallucination reduction ${(reduction * 100).toFixed(0)}% < 50% threshold ` +
          `(${withoutHallucinations} without → ${withHallucinations} with)`,
      );
    }
  }

  return { passed: failures.length === 0, failures };
}
