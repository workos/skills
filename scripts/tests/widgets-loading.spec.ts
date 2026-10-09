import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCases, loadSkillContent, loadWidgetsSources, runEval } from '../eval/runner.ts';
import { generateCode } from '../eval/api.ts';
import { getCacheKey, writeCache } from '../eval/cache.ts';
import { writeJsonReport, writeTranscripts } from '../eval/reporter.ts';
import type { EvalOptions } from '../eval/types.ts';

// No provider calls or cache writes: this tests the real runner's input plumbing.
vi.mock('../eval/api.ts', () => ({ generateCode: vi.fn() }));
vi.mock('../eval/cache.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../eval/cache.ts')>()),
  readCache: vi.fn(),
  writeCache: vi.fn(),
}));

const sourcePaths = [
  'workos-widgets/SKILL.md',
  'workos-widgets/references/component-setup.md',
  'workos-widgets/references/token-strategies.md',
  'workos-widgets/references/fetching-apis.md',
];
const caseIds = ['widgets-profile-versioned-setup', 'widgets-organization-versioned-setup'];
const options: EvalOptions = {
  model: 'offline-stub',
  apiKey: '',
  noCache: true,
  dryRun: true,
  concurrency: 1,
  caseIds,
};
const sha256 = (content: string) => createHash('sha256').update(content).digest('hex');

beforeEach(() => {
  vi.mocked(generateCode).mockReset();
  vi.mocked(writeCache).mockClear();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('Actual shipped Widgets eval sources (offline, not agent routing)', () => {
  it('loads the exact entry skill and component/token/API-boundary guidance with source identities', () => {
    const sources = loadWidgetsSources();
    expect(sources.map((s) => s.path)).toEqual(sourcePaths);
    for (const source of sources) {
      expect(source.content).toBe(readFileSync(join('plugins/workos/skills', source.path), 'utf8'));
      expect(source.sha256).toBe(sha256(source.content));
      if (source.path !== sourcePaths[0]) {
        expect(sources[0].content).toContain(`](${source.path.replace('workos-widgets/', '')})`);
      }
    }
    const content = loadSkillContent('workos-widgets');
    expect(content).toBe(sources.map(({ path, content }) => `<!-- Skill source: ${path} -->\n${content}`).join('\n\n'));
    expect(content).toContain('name: workos-widgets');
    expect(content).toContain('const { token } = await workos.widgets.createToken(');
    expect(content).toContain('<UserProfile authToken={authToken} />');
    expect(content).toContain('requireAuthenticatedSession(request)');
    expect(content).toContain('requireAuthorizedOrganization(session)');
    expect(content).toContain('userId: session.user.id');
    expect(content).toContain('widgets:users-table:manage');
    expect(content).toContain('/client/graphql');
    expect(content).toContain('Legacy REST snapshot only');
  });

  it('keeps migration/terminology cases single-reference, distinct from explicit Widgets cases', () => {
    const cases = loadCases();
    for (const c of cases.filter((c) => c.skill === 'workos-migrate-clerk' || c.skill === 'workos-terms')) {
      expect(loadSkillContent(c.skill)).toBe(
        readFileSync(join('plugins/workos/skills/workos/references', `${c.skill}.md`), 'utf8'),
      );
    }
    const widgetsCases = loadCases(undefined, { caseIds });
    expect(widgetsCases.map((c) => c.id)).toEqual(caseIds);
    for (const c of widgetsCases) {
      expect(c.skill).toBe('workos-widgets');
      expect(c.skillType).toBe('hand-crafted');
      expect(c.prompt).toContain('1.18.0');
      expect(c.prompt).toContain('10.13.0');
      expect(c.expected.methods).toContain('workos.widgets.createToken');
    }
  });

  it('dry-runs actual cases and hashes all source identities/content without calling a model', async () => {
    const report = await runEval(options);
    expect(report.totalCases).toBe(2);
    expect(report.results).toEqual([]);
    expect(report.widgetsSources).toEqual(loadWidgetsSources());
    expect(report.skillHash).toBe(sha256(loadSkillContent('workos-widgets')).slice(0, 12));
    expect(generateCode).not.toHaveBeenCalled();
    expect(writeCache).not.toHaveBeenCalled();
  });

  it('sends the recorded bundle only to the with-skill arm and persists exact provenance', async () => {
    vi.mocked(generateCode).mockResolvedValue({ output: 'Offline fixture only.', usage: { input: 0, output: 0 } });
    const report = await runEval({ ...options, dryRun: false, caseIds: [caseIds[0]] });
    expect(report.results).toHaveLength(1);
    const sources = report.widgetsSources!;
    const withSystem = vi.mocked(generateCode).mock.calls[0][1];
    const withoutSystem = vi.mocked(generateCode).mock.calls[1][1];
    expect(withSystem).toContain(loadSkillContent('workos-widgets', sources));
    for (const source of sources) {
      expect(withSystem).toContain(source.content);
      expect(withoutSystem).not.toContain(source.content);
    }
    expect(generateCode).toHaveBeenCalledTimes(2);
    // Exercise the actual report/transcript writers; remove only our artifacts.
    report.runId = `widgets-offline-${randomUUID()}`;
    const paths: string[] = [];
    try {
      paths.push(await writeJsonReport(report));
      paths.push(await writeTranscripts(report));
      for (const path of paths) {
        expect(JSON.parse(readFileSync(path, 'utf8')).widgetsSources).toEqual(sources);
      }
    } finally {
      for (const path of paths) rmSync(path);
    }
  });

  it.each(['../workos-widgets', '/workos-widgets', 'workos-widgets/SKILL.md', 'workos-widgets\\SKILL.md'])(
    'rejects path-shaped skill identity %s in the loader and YAML cases',
    (skill) => {
      expect(() => loadSkillContent(skill)).toThrow('Invalid skill name');
      const dir = mkdtempSync(join(process.cwd(), '.widgets-cases-'));
      try {
        writeFileSync(join(dir, 'invalid.yaml'), JSON.stringify([{ id: 'bad-path', skill }]));
        expect(() => loadCases(dir)).toThrow('Invalid skill name');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );

  it('fails closed on missing/symlinked sources and changes identity when a source changes', () => {
    const dir = mkdtempSync(join(process.cwd(), '.widgets-sources-'));
    const root = join(dir, 'skills');
    try {
      mkdirSync(root);
      expect(() => loadWidgetsSources(root)).toThrow();
      for (const { path, content } of loadWidgetsSources()) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), content);
      }
      const before = loadWidgetsSources(root);
      const target = join(root, sourcePaths[2]);
      writeFileSync(target, `${before[2].content}\n<!-- Changed fixture -->\n`);
      const after = loadWidgetsSources(root);
      expect(after[2].sha256).not.toBe(before[2].sha256);
      const beforeContent = loadSkillContent('workos-widgets', before);
      const afterContent = loadSkillContent('workos-widgets', after);
      expect(sha256(afterContent)).not.toBe(sha256(beforeContent));
      expect(getCacheKey('stub', afterContent, 'prompt')).not.toBe(getCacheKey('stub', beforeContent, 'prompt'));
      rmSync(target);
      const outsideRoot = join(dir, 'not-a-skill.md');
      writeFileSync(outsideRoot, 'Must not be loaded');
      symlinkSync(outsideRoot, target);
      expect(() => loadWidgetsSources(root)).toThrow('Non-canonical Widgets source');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
