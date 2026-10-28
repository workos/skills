import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { parse } from 'yaml';

/**
 * Builds the Agent Skills discovery files that workos.com serves at
 * /.well-known/agent-skills/: one .tar.gz per skill plus an index.json in the
 * v0.2.0 format (https://schemas.agentskills.io/discovery/0.2.0/schema.json).
 * The release workflow attaches them to each GitHub release.
 *
 * Every skill ships reference files, so each one is an archive rather than a
 * bare SKILL.md, which would install without them.
 */

const SCHEMA = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json';
const EXCLUDED_DIRS = new Set(['evals']);
// The discovery schema caps descriptions; the skills CLI silently drops longer entries.
const MAX_DESCRIPTION_LENGTH = 1024;

export interface IndexEntry {
  name: string;
  type: 'archive';
  description: string;
  url: string;
  digest: string;
}

export interface DiscoveryIndex {
  $schema: typeof SCHEMA;
  skills: IndexEntry[];
}

function listFiles(dir: string, root = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return EXCLUDED_DIRS.has(entry.name) && dir === root ? [] : listFiles(path, root);
    }
    return entry.isFile() ? [relative(root, path).split(sep).join('/')] : [];
  });
}

function tarHeader(path: string, size: number): Buffer {
  // ustar names are capped at 100 bytes without the prefix field; ours are far shorter.
  if (Buffer.byteLength(path) > 100) throw new Error(`Archive path too long for ustar: ${path}`);
  const header = Buffer.alloc(512);
  header.write(path, 0);
  header.write('0000644\0', 100); // mode
  header.write('0000000\0', 108); // uid
  header.write('0000000\0', 116); // gid
  header.write(`${size.toString(8).padStart(11, '0')}\0`, 124);
  header.write('00000000000\0', 136); // mtime fixed at the epoch so digests only change with content
  header.write('        ', 148); // checksum placeholder, counted as spaces
  header.write('0', 156); // regular file
  header.write('ustar\0', 257);
  header.write('00', 263);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148);
  return header;
}

/** A deterministic gzipped ustar archive with entries at the root (SKILL.md, not ./SKILL.md). */
export function createArchive(dir: string): Buffer {
  const blocks = listFiles(dir)
    .sort()
    .flatMap((path) => {
      const content = readFileSync(join(dir, path));
      const padding = Buffer.alloc((512 - (content.length % 512)) % 512);
      return [tarHeader(path, content.length), content, padding];
    });
  return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]));
}

function readFrontmatter(skillMd: string): Record<string, unknown> {
  const match = skillMd.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) throw new Error('SKILL.md has no frontmatter');
  return parse(match[1]) as Record<string, unknown>;
}

export function buildWellKnown(skillsDir: string, outDir: string): DiscoveryIndex {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const skills = readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((dirName): IndexEntry => {
      const dir = join(skillsDir, dirName);
      const { name, description } = readFrontmatter(readFileSync(join(dir, 'SKILL.md'), 'utf8'));
      if (name !== dirName) throw new Error(`${dirName}/SKILL.md declares name "${String(name)}"`);
      if (typeof description !== 'string' || !description || description.length > MAX_DESCRIPTION_LENGTH) {
        throw new Error(`${dirName}/SKILL.md needs a description of 1-${MAX_DESCRIPTION_LENGTH} characters`);
      }

      const archive = createArchive(dir);
      const file = `${dirName}.tar.gz`;
      writeFileSync(join(outDir, file), archive);
      return {
        name: dirName,
        type: 'archive',
        description,
        url: file,
        digest: `sha256:${createHash('sha256').update(archive).digest('hex')}`,
      };
    });

  const index: DiscoveryIndex = { $schema: SCHEMA, skills };
  writeFileSync(join(outDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  return index;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const outDir = process.argv[2] ?? 'dist-well-known';
  const index = buildWellKnown('plugins/workos/skills', outDir);
  console.log(`Wrote ${index.skills.length} skills to ${outDir}: ${index.skills.map((s) => s.name).join(', ')}`);
}
