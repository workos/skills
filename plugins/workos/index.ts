import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Resolve path to a reference file by name (without .md extension) */
export function getReferencePath(name: string): string {
  return join(__dirname, 'skills', 'workos', 'references', `${name}.md`);
}

/** Resolve path to the skills directory (contains workos/ and workos-widgets/) */
export function getSkillsDir(): string {
  return join(__dirname, 'skills');
}

/** Resolve path to a specific skill's SKILL.md */
export function getSkillPath(skillName: string): string {
  return join(__dirname, 'skills', skillName, 'SKILL.md');
}
