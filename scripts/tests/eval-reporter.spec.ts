import { describe, expect, it, vi } from 'vitest';
import { median, percentile, checkGates, printSummary, printErrorReductions } from '../eval/reporter.ts';
import { aggregateResults } from '../eval/runner.ts';
import type { EvalReport, EvalResult, ProductSummary, ScoreCard } from '../eval/types.ts';

function makeScoreCard(overrides: Partial<ScoreCard> = {}): ScoreCard {
  return {
    methodAccuracy: 1,
    paramAccuracy: 1,
    envVarCoverage: 1,
    importAccuracy: 1,
    flowCorrectness: 1,
    antiPatternAvoidance: 1,
    hallucinationCount: 0,
    composite: 80,
    ...overrides,
  };
}

function makeResult(overrides: Partial<EvalResult> = {}): EvalResult {
  return {
    caseId: 'test-case',
    product: 'sso',
    skillType: 'generated',
    withSkill: {
      output: '',
      scores: makeScoreCard({ composite: 80 }),
      tokenUsage: { input: 100, output: 100 },
    },
    withoutSkill: {
      output: '',
      scores: makeScoreCard({ composite: 40, hallucinationCount: 2 }),
      tokenUsage: { input: 100, output: 100 },
    },
    delta: 40,
    topErrors: [],
    withSkillErrors: [],
    withoutSkillErrors: [],
    sampleCount: 1,
    withSkillStddev: 0,
    withoutSkillStddev: 0,
    deltaStddev: 0,
    ...overrides,
  };
}

function makeSummary(overrides: Partial<ProductSummary> = {}): ProductSummary {
  return {
    product: 'sso',
    caseCount: 1,
    avgWithSkill: 80,
    avgWithoutSkill: 40,
    avgDelta: 40,
    medianDelta: 40,
    p80Delta: 40,
    minDelta: 40,
    maxDelta: 40,
    topErrors: [],
    avgDeltaStddev: 0,
    ...overrides,
  };
}

function makeReport(overrides: Partial<EvalReport> = {}): EvalReport {
  return {
    runId: 'test',
    model: 'test-model',
    totalCases: 1,
    results: [makeResult()],
    summary: [makeSummary()],
    ...overrides,
  };
}

describe('Widgets evidence reporting', () => {
  it('reports bounded evidence and recommendation errors without implying semantic proof', () => {
    const result = makeResult();
    result.withSkill.scores.widgetsRecommendation = 'supported';
    result.withoutSkill.scores.widgetsRecommendation = 'unknown';
    result.withoutSkillErrors = ['unverified_recommendation', 'incorrect_recommendation'];
    const report = makeReport({ results: [result] });
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      printSummary(report);
      printErrorReductions(report);
      const output = log.mock.calls.flat().join('\n');
      expect(output).toContain('bounded heuristic, not semantic proof; first sample');
      expect(output).toContain('with=supported, without=unknown');
      expect(output).toContain('unverified_recommendation');
      expect(output).toContain('incorrect_recommendation');
      expect(JSON.parse(JSON.stringify(report)).results[0].withSkill.scores.widgetsRecommendation).toBe('supported');
    } finally {
      log.mockRestore();
    }
  });
});

describe('median', () => {
  it('returns middle of odd-length array', () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it('returns average of two middle values for even-length array', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('returns the single value for length-1 array', () => {
    expect(median([42])).toBe(42);
  });

  it('returns 0 for empty array', () => {
    expect(median([])).toBe(0);
  });

  it('handles all same values', () => {
    expect(median([7, 7, 7, 7])).toBe(7);
  });

  it('handles negative values', () => {
    expect(median([-10, -5, -1])).toBe(-5);
  });

  it('does not mutate the input array', () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe('percentile', () => {
  it('returns p80 of 1..10', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 80)).toBe(8);
  });

  it('returns p50 of 1..10', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50)).toBe(5);
  });

  it('returns the single value for length-1 array', () => {
    expect(percentile([42], 80)).toBe(42);
  });

  it('returns 0 for empty array', () => {
    expect(percentile([], 80)).toBe(0);
  });

  it('returns max for p100', () => {
    expect(percentile([1, 2, 3, 4, 5], 100)).toBe(5);
  });

  it('returns min for p0 (clamped)', () => {
    // p0 → idx = ceil(0) - 1 = -1, clamped to 0
    expect(percentile([1, 2, 3, 4, 5], 0)).toBe(1);
  });

  it('does not mutate the input array', () => {
    const input = [3, 1, 2];
    percentile(input, 50);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe('checkGates', () => {
  it('passes when all deltas positive and hallucinations reduced', () => {
    const report = makeReport({
      results: [
        makeResult({
          withSkill: {
            output: '',
            scores: makeScoreCard({ composite: 80, hallucinationCount: 0 }),
            tokenUsage: { input: 100, output: 100 },
          },
          withoutSkill: {
            output: '',
            scores: makeScoreCard({ composite: 40, hallucinationCount: 4 }),
            tokenUsage: { input: 100, output: 100 },
          },
        }),
      ],
      summary: [makeSummary({ avgDelta: 40 })],
    });

    const result = checkGates(report);
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it('fails when a product has negative avg delta', () => {
    const report = makeReport({
      summary: [makeSummary({ product: 'sso', avgDelta: -5 })],
    });

    const result = checkGates(report);
    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toContain('sso');
    expect(result.failures[0]).toContain('negative avg delta');
  });

  it('fails when hallucination reduction < 50%', () => {
    const report = makeReport({
      results: [
        makeResult({
          withSkill: {
            output: '',
            scores: makeScoreCard({ hallucinationCount: 4 }),
            tokenUsage: { input: 100, output: 100 },
          },
          withoutSkill: {
            output: '',
            scores: makeScoreCard({ hallucinationCount: 5 }),
            tokenUsage: { input: 100, output: 100 },
          },
        }),
      ],
      summary: [makeSummary({ avgDelta: 10 })],
    });

    const result = checkGates(report);
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.includes('Hallucination'))).toBe(true);
  });

  it('passes when zero without-hallucinations (nothing to reduce)', () => {
    const report = makeReport({
      results: [
        makeResult({
          withSkill: {
            output: '',
            scores: makeScoreCard({ hallucinationCount: 0 }),
            tokenUsage: { input: 100, output: 100 },
          },
          withoutSkill: {
            output: '',
            scores: makeScoreCard({ hallucinationCount: 0 }),
            tokenUsage: { input: 100, output: 100 },
          },
        }),
      ],
      summary: [makeSummary({ avgDelta: 10 })],
    });

    const result = checkGates(report);
    expect(result.passed).toBe(true);
  });

  it('reports multiple failures', () => {
    const report = makeReport({
      results: [
        makeResult({
          withSkill: {
            output: '',
            scores: makeScoreCard({ hallucinationCount: 8 }),
            tokenUsage: { input: 100, output: 100 },
          },
          withoutSkill: {
            output: '',
            scores: makeScoreCard({ hallucinationCount: 10 }),
            tokenUsage: { input: 100, output: 100 },
          },
        }),
      ],
      summary: [makeSummary({ product: 'sso', avgDelta: -3 }), makeSummary({ product: 'rbac', avgDelta: -1 })],
    });

    const result = checkGates(report);
    expect(result.passed).toBe(false);
    // 2 negative deltas + 1 hallucination gate = 3 failures
    expect(result.failures.length).toBeGreaterThanOrEqual(3);
  });

  it('passes hallucination gate at exactly 50% reduction', () => {
    const report = makeReport({
      results: [
        makeResult({
          withSkill: {
            output: '',
            scores: makeScoreCard({ hallucinationCount: 5 }),
            tokenUsage: { input: 100, output: 100 },
          },
          withoutSkill: {
            output: '',
            scores: makeScoreCard({ hallucinationCount: 10 }),
            tokenUsage: { input: 100, output: 100 },
          },
        }),
      ],
      summary: [makeSummary({ avgDelta: 10 })],
    });

    const result = checkGates(report);
    // 50% reduction exactly — gate requires < 0.5 to fail, so 0.5 passes
    expect(result.passed).toBe(true);
  });
});

describe('aggregateResults with multi-sample data', () => {
  it('computes avgDeltaStddev as mean of per-case deltaStddevs', () => {
    const results = [
      makeResult({ product: 'sso', deltaStddev: 2.0 }),
      makeResult({ product: 'sso', caseId: 'sso-2', deltaStddev: 4.0 }),
    ];
    const summaries = aggregateResults(results);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].avgDeltaStddev).toBe(3.0);
  });

  it('returns avgDeltaStddev 0 for single-sample results', () => {
    const results = [makeResult({ product: 'sso', deltaStddev: 0, sampleCount: 1 })];
    const summaries = aggregateResults(results);
    expect(summaries[0].avgDeltaStddev).toBe(0);
  });

  it('separates hand-crafted and generated avgDeltaStddev', () => {
    const results = [
      makeResult({ product: 'authkit', skillType: 'hand-crafted', deltaStddev: 5.0 }),
      makeResult({ product: 'authkit', skillType: 'generated', caseId: 'authkit-gen', deltaStddev: 1.0 }),
    ];
    const summaries = aggregateResults(results);
    expect(summaries).toHaveLength(2);
    const hc = summaries.find((s) => s.skillType === 'hand-crafted')!;
    const gen = summaries.find((s) => s.skillType === 'generated')!;
    expect(hc.avgDeltaStddev).toBe(5.0);
    expect(gen.avgDeltaStddev).toBe(1.0);
  });
});
