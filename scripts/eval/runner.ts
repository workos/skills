import { join } from 'path';
import { createHash } from 'crypto';
import { readdirSync, readFileSync } from 'fs';
import { parse } from 'yaml';
import { generateCode } from './api.ts';
import { getCacheKey, readCache, writeCache } from './cache.ts';
import { scoreOutput, categorizeErrors } from './scorer.ts';
import { median, percentile } from './reporter.ts';
import type { EvalCase, EvalOptions, EvalReport, EvalResult, ProductSummary, ErrorCategory } from './types.ts';

const CASES_DIR = join(process.cwd(), 'scripts', 'eval', 'cases');

/** Arithmetic mean. Returns 0 for empty input. */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Population standard deviation. Returns 0 for 0 or 1 values. */
export function stddev(values: number[]): number {
  if (values.length <= 1) return 0;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
const PLUGIN_DIR = join(process.cwd(), 'plugins', 'workos', 'skills');
const REFS_DIR = join(PLUGIN_DIR, 'workos', 'references');

/** Load and parse all YAML test cases, optionally filtered */
export function loadCases(
  casesDir = CASES_DIR,
  filter?: { product?: string; caseId?: string; caseIds?: string[]; lang?: string },
): EvalCase[] {
  const files = readdirSync(casesDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

  const cases: EvalCase[] = [];

  for (const file of files) {
    try {
      const raw = readFileSync(join(casesDir, file), 'utf8');
      const parsed = parse(raw) as EvalCase[];
      if (Array.isArray(parsed)) {
        cases.push(...parsed);
      }
    } catch (err) {
      console.error(`⚠ Failed to parse ${file}:`, (err as Error).message);
    }
  }

  return cases.filter((c) => {
    if (filter?.product && c.product !== filter.product) return false;
    if (filter?.caseIds?.length && !filter.caseIds.includes(c.id)) return false;
    if (!filter?.caseIds?.length && filter?.caseId && c.id !== filter.caseId) return false;
    if (filter?.lang && c.language !== filter.lang) return false;
    return true;
  });
}

/** Load skill content from disk. All skills are now reference files. */
export function loadSkillContent(skillName: string): string {
  // All skills (including former hand-crafted) are now reference files
  const refPath = join(REFS_DIR, `${skillName}.md`);

  try {
    return readFileSync(refPath, 'utf8');
  } catch {
    // Fallback: try legacy guide path
    const guidePath = join(REFS_DIR, `${skillName}.guide.md`);
    try {
      return readFileSync(guidePath, 'utf8');
    } catch {
      throw new Error(`No skill files found for ${skillName} (tried ${refPath})`);
    }
  }
}

/** Hash unique skill file contents for cache provenance. */
function hashSkills(cases: EvalCase[]): string {
  const uniqueSkills = [...new Set(cases.map((c) => c.skill))].sort();
  const hash = createHash('sha256');
  for (const skill of uniqueSkills) {
    try {
      hash.update(loadSkillContent(skill));
    } catch {
      hash.update(skill);
    }
  }
  return hash.digest('hex').slice(0, 12);
}

/** Aggregate results by product */
export function aggregateResults(results: EvalResult[]): ProductSummary[] {
  const byProduct = new Map<string, EvalResult[]>();

  for (const r of results) {
    const key = r.skillType === 'hand-crafted' ? `${r.product}*` : r.product;
    if (!byProduct.has(key)) byProduct.set(key, []);
    byProduct.get(key)!.push(r);
  }

  const summaries: ProductSummary[] = [];

  for (const [key, productResults] of byProduct) {
    const isHandCrafted = key.endsWith('*');
    const product = isHandCrafted ? key.slice(0, -1) : key;

    const avgWith = productResults.reduce((s, r) => s + r.withSkill.scores.composite, 0) / productResults.length;
    const avgWithout = productResults.reduce((s, r) => s + r.withoutSkill.scores.composite, 0) / productResults.length;

    // Collect and count error categories
    const errorCounts = new Map<ErrorCategory, number>();
    for (const r of productResults) {
      for (const e of r.topErrors) {
        errorCounts.set(e, (errorCounts.get(e) ?? 0) + 1);
      }
    }
    const topErrors = [...errorCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([e]) => e);

    const deltas = productResults.map((r) => r.delta);

    // Mean of per-case delta stddevs (0 when single-sample)
    const avgDeltaStddev =
      productResults.length > 0
        ? Math.round((productResults.reduce((s, r) => s + r.deltaStddev, 0) / productResults.length) * 10) / 10
        : 0;

    summaries.push({
      product,
      caseCount: productResults.length,
      avgWithSkill: Math.round(avgWith),
      avgWithoutSkill: Math.round(avgWithout),
      avgDelta: Math.round(avgWith - avgWithout),
      medianDelta: Math.round(median(deltas)),
      p80Delta: Math.round(percentile(deltas, 80)),
      minDelta: Math.round(Math.min(...deltas)),
      maxDelta: Math.round(Math.max(...deltas)),
      topErrors,
      skillType: isHandCrafted ? 'hand-crafted' : 'generated',
      avgDeltaStddev,
    });
  }

  return summaries.sort((a, b) => b.avgDelta - a.avgDelta);
}

/** Evaluate a single case (both arms), optionally running N samples. */
async function evalCase(c: EvalCase, options: EvalOptions): Promise<EvalResult | null> {
  try {
    const skillContent = loadSkillContent(c.skill);

    const systemWith =
      'You have access to the following WorkOS integration skill. ' +
      'Use it to inform your implementation.\n\n' +
      skillContent +
      '\n\nYou are a software engineer implementing a WorkOS integration. Write working code. Include imports, environment variable setup, and error handling. Use the WorkOS SDK appropriate for the requested language.';
    const systemWithout =
      'You are a software engineer implementing a WorkOS integration. Write working code. Include imports, environment variable setup, and error handling. Use the WorkOS SDK appropriate for the requested language.';

    const sampleCount = Math.max(1, options.samples ?? 1);

    // For multi-sample: disable cache reads on ALL iterations to get fresh API responses
    const sampleOptions = sampleCount > 1 ? { ...options, noCache: true } : options;

    const withComposites: number[] = [];
    const withoutComposites: number[] = [];
    const withHallucinations: number[] = [];
    const withoutHallucinations: number[] = [];
    const deltas: number[] = [];
    const allWithOutputs: { output: string; composite: number }[] = [];
    const allWithoutOutputs: { output: string; composite: number }[] = [];

    // Keep first sample's full results for transcript/error reporting
    let firstWith!: {
      output: string;
      scores: ReturnType<typeof scoreOutput>;
      usage: { input: number; output: number };
    };
    let firstWithout!: {
      output: string;
      scores: ReturnType<typeof scoreOutput>;
      usage: { input: number; output: number };
    };
    let firstWithErrors!: ErrorCategory[];
    let firstWithoutErrors!: ErrorCategory[];

    let withTokensInput = 0;
    let withTokensOutput = 0;
    let withoutTokensInput = 0;
    let withoutTokensOutput = 0;
    let completedSamples = 0;

    for (let i = 0; i < sampleCount; i++) {
      try {
        const [withResult, withoutResult] = await Promise.all([
          getOrGenerate(c.prompt, systemWith, sampleOptions),
          getOrGenerate(c.prompt, systemWithout, sampleOptions),
        ]);

        const withScores = scoreOutput(withResult.output, c.expected);
        const withoutScores = scoreOutput(withoutResult.output, c.expected);

        withTokensInput += withResult.usage.input;
        withTokensOutput += withResult.usage.output;
        withoutTokensInput += withoutResult.usage.input;
        withoutTokensOutput += withoutResult.usage.output;

        withComposites.push(withScores.composite);
        withoutComposites.push(withoutScores.composite);
        withHallucinations.push(withScores.hallucinationCount);
        withoutHallucinations.push(withoutScores.hallucinationCount);
        deltas.push(withScores.composite - withoutScores.composite);

        if (options.saveAllSamples && sampleCount > 1) {
          allWithOutputs.push({ output: withResult.output, composite: withScores.composite });
          allWithoutOutputs.push({ output: withoutResult.output, composite: withoutScores.composite });
        }

        if (completedSamples === 0) {
          firstWith = { output: withResult.output, scores: withScores, usage: withResult.usage };
          firstWithout = { output: withoutResult.output, scores: withoutScores, usage: withoutResult.usage };
          firstWithErrors = categorizeErrors(withResult.output, c.expected);
          firstWithoutErrors = categorizeErrors(withoutResult.output, c.expected);
        }
        completedSamples++;
      } catch (err) {
        if (sampleCount === 1) throw err; // Single-sample: propagate as before
        console.error(`  ⚠ ${c.id} sample ${i + 1}/${sampleCount} failed: ${(err as Error).message}`);
      }
    }

    // All samples failed
    if (completedSamples === 0) {
      throw new Error(`${c.id}: all ${sampleCount} samples failed`);
    }

    if (sampleCount > 1 && completedSamples < 2) {
      console.warn(`  ⚠ ${c.id}: only ${completedSamples}/${sampleCount} samples succeeded, variance data unreliable`);
    }

    // Use mean composites and hallucination counts for reporting
    const avgWithComposite = Math.round(mean(withComposites));
    const avgWithoutComposite = Math.round(mean(withoutComposites));
    const avgWithHallucinations = Math.round(mean(withHallucinations));
    const avgWithoutHallucinations = Math.round(mean(withoutHallucinations));

    return {
      caseId: c.id,
      product: c.product,
      language: c.language,
      skillType: c.skillType,
      withSkill: {
        output: firstWith.output,
        scores: {
          ...firstWith.scores,
          composite: avgWithComposite,
          hallucinationCount: avgWithHallucinations,
        },
        tokenUsage: { input: withTokensInput, output: withTokensOutput },
      },
      withoutSkill: {
        output: firstWithout.output,
        scores: {
          ...firstWithout.scores,
          composite: avgWithoutComposite,
          hallucinationCount: avgWithoutHallucinations,
        },
        tokenUsage: { input: withoutTokensInput, output: withoutTokensOutput },
      },
      delta: Math.round(mean(deltas)),
      topErrors: firstWithoutErrors,
      withSkillErrors: firstWithErrors,
      withoutSkillErrors: firstWithoutErrors,
      sampleCount: completedSamples,
      withSkillStddev: Math.round(stddev(withComposites) * 10) / 10,
      withoutSkillStddev: Math.round(stddev(withoutComposites) * 10) / 10,
      deltaStddev: Math.round(stddev(deltas) * 10) / 10,
      ...(allWithOutputs.length > 0 && {
        allSampleOutputs: { withSkill: allWithOutputs, withoutSkill: allWithoutOutputs },
      }),
    };
  } catch (err) {
    throw new Error(`${c.id}: ${(err as Error).message}`);
  }
}

/** Check cache, generate if miss */
async function getOrGenerate(
  prompt: string,
  systemPrompt: string,
  options: EvalOptions,
): Promise<{ output: string; usage: { input: number; output: number } }> {
  const cacheKey = getCacheKey(options.model, systemPrompt, prompt);
  const cached = options.noCache ? null : await readCache(cacheKey);

  if (cached) return cached;

  const gen = await generateCode(prompt, systemPrompt, {
    apiKey: options.apiKey,
    model: options.model,
  });

  await writeCache(cacheKey, {
    output: gen.output,
    usage: gen.usage,
    model: options.model,
    cachedAt: new Date().toISOString(),
  });

  return gen;
}

/** Run the full eval */
export async function runEval(options: EvalOptions): Promise<EvalReport> {
  const cases = loadCases(CASES_DIR, {
    product: options.product,
    caseId: options.caseId,
    caseIds: options.caseIds,
    lang: options.lang,
  });

  if (cases.length === 0) {
    console.log('No eval cases found matching filters.');
    return {
      runId: new Date().toISOString(),
      model: options.model,
      totalCases: 0,
      results: [],
      summary: [],
    };
  }

  const skillHash = hashSkills(cases);

  if (options.dryRun) {
    console.log(`\nDry run: ${cases.length} cases would be evaluated\n`);
    console.log('ID'.padEnd(30) + 'Product'.padEnd(15) + 'Lang'.padEnd(8) + 'Skill'.padEnd(25) + 'Type');
    console.log('-'.repeat(88));
    for (const c of cases) {
      console.log(
        c.id.padEnd(30) + c.product.padEnd(15) + (c.language ?? 'node').padEnd(8) + c.skill.padEnd(25) + c.skillType,
      );
    }
    return {
      runId: new Date().toISOString(),
      model: options.model,
      skillHash,
      totalCases: cases.length,
      results: [],
      summary: [],
    };
  }

  const concurrency = Math.max(1, options.concurrency);
  const sampleCount = Math.max(1, options.samples ?? 1);
  const sampleSuffix = sampleCount > 1 ? ` (${sampleCount} samples per case, cache reads disabled)` : '';
  console.log(
    concurrency > 1 ? `\nRunning ${cases.length} cases with concurrency ${concurrency}${sampleSuffix}\n` : '',
  );

  const results: EvalResult[] = [];

  // Process in batches of `concurrency`
  for (let batch = 0; batch < cases.length; batch += concurrency) {
    const batchCases = cases.slice(batch, batch + concurrency);
    const batchResults = await Promise.allSettled(batchCases.map((c) => evalCase(c, options)));

    // Print results in case order after batch completes
    for (let i = 0; i < batchResults.length; i++) {
      const r = batchResults[i];
      const caseNum = batch + i + 1;
      const caseId = batchCases[i].id;
      if (r.status === 'fulfilled' && r.value) {
        const v = r.value;
        const deltaStr = `${v.delta > 0 ? '+' : ''}${v.delta}%`;
        if (v.sampleCount > 1) {
          console.log(
            `[${caseNum}/${cases.length}] ${caseId.padEnd(30)} with: ${v.withSkill.scores.composite}±${v.withSkillStddev}% | without: ${v.withoutSkill.scores.composite}±${v.withoutSkillStddev}% | delta: ${deltaStr}±${v.deltaStddev}%`,
          );
        } else {
          console.log(
            `[${caseNum}/${cases.length}] ${caseId.padEnd(30)} with: ${v.withSkill.scores.composite}% | without: ${v.withoutSkill.scores.composite}% | delta: ${deltaStr}`,
          );
        }
        results.push(r.value);
      } else if (r.status === 'rejected') {
        console.error(`[${caseNum}/${cases.length}] ${caseId.padEnd(30)} ✗ ${r.reason}`);
      }
    }
  }

  // Compute language breakdown
  const langAccum: Record<string, { count: number; withSum: number; withoutSum: number }> = {};
  for (const r of results) {
    const lang = r.language || 'node';
    if (!langAccum[lang]) langAccum[lang] = { count: 0, withSum: 0, withoutSum: 0 };
    langAccum[lang].count++;
    langAccum[lang].withSum += r.withSkill.scores.composite;
    langAccum[lang].withoutSum += r.withoutSkill.scores.composite;
  }
  const languageBreakdown: EvalReport['languageBreakdown'] = {};
  for (const [lang, acc] of Object.entries(langAccum)) {
    const avgWith = Math.round(acc.withSum / acc.count);
    const avgWithout = Math.round(acc.withoutSum / acc.count);
    languageBreakdown[lang] = {
      caseCount: acc.count,
      avgWithSkill: avgWith,
      avgWithoutSkill: avgWithout,
      avgDelta: avgWith - avgWithout,
    };
  }

  return {
    runId: new Date().toISOString(),
    model: options.model,
    skillHash,
    totalCases: cases.length,
    results,
    summary: aggregateResults(results),
    languageBreakdown,
  };
}
