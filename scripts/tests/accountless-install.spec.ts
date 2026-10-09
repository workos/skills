import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const skillDir = join(root, 'plugins/workos/skills/workos');
const refsDir = join(skillDir, 'references');
const INSTALL = 'npx workos@latest install';
// Signals that an entry point leads with "get an API key" or "sign up in the dashboard".
const ACCOUNT_FIRST = [/WORKOS_API_KEY/, /API key/i, /dashboard/i, /sign up/i];

const read = (path: string) => readFileSync(join(root, path), 'utf8');
const readJson = (path: string) => JSON.parse(read(path));

function expectInstallLeads(text: string, label: string) {
  const installAt = text.indexOf(INSTALL);
  expect(installAt, `${label} mentions ${INSTALL}`).toBeGreaterThanOrEqual(0);
  for (const pattern of ACCOUNT_FIRST) {
    const match = pattern.exec(text);
    if (match) expect(match.index, `${label}: "${match[0]}" appears before ${INSTALL}`).toBeGreaterThan(installAt);
  }
}

function splitFrontmatter(content: string): { description: string; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  expect(match).not.toBeNull();
  const description = match![1].match(/^description: (.*)$/m)?.[1];
  expect(description).toBeDefined();
  return { description: description!, body: match![2] };
}

function firstSection(markdown: string, heading: RegExp): string {
  const start = markdown.search(heading);
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = markdown.slice(start);
  const next = rest.slice(1).search(/\n## /);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

describe('accountless install leads the entry instructions', () => {
  const { description, body } = splitFrontmatter(read('plugins/workos/skills/workos/SKILL.md'));

  it('leads the router skill description with the install command', () => {
    expectInstallLeads(description, 'SKILL.md description');
  });

  it('opens the router body with the install section and command', () => {
    const firstH2 = body.match(/^## .*$/m)?.[0];
    expect(firstH2).toMatch(/no account/i);
    const firstCodeBlock = body.match(/```[a-z]*\n([\s\S]*?)```/)?.[1];
    expect(firstCodeBlock).toContain(INSTALL);
    expect(firstCodeBlock).toContain('WORKOS_MODE=agent');
    expectInstallLeads(body, 'SKILL.md body');
  });

  it('documents claiming and failure handling in the opening section', () => {
    const opening = firstSection(body, /^## /m);
    expect(opening).toContain('profile claim');
    expect(opening).toMatch(/If the command fails/);
    expect(opening).toMatch(/Existing WorkOS account or production/);
  });

  it('routes AuthKit installation through the install before the references', () => {
    const rule4 = body.split('### 4. AuthKit Installation')[1].split('####')[0];
    expect(rule4.indexOf('**Start here**')).toBeGreaterThanOrEqual(0);
    expect(rule4.indexOf('**Start here**')).toBeLessThan(rule4.indexOf('workos-authkit-setup.md'));
  });

  it('puts the install command first in the shared setup credentials section', () => {
    const setup = readFileSync(join(refsDir, 'workos-authkit-setup.md'), 'utf8');
    const credentials = firstSection(setup, /^## Get credentials$/m);
    expect(setup.indexOf('## Get credentials')).toBeLessThan(setup.indexOf('## Configure three different URLs'));
    expect(credentials.match(/```[a-z]*\n([\s\S]*?)```/)?.[1]).toContain(INSTALL);
    expectInstallLeads(credentials, 'workos-authkit-setup.md Get credentials');
  });

  const frameworkRefs = readdirSync(refsDir).filter(
    (name) => name.startsWith('workos-authkit-') && name !== 'workos-authkit-setup.md',
  );

  it.each(frameworkRefs)('%s points missing credentials to the accountless install', (name) => {
    const content = readFileSync(join(refsDir, name), 'utf8');
    expect(content).toContain('(workos-authkit-setup.md#get-credentials)');
    const line = content.split('\n').find((text) => text.startsWith('**Missing credentials:**'));
    expect(line).toBeDefined();
    expectInstallLeads(line!, `${name} missing-credentials line`);
  });
});

describe('plugin manifests lead with the accountless install', () => {
  const descriptions: Array<[string, string]> = [
    ['claude plugin', readJson('plugins/workos/.claude-plugin/plugin.json').description],
    ['codex plugin', readJson('plugins/workos/.codex-plugin/plugin.json').description],
    ['codex long description', readJson('plugins/workos/.codex-plugin/plugin.json').interface.longDescription],
    ['cursor plugin', readJson('plugins/workos/.cursor-plugin/plugin.json').description],
    ['claude marketplace', readJson('.claude-plugin/marketplace.json').plugins[0].description],
    ['cursor marketplace', readJson('.cursor-plugin/marketplace.json').plugins[0].description],
  ];

  it.each(descriptions)('%s description starts with the no-account setup', (label, text) => {
    expect(text.startsWith('Set up WorkOS AuthKit with no account:'), label).toBe(true);
    expectInstallLeads(text, label);
  });

  it('keeps marketplace catalog entries in sync with the plugin manifests', () => {
    const byLabel = Object.fromEntries(descriptions);
    expect(byLabel['claude marketplace']).toBe(byLabel['claude plugin']);
    expect(byLabel['cursor marketplace']).toBe(byLabel['cursor plugin']);
    expect(byLabel['codex plugin']).toBe(byLabel['claude plugin']);
  });
});

describe('skill evals cover the accountless entry', () => {
  const { evals } = readJson('plugins/workos/skills/workos/evals/evals.json') as {
    evals: Array<{ id: number; name: string; assertions: Array<{ kind: string; needles: string[] }> }>;
  };

  it('has unique sequential ids', () => {
    expect(evals.map((item) => item.id)).toEqual(evals.map((_, index) => index));
  });

  it('expects the install command as the first step for a no-account setup', () => {
    const item = evals.find((entry) => entry.name === 'authkit-setup-starts-with-accountless-install');
    expect(item).toBeDefined();
    const [first] = item!.assertions;
    expect(first.kind).toBe('content_contains_any');
    expect(first.needles).toContain(INSTALL);
    expect(item!.assertions.some((assertion) => assertion.kind === 'content_contains_none')).toBe(true);
  });

  it('forbids account-first phrasing without rejecting the skill’s own claim-later text', () => {
    const item = evals.find((entry) => entry.name === 'authkit-setup-starts-with-accountless-install')!;
    const forbidden = item.assertions
      .filter((assertion) => assertion.kind === 'content_contains_none')
      .flatMap((assertion) => assertion.needles);
    const opening = firstSection(splitFrontmatter(read('plugins/workos/skills/workos/SKILL.md')).body, /^## /m);
    expect(opening).toMatch(/creates a free account/);
    for (const needle of forbidden) {
      expect(opening.toLowerCase(), needle).not.toContain(needle.toLowerCase());
    }
  });
});
