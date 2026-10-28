import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildWellKnown } from '../build-well-known.ts';

const skillsDir = join(process.cwd(), 'plugins/workos/skills');
const sourceFiles = (dir: string, prefix = ''): string[] =>
  readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((entry) => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (path === 'evals') return [];
    return entry.isDirectory() ? sourceFiles(dir, path) : [path];
  });

describe('buildWellKnown', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'well-known-'));
  const index = buildWellKnown(skillsDir, outDir);

  it('lists every skill as a digest-pinned archive', () => {
    expect(index.skills.map((skill) => skill.name)).toEqual(['workos', 'workos-widgets']);
    expect(JSON.parse(readFileSync(join(outDir, 'index.json'), 'utf8'))).toEqual(index);
    for (const skill of index.skills) {
      const archive = readFileSync(join(outDir, skill.url));
      expect(skill.digest).toBe(`sha256:${createHash('sha256').update(archive).digest('hex')}`);
    }
  });

  it.each(['workos', 'workos-widgets'])('%s archive extracts to the skill files at the root, minus evals', (name) => {
    const archive = join(outDir, `${name}.tar.gz`);
    const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n');
    expect(entries.sort()).toEqual(sourceFiles(join(skillsDir, name)).sort());

    const extracted = mkdtempSync(join(tmpdir(), `${name}-`));
    execFileSync('tar', ['-xzf', archive, '-C', extracted]);
    for (const entry of entries) {
      expect(readFileSync(join(extracted, entry)).equals(readFileSync(join(skillsDir, name, entry)))).toBe(true);
    }
  });

  it('produces identical digests when rebuilt from the same content', () => {
    const rebuilt = buildWellKnown(skillsDir, mkdtempSync(join(tmpdir(), 'well-known-')));
    expect(rebuilt.skills.map((skill) => skill.digest)).toEqual(index.skills.map((skill) => skill.digest));
  });
});
