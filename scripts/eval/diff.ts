import { join } from 'path';
import { readdir, readFile } from 'fs/promises';
import { parse } from 'yaml';
import { normalizeForMatch } from './scorer.ts';
import { assessWidgetsRecommendation } from './widgets-recommendation.ts';
import type { ExpectedSignals, EvalCase, WidgetsRecommendation } from './types.ts';

const OUTPUT_DIR = join(process.cwd(), 'scripts', 'output');
const CASES_DIR = join(process.cwd(), 'scripts', 'eval', 'cases');

// ANSI codes
const GREEN_BG = '\x1b[42m\x1b[30m';
const RED_UL = '\x1b[4m\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

export interface SignalSummary {
  methods: { found: number; total: number; matched: string[]; missing: string[] };
  params: { found: number; total: number; matched: string[]; missing: string[] };
  envVars: { found: number; total: number; matched: string[]; missing: string[] };
  imports: { found: number; total: number; matched: string[]; missing: string[] };
  hallucinations: { found: number; names: string[] };
  flowSteps: { found: number; total: number; inOrder: boolean };
  widgetsRecommendation?: WidgetsRecommendation;
}

/** Compute which expected signals are present/missing in output. */
export function summarizeSignals(output: string, expected: ExpectedSignals): SignalSummary {
  const lower = output.toLowerCase();
  const normalized = normalizeForMatch(output);

  function checkPresence(items: string[]): { found: number; total: number; matched: string[]; missing: string[] } {
    const matched: string[] = [];
    const missing: string[] = [];
    for (const item of items) {
      if (normalized.includes(normalizeForMatch(item)) || lower.includes(item.toLowerCase())) {
        matched.push(item);
      } else {
        missing.push(item);
      }
    }
    return { found: matched.length, total: items.length, matched, missing };
  }

  // Flow steps: check presence and order
  const flowPositions: number[] = [];
  let flowFound = 0;
  for (const step of expected.flowSteps) {
    const idx = lower.indexOf(step.toLowerCase());
    if (idx !== -1) {
      flowFound++;
      flowPositions.push(idx);
    }
  }
  let inOrder = true;
  for (let i = 1; i < flowPositions.length; i++) {
    if (flowPositions[i] <= flowPositions[i - 1]) {
      inOrder = false;
      break;
    }
  }

  // Hallucinations
  const hallNames: string[] = [];
  for (const h of expected.hallucinations ?? []) {
    if (lower.includes(h.toLowerCase()) || normalized.includes(normalizeForMatch(h))) {
      hallNames.push(h);
    }
  }

  return {
    methods: checkPresence(expected.methods),
    params: checkPresence(expected.params),
    envVars: checkPresence(expected.envVars),
    imports: checkPresence(expected.imports),
    hallucinations: { found: hallNames.length, names: hallNames },
    flowSteps: { found: flowFound, total: expected.flowSteps.length, inOrder },
    ...(expected.widgetsRecommendation && { widgetsRecommendation: assessWidgetsRecommendation(output) }),
  };
}

/** Highlight matched signals in output text with ANSI codes. */
export function highlightOutput(output: string, expected: ExpectedSignals): string {
  let result = output;

  // Highlight hallucinations (red underline) — do first so they don't overlap with methods
  for (const h of expected.hallucinations ?? []) {
    const regex = new RegExp(escapeRegex(h), 'gi');
    result = result.replace(regex, (m) => `${RED_UL}${m}${RESET}`);
  }

  // Highlight methods (green background)
  for (const method of expected.methods) {
    const parts = method.split('.');
    const lastPart = parts[parts.length - 1];
    // Try full method, then last segment
    for (const term of [method, lastPart]) {
      const regex = new RegExp(escapeRegex(term), 'gi');
      result = result.replace(regex, (m) => `${GREEN_BG}${m}${RESET}`);
    }
  }

  // Highlight anti-patterns (yellow)
  for (const ap of expected.antiPatterns) {
    const regex = new RegExp(escapeRegex(ap), 'gi');
    result = result.replace(regex, (m) => `${YELLOW}${m}${RESET}`);
  }

  return result;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Format a signal summary block for display. */
export function formatSummary(s: SignalSummary): string {
  const lines: string[] = [];
  const check = (found: number, total: number) => (found === total ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`);

  lines.push(`  Methods:        ${s.methods.found}/${s.methods.total} ${check(s.methods.found, s.methods.total)}`);
  if (s.methods.missing.length > 0) lines.push(`    ${DIM}missing: ${s.methods.missing.join(', ')}${RESET}`);

  lines.push(`  Params:         ${s.params.found}/${s.params.total} ${check(s.params.found, s.params.total)}`);
  lines.push(`  Env vars:       ${s.envVars.found}/${s.envVars.total} ${check(s.envVars.found, s.envVars.total)}`);
  lines.push(`  Imports:        ${s.imports.found}/${s.imports.total} ${check(s.imports.found, s.imports.total)}`);

  const flowStatus =
    s.flowSteps.total === 0
      ? 'n/a'
      : s.flowSteps.inOrder
        ? `${s.flowSteps.found}/${s.flowSteps.total} in order`
        : `${s.flowSteps.found}/${s.flowSteps.total} out of order`;
  lines.push(`  Flow:           ${flowStatus}`);

  const hallColor = s.hallucinations.found === 0 ? GREEN : RED;
  lines.push(
    `  Hallucinations: ${hallColor}${s.hallucinations.found}${RESET}${s.hallucinations.names.length > 0 ? ` (${s.hallucinations.names.join(', ')})` : ''}`,
  );

  if (s.widgetsRecommendation) {
    lines.push(`  Widgets recommendation: ${s.widgetsRecommendation} (bounded heuristic, not semantic proof)`);
  }

  return lines.join('\n');
}

/** Print diff for a single case — sequential layout (with header, then without). */
export function printDiff(
  caseId: string,
  withOutput: string,
  withoutOutput: string,
  withComposite: number,
  withoutComposite: number,
  expected: ExpectedSignals,
): void {
  const withSummary = summarizeSignals(withOutput, expected);
  const withoutSummary = summarizeSignals(withoutOutput, expected);

  const width = Math.min(process.stdout.columns || 80, 120);
  const sep = '─'.repeat(width);

  console.log(`\n${BOLD}Case: ${caseId}${RESET}`);
  console.log(sep);

  // With skill
  console.log(
    `\n${GREEN}┌─── With Skill (composite: ${withComposite}%) ${'─'.repeat(Math.max(0, width - 35))}${RESET}`,
  );
  console.log(highlightOutput(truncateOutput(withOutput, 60), expected));
  console.log(`${GREEN}├─── Signal Summary ${'─'.repeat(Math.max(0, width - 22))}${RESET}`);
  console.log(formatSummary(withSummary));

  // Without skill
  console.log(
    `\n${RED}┌─── Without Skill (composite: ${withoutComposite}%) ${'─'.repeat(Math.max(0, width - 38))}${RESET}`,
  );
  console.log(highlightOutput(truncateOutput(withoutOutput, 60), expected));
  console.log(`${RED}├─── Signal Summary ${'─'.repeat(Math.max(0, width - 22))}${RESET}`);
  console.log(formatSummary(withoutSummary));

  console.log(`\n${sep}`);
}

function truncateOutput(output: string, maxLines: number): string {
  const lines = output.split('\n');
  if (lines.length <= maxLines) return output;
  return lines.slice(0, maxLines).join('\n') + `\n${DIM}... (${lines.length - maxLines} more lines)${RESET}`;
}

/** Load the latest transcript file (or one matching a run prefix). */
export async function loadTranscript(runPrefix?: string): Promise<{
  runId: string;
  transcripts: {
    caseId: string;
    withSkill: { output: string; scores: { composite: number } };
    withoutSkill: { output: string; scores: { composite: number } };
  }[];
}> {
  const files = await readdir(OUTPUT_DIR);
  let candidates = files.filter((f) => f.startsWith('eval-transcripts-') && f.endsWith('.json'));
  if (runPrefix) {
    candidates = candidates.filter((f) => f.includes(runPrefix));
  }
  candidates.sort().reverse();
  if (candidates.length === 0) throw new Error('No transcript files found');
  const raw = await readFile(join(OUTPUT_DIR, candidates[0]), 'utf8');
  return JSON.parse(raw);
}

/** Load expected signals for a case from YAML files. */
export async function loadCaseExpected(caseId: string): Promise<ExpectedSignals> {
  const files = (await readdir(CASES_DIR)).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
  for (const file of files) {
    const raw = await readFile(join(CASES_DIR, file), 'utf8');
    const cases = parse(raw) as EvalCase[];
    if (!Array.isArray(cases)) continue;
    const found = cases.find((c) => c.id === caseId);
    if (found) return found.expected;
  }
  throw new Error(`Case "${caseId}" not found in eval case files`);
}
