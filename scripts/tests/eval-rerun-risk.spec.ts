import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { resolveCaseIds } from '../eval-rerun-risk.ts';

function baseOptions(
  overrides: Partial<Parameters<typeof resolveCaseIds>[0]> = {},
): Parameters<typeof resolveCaseIds>[0] {
  return {
    top: 9,
    minRisk: 1,
    samples: 8,
    concurrency: 3,
    report: 'both',
    dryRun: false,
    noCache: true,
    saveAllSamples: true,
    failOnRegression: false,
    ...overrides,
  };
}

describe('resolveCaseIds', () => {
  it('fails when explicit --triage path does not exist', () => {
    const missingPath = join(tmpdir(), 'workos-missing-triage-report.json');

    expect(() => resolveCaseIds(baseOptions({ triagePath: missingPath }))).toThrow(/--triage report not found/);
  });

  it('fails when explicit --triage filters select no cases', () => {
    const dir = mkdtempSync(join(tmpdir(), 'workos-eval-triage-'));
    const triagePath = join(dir, 'triage.json');

    try {
      writeFileSync(
        triagePath,
        JSON.stringify({
          triageCases: [{ caseId: 'low-risk-case', riskScore: 1 }],
        }),
      );

      expect(() => resolveCaseIds(baseOptions({ triagePath, minRisk: 2 }))).toThrow(/--triage selected 0 cases/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails with context when explicit --triage cannot be parsed', () => {
    const dir = mkdtempSync(join(tmpdir(), 'workos-eval-triage-'));
    const triagePath = join(dir, 'triage.json');

    try {
      writeFileSync(triagePath, '{bad json}');

      expect(() => resolveCaseIds(baseOptions({ triagePath }))).toThrow(/Failed to read --triage report/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('selects cases from explicit --triage when filters match', () => {
    const dir = mkdtempSync(join(tmpdir(), 'workos-eval-triage-'));
    const triagePath = join(dir, 'triage.json');

    try {
      writeFileSync(
        triagePath,
        JSON.stringify({
          triageCases: [
            { caseId: 'first', riskScore: 3 },
            { caseId: 'second', riskScore: 2 },
            { caseId: 'third', riskScore: 1 },
          ],
        }),
      );

      expect(resolveCaseIds(baseOptions({ triagePath, minRisk: 2, top: 1 }))).toEqual({
        caseIds: ['first'],
        source: triagePath,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
