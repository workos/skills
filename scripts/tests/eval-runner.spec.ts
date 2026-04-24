import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadCases, mean, stddev } from '../eval/runner.ts';

describe('mean', () => {
  it('returns 0 for empty array', () => {
    expect(mean([])).toBe(0);
  });

  it('returns the single value for length-1 array', () => {
    expect(mean([42])).toBe(42);
  });

  it('computes arithmetic mean', () => {
    expect(mean([95, 97, 93])).toBe(95);
  });

  it('handles negative values', () => {
    expect(mean([-10, 10])).toBe(0);
  });

  it('handles decimal values', () => {
    expect(mean([1, 2])).toBe(1.5);
  });
});

describe('stddev', () => {
  it('returns 0 for empty array', () => {
    expect(stddev([])).toBe(0);
  });

  it('returns 0 for single value', () => {
    expect(stddev([42])).toBe(0);
  });

  it('returns 0 for identical values', () => {
    expect(stddev([5, 5, 5])).toBe(0);
  });

  it('computes population stddev', () => {
    // mean=95, deviations: 0, 2, -2, variance=8/3, stddev=sqrt(8/3)≈1.633
    expect(stddev([95, 97, 93])).toBeCloseTo(1.633, 2);
  });

  it('handles symmetric extremes', () => {
    expect(stddev([100, 0])).toBe(50);
  });

  it('handles two identical values', () => {
    expect(stddev([80, 80])).toBe(0);
  });
});

describe('loadCases', () => {
  it('filters by multiple case IDs', () => {
    const dir = mkdtempSync(join(tmpdir(), 'workos-eval-cases-'));
    try {
      writeFileSync(
        join(dir, 'cases.yaml'),
        `- id: first
  product: sso
  skill: workos-sso
  skillType: generated
  prompt: one
  expected:
    methods: []
    envVars: []
    imports: []
    params: []
    flowSteps: []
    antiPatterns: []
- id: second
  product: sso
  skill: workos-sso
  skillType: generated
  prompt: two
  expected:
    methods: []
    envVars: []
    imports: []
    params: []
    flowSteps: []
    antiPatterns: []
- id: third
  product: rbac
  skill: workos-rbac
  skillType: generated
  prompt: three
  expected:
    methods: []
    envVars: []
    imports: []
    params: []
    flowSteps: []
    antiPatterns: []
`,
      );

      const cases = loadCases(dir, { caseIds: ['first', 'third'] });

      expect(cases.map((c) => c.id)).toEqual(['first', 'third']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
