import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const skillsDir = join(process.cwd(), 'plugins/workos/skills');
const releaseUrl = 'https://github.com/workos/skills/releases/download/v1.2.3';
const sourceFiles = (dir: string, prefix = ''): string[] =>
  readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((entry) => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (path === 'evals') return [];
    return entry.isDirectory() ? sourceFiles(dir, path) : [path];
  });

interface Index {
  skills: Array<{ name: string; url: string; digest: string }>;
}

// Run the script the way .github/workflows/well-known.yml does, so these tests cover what a release publishes.
function runReleaseBuild(): { outDir: string; index: Index } {
  const outDir = mkdtempSync(join(tmpdir(), 'well-known-'));
  execFileSync(join('node_modules', '.bin', 'tsx'), ['scripts/build-well-known.ts', outDir, releaseUrl]);
  return { outDir, index: JSON.parse(readFileSync(join(outDir, 'index.json'), 'utf8')) };
}

describe('build-well-known.ts release build', () => {
  const { outDir, index } = runReleaseBuild();

  it("lists every skill as a digest-pinned archive at its release's URL", () => {
    expect(index.skills.map((skill) => skill.name)).toEqual(['workos', 'workos-widgets']);
    for (const skill of index.skills) {
      expect(skill.url).toBe(`${releaseUrl}/${skill.name}.tar.gz`);
      const archive = readFileSync(join(outDir, `${skill.name}.tar.gz`));
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

  it('publishes the setup skill as SKILL.md', () => {
    expect(readFileSync(join(outDir, 'SKILL.md'), 'utf8')).toBe(readFileSync('well-known/setup/SKILL.md', 'utf8'));
  });

  it('produces identical digests when rebuilt from the same content', () => {
    const rebuilt = runReleaseBuild().index;
    expect(rebuilt.skills.map((skill) => skill.digest)).toEqual(index.skills.map((skill) => skill.digest));
  });
});
