import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// Agent hosts and apm (PyYAML) read SKILL.md frontmatter with strict YAML parsers. An unquoted
// description containing ": " made workos-widgets unloadable for them (#58), so parse strictly here.
const root = fileURLToPath(new URL('../..', import.meta.url));
const skillFiles = execFileSync('git', ['ls-files', '*SKILL.md'], { cwd: root, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

function parseFrontmatter(path: string): unknown {
  const content = readFileSync(join(root, path), 'utf8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error(`${path}: no frontmatter between leading --- lines`);
  try {
    return parse(match[1], { strict: true, uniqueKeys: true });
  } catch (error) {
    throw new Error(`${path}: frontmatter is not valid YAML: ${(error as Error).message}`);
  }
}

describe('SKILL.md frontmatter', () => {
  it('finds tracked SKILL.md files', () => {
    expect(skillFiles.length, 'git ls-files found no SKILL.md files').toBeGreaterThan(0);
  });

  it.each(skillFiles)('%s parses as strict YAML with a name and description', (path) => {
    const data = parseFrontmatter(path) as Record<string, unknown> | null;
    for (const key of ['name', 'description']) {
      const value = data?.[key];
      expect(
        typeof value === 'string' && value.trim().length > 0,
        `${path}: ${key} must be a non-empty string, got ${JSON.stringify(value)}`,
      ).toBe(true);
    }
  });
});
