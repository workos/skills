import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadCases, loadSkillContent } from '../eval/runner.ts';

const skillDir = join(process.cwd(), 'plugins/workos/skills/workos');
const refsDir = join(skillDir, 'references');
const setupFile = 'workos-authkit-setup.md';
const frameworkRefs = readdirSync(refsDir).filter((name) => name.startsWith('workos-authkit-') && name !== setupFile);

describe('AuthKit setup routing', () => {
  it.each(frameworkRefs)('%s requires shared setup and completion checks', (name) => {
    const content = readFileSync(join(refsDir, name), 'utf8');
    const [setup, verification] = content.split(/## (?:Verification Checklist|Verification Checklists)/);
    expect(setup).toContain(`Read [${setupFile}](${setupFile})`);
    expect(setup).toContain('Sign-out URI');
    expect(setup).toContain('Initiate login URI');
    expect(verification).toContain(`completion checklist in [${setupFile}](${setupFile})`);
  });

  it('routes setup and migrations to the shared reference', () => {
    const router = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
    expect(router).toContain(`For setup and migrations, read \`references/${setupFile}\``);
    expect(router).toContain(`Read the corresponding reference file AND \`references/${setupFile}\``);
    expect(loadSkillContent('workos-authkit-setup')).toContain('## Completion checklist');
  });

  it('includes the default in the sign-out setter example and validates before saving', () => {
    const content = loadSkillContent('workos-authkit-setup');
    const example = content.match(/```bash\n([^`]*authkit logout-uris set[^`]*)```/)?.[1];
    expect(example).toBeDefined();
    const uris = [...example!.matchAll(/--uri "([^"]+)"/g)].map((match) => match[1]);
    const defaultUri = example!.match(/--default "([^"]+)"/)?.[1];
    expect(uris).toHaveLength(3);
    expect(uris).toContain(defaultUri);
    expect(example).toContain('--dry-run');
    expect(example).toContain('--environment-id');
  });

  it('loads runnable regression cases for setup, safe writes, fallback, and CLI auth', () => {
    const ids = [
      'authkit-application-url-setup',
      'authkit-preserve-sign-out-configuration',
      'authkit-initiate-login-manual-fallback',
      'management-dashboard-auth-and-json',
    ];
    const cases = loadCases(undefined, { caseIds: ids });
    expect(cases.map((item) => item.id)).toEqual(ids);
    for (const item of cases) {
      expect(loadSkillContent(item.skill)).toContain('If this file conflicts with fetched docs, follow the docs.');
      expect(item.expected.flowSteps.length).toBeGreaterThan(0);
    }
  });
});
