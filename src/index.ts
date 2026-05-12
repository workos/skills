import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const pluginDir = join(packageRoot, 'plugins', 'workos');

/** Resolve path to a reference file by name (without .md extension) */
export function getReferencePath(name: string): string {
  return join(pluginDir, 'skills', 'workos', 'references', `${name}.md`);
}

/** Resolve path to the skills directory */
export function getSkillsDir(): string {
  return join(pluginDir, 'skills');
}

/** Resolve path to a specific skill's SKILL.md */
export function getSkillPath(skillName: string): string {
  return join(pluginDir, 'skills', skillName, 'SKILL.md');
}

/** Read a reference file's content by name (without .md extension) */
export async function getReference(name: string): Promise<string> {
  return readFile(getReferencePath(name), 'utf-8');
}

/** Read a skill's SKILL.md content by name */
export async function getSkill(skillName: string): Promise<string> {
  return readFile(getSkillPath(skillName), 'utf-8');
}
