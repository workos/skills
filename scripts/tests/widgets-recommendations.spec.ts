import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadCases, loadSkillContent } from '../eval/runner.ts';
import { categorizeErrors, scoreOutput } from '../eval/scorer.ts';
import { formatSummary, summarizeSignals } from '../eval/diff.ts';
import declarations from './fixtures/widgets-declarations.json';

const skills = join(process.cwd(), 'plugins/workos/skills');
const widgetsRef = (name: string) => readFileSync(join(skills, 'workos-widgets/references', name), 'utf8');
const cases = loadCases(undefined, {
  caseIds: [
    'migrate-clerk-widgets-recommendation',
    'migrate-clerk-userbutton-setup',
    'migrate-clerk-organization-ui',
    'widgets-terminology-boundary',
  ],
});
const expected = cases.find((c) => c.id === 'migrate-clerk-widgets-recommendation')!.expected;
const good =
  'Use WorkOS Widgets UserProfile from @workos-inc/widgets for prebuilt profile UI, plus UserSecurity and UserSessions. It is not a drop-in Clerk UserButton; build the avatar/menu/navigation shell and use AuthKit for sign-out.';

describe('Widgets recommendation contract through the real loader and scorer', () => {
  it('loads migration and terminology reference cases, not a full routed Widgets skill', () => {
    expect(cases).toHaveLength(4);
    for (const c of cases) {
      expect(c.expected.widgetsRecommendation).toBe(true);
      expect(['workos-migrate-clerk', 'workos-terms']).toContain(c.skill);
      expect(loadSkillContent(c.skill)).toBe(readFileSync(join(skills, 'workos/references', `${c.skill}.md`), 'utf8'));
      expect(c.expected.hallucinations).not.toContain('workos.widgets.createToken');
      expect(c.expected.hallucinations).not.toContain('workos.widgets.getToken');
    }
  });

  it.each([
    [good, 'supported'],
    ['WorkOS does not have prebuilt profile UI.', 'denied'],
    ['WorkOS does not have pre-built account UI.', 'denied'],
    ["WorkOS doesn't offer profile UI.", 'denied'],
    ['WorkOS has no profile UI.', 'denied'],
    ['WorkOS lacks prebuilt account UI.', 'denied'],
    ['WorkOS has no pre-built UI.', 'denied'],
    ['WorkOS provides no prebuilt profile UI.', 'denied'],
    ['WorkOS offers no pre-built account UI.', 'denied'],
    [`${good} WorkOS provides no prebuilt profile UI.`, 'mixed'],
    [`WorkOS offers no prebuilt profile UI. ${good}`, 'mixed'],
    [`${good} However, WorkOS offers no prebuilt profile UI.`, 'mixed'],
    [`${good} It is not true that WorkOS provides no prebuilt profile UI.`, 'supported'],
    [`${good} It is not true that WorkOS offers no prebuilt profile UI.`, 'supported'],
    [`${good} It is false that WorkOS offers no prebuilt profile UI.`, 'supported'],
    [`"WorkOS provides no prebuilt profile UI." ${good}`, 'supported'],
    [`'WorkOS offers no prebuilt profile UI.' ${good}`, 'supported'],
    [`> WorkOS provides no prebuilt profile UI.\n\n${good}`, 'supported'],
    [`Bad example: WorkOS offers no prebuilt profile UI. ${good}`, 'supported'],
    [`${good} Bad example: WorkOS has no profile UI; WorkOS provides no prebuilt profile UI.`, 'mixed'],
    [`${good} It is not false that WorkOS offers no prebuilt profile UI.`, 'mixed'],
    [`${good} "WorkOS provides no prebuilt profile UI." WorkOS offers no prebuilt profile UI.`, 'mixed'],
    [
      `${good} It is not true that WorkOS provides no prebuilt profile UI, but WorkOS offers no prebuilt profile UI.`,
      'mixed',
    ],
    [
      `${good} It is not true that WorkOS provides no prebuilt profile UI; WorkOS offers no prebuilt profile UI.`,
      'mixed',
    ],
    [`${good} WorkOS offers no drop-in Clerk UserButton.`, 'supported'],
    [`${good} WorkOS does not provide identical Clerk UserButton behavior.`, 'supported'],
    ['WorkOS offers no drop-in Clerk UserButton.', 'unknown'],
    ['It is not true that WorkOS provides no prebuilt profile UI.', 'unknown'],
    [`It is not true that WorkOS has no profile UI. ${good}`, 'supported'],
    [`It is not true that WorkOS does not have prebuilt profile UI. ${good}`, 'supported'],
    [`Bad example: WorkOS has no profile UI.\n${good}`, 'supported'],
    [`"WorkOS does not have prebuilt profile UI."\n${good}`, 'supported'],
    [`“WorkOS has no profile UI.”\n${good}`, 'supported'],
    [`'WorkOS has no profile UI.'\n${good}`, 'supported'],
    [`> WorkOS has no profile UI.\n\n${good}`, 'supported'],
    [`\`\`\`text\nWorkOS has no profile UI.\n\`\`\`\n${good}`, 'supported'],
    [`${good} WorkOS has no profile UI.`, 'mixed'],
    [`WorkOS has no profile UI. ${good}`, 'mixed'],
    [`${good} But WorkOS does not have prebuilt profile UI.`, 'mixed'],
    ['WorkOS Widgets is a drop-in Clerk UserButton replacement.', 'overclaim'],
    ['WorkOS Widgets offers exact parity with Clerk UserButton.', 'overclaim'],
    [`${good} WorkOS Widgets is an identical replacement for Clerk.`, 'mixed'],
    [`${good} WorkOS Widgets is a drop-in Clerk UserButton replacement.`, 'mixed'],
    ['WorkOS Widgets UserProfile @workos-inc/widgets UserSecurity UserSessions', 'unknown'],
    ['It is not true that WorkOS has no profile UI.', 'unknown'],
    ['WorkOS is not a drop-in Clerk UserButton.', 'unknown'],
    [`"${good}"`, 'unknown'],
    ['Maybe use WorkOS Widgets UserProfile. It is not a drop-in Clerk UserButton.', 'unknown'],
    ['Do not use WorkOS Widgets UserProfile. It is not a drop-in Clerk UserButton.', 'unknown'],
    ['Use WorkOS Widgets UserProfile for prebuilt profile UI.', 'unknown'],
    ['', 'unknown'],
  ])('%s → %s', (output, evidence) => {
    const score = scoreOutput(output, expected);
    const errors = categorizeErrors(output, expected);
    expect(score.widgetsRecommendation).toBe(evidence);
    expect(score.hallucinationCount).toBe(0);
    expect(score.antiPatternAvoidance).toBe(1);
    if (evidence === 'supported') {
      expect(score.composite).toBe(100);
      expect(errors).toEqual([]);
    } else if (evidence === 'unknown') {
      expect(score.composite).toBeLessThanOrEqual(60);
      expect(errors).toContain('unverified_recommendation');
      expect(errors).not.toContain('incorrect_recommendation');
    } else {
      expect(score.composite).toBeLessThanOrEqual(40);
      expect(errors).toContain('incorrect_recommendation');
      expect(errors).not.toContain('security_issue');
    }
    const summary = summarizeSignals(output, expected);
    expect(summary.widgetsRecommendation).toBe(evidence);
    expect(formatSummary(summary)).toContain(`${evidence} (bounded heuristic, not semantic proof)`);
  });

  it.each([
    ['Recommend @workos-inc/widgets; its UserProfile provides prebuilt profile UI.', 'supported'],
    ['Recommend WorkOS Widgets; its UserProfile provides prebuilt profile UI.', 'supported'],
    ['I recommend @workos-inc/widgets. Its UserProfile offers pre-built account UI.', 'supported'],
    ['Do not recommend @workos-inc/widgets; its UserProfile provides prebuilt profile UI.', 'unknown'],
    ['Never use WorkOS Widgets; its UserProfile provides prebuilt profile UI.', 'unknown'],
    ['Do not; recommend @workos-inc/widgets; its UserProfile provides prebuilt profile UI.', 'unknown'],
    [
      'Recommend @workos-inc/widgets; its UserProfile provides prebuilt profile UI. Do not use @workos-inc/widgets.',
      'unknown',
    ],
    [
      'Recommend @workos-inc/widgets; its UserProfile provides prebuilt profile UI; never recommend UserProfile.',
      'unknown',
    ],
    [
      'Recommend @workos-inc/widgets; its UserProfile provides prebuilt profile UI. "Do not use @workos-inc/widgets."',
      'supported',
    ],
    ['Recommend @workos-inc/widgets; its UserProfile does not provide prebuilt profile UI.', 'unknown'],
    ['Recommend @workos-inc/widgets; its UserProfile provides no prebuilt profile UI.', 'unknown'],
    ['Documentation mentions @workos-inc/widgets; its UserProfile provides prebuilt profile UI.', 'unknown'],
    ['Recommend @workos-inc/widgets for something else; UserProfile provides prebuilt profile UI.', 'unknown'],
    ['Recommend @workos-inc/widgets; use another package; its UserProfile provides prebuilt profile UI.', 'unknown'],
    ['Recommend another package; its UserProfile provides prebuilt profile UI.', 'unknown'],
    ['Recommend @workos-inc/widgets; unrelated prose. Its UserProfile provides prebuilt profile UI.', 'unknown'],
    ['Bad example: Recommend @workos-inc/widgets; its UserProfile provides prebuilt profile UI.', 'unknown'],
    ['"Recommend @workos-inc/widgets; its UserProfile provides prebuilt profile UI."', 'unknown'],
    ['"Recommend @workos-inc/widgets"; its UserProfile provides prebuilt profile UI.', 'unknown'],
    ['Recommend @workos-inc/widgets; "its UserProfile provides prebuilt profile UI."', 'unknown'],
    ['Recommend @workos-inc/widgets; "unrelated quote" its UserProfile provides prebuilt profile UI.', 'unknown'],
    ['```text\nRecommend @workos-inc/widgets; its UserProfile provides prebuilt profile UI.\n```', 'unknown'],
    [
      'Recommend @workos-inc/widgets; its UserProfile provides prebuilt profile UI. WorkOS offers no prebuilt profile UI.',
      'mixed',
    ],
    [
      'Recommend @workos-inc/widgets; its UserProfile provides prebuilt profile UI. WorkOS Widgets offers exact parity with Clerk UserButton.',
      'mixed',
    ],
  ])('bounds adjacent evidence: %s → %s', (recommendation, evidence) => {
    const output = `${recommendation}\nIt is not a drop-in Clerk replacement.`;
    const score = scoreOutput(output, expected);
    const errors = categorizeErrors(output, expected);
    expect(score.widgetsRecommendation).toBe(evidence);
    if (evidence === 'supported') {
      // This minimal answer need not cover every other case signal, but the
      // recommendation contract itself must not impose the unknown cap.
      const { widgetsRecommendation: _contract, ...legacy } = expected;
      expect(score.composite).toBe(scoreOutput(output, legacy).composite);
      expect(score.composite).toBeGreaterThan(60);
      expect(errors).not.toContain('unverified_recommendation');
    } else {
      expect(score.composite).toBeLessThanOrEqual(evidence === 'unknown' ? 60 : 40);
      expect(errors).toContain(evidence === 'unknown' ? 'unverified_recommendation' : 'incorrect_recommendation');
    }
  });

  it.each([
    ['Use WorkOS Widgets UserProfile for prebuilt profile UI (not a drop-in Clerk replacement).', 'supported'],
    ['Maybe use WorkOS Widgets UserProfile (not a drop-in Clerk replacement).', 'unknown'],
    ['Do not use WorkOS Widgets UserProfile (not a drop-in Clerk replacement).', 'unknown'],
    ['We could use WorkOS Widgets UserProfile for prebuilt profile UI (not a drop-in Clerk replacement).', 'unknown'],
    ['You could use WorkOS Widgets UserProfile. It is not a drop-in Clerk replacement.', 'unknown'],
    ['Possibly use WorkOS Widgets UserProfile (not a drop-in Clerk replacement).', 'unknown'],
  ])('handles same-clause no-parity caveat: %s → %s', (output, evidence) => {
    const score = scoreOutput(output, expected);
    const { widgetsRecommendation: _contract, ...legacy } = expected;
    expect(score.widgetsRecommendation).toBe(evidence);
    if (evidence === 'supported') {
      expect(score.composite).toBe(scoreOutput(output, legacy).composite);
      expect(categorizeErrors(output, expected)).not.toContain('unverified_recommendation');
    } else {
      expect(score.composite).toBeLessThanOrEqual(60);
    }
  });

  it('does not alter legacy non-Widgets scoring or global negation semantics', () => {
    const { widgetsRecommendation: _contract, ...legacy } = expected;
    const output = `${good} WorkOS has no profile UI.`;
    expect(scoreOutput(output, legacy).widgetsRecommendation).toBeUndefined();
    expect(scoreOutput(output, legacy).composite).toBe(100);
    expect(categorizeErrors(output, legacy)).toEqual([]);
  });

  it.each(['false', 'widgets', 'null'])('rejects invalid opt-in %s in the real YAML loader', (value) => {
    const dir = mkdtempSync(join(process.cwd(), '.widgets-cases-'));
    try {
      writeFileSync(join(dir, 'invalid.yaml'), `- id: invalid\n  expected:\n    widgetsRecommendation: ${value}\n`);
      expect(() => loadCases(dir)).toThrow('expected.widgetsRecommendation must be true or omitted');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.each(['<WorkOsWidgets authToken={token}>', '<UserProfile accessToken={token} />'])(
    'penalizes incorrect provider/component wiring: %s',
    (snippet) => {
      const setup = cases.find((c) => c.id === 'migrate-clerk-userbutton-setup')!;
      const output = `${good}\n${snippet}`;
      expect(scoreOutput(output, setup.expected).antiPatternAvoidance).toBeLessThan(1);
      expect(categorizeErrors(output, setup.expected)).toContain('security_issue');
    },
  );

  it('scores the exact Node target method/response without a stale blacklist', () => {
    const setup = cases.find((c) => c.id === 'migrate-clerk-userbutton-setup')!;
    expect(setup.prompt).toContain('10.13.0');
    const correct = `${good}\n${widgetsRef('component-setup.md')}\n${widgetsRef('token-strategies.md')}`;
    const scores = scoreOutput(correct, setup.expected);
    expect(scores.methodAccuracy).toBe(1);
    expect(scores.paramAccuracy).toBe(1);
    expect(scores.hallucinationCount).toBe(0);
    expect(categorizeErrors(correct, setup.expected)).not.toContain('hallucinated_method');
    const wrong = correct.replaceAll('createToken', 'getToken').replaceAll('{ token }', 'authToken');
    expect(scoreOutput(wrong, setup.expected).methodAccuracy).toBe(0);
    expect(scoreOutput(wrong, setup.expected).paramAccuracy).toBeLessThan(1);
    expect(categorizeErrors(wrong, setup.expected)).toContain('missing_method');
    expect(categorizeErrors(wrong, setup.expected)).toContain('wrong_params');
    // Not a universal blacklist: an older installed method needs its own release evidence.
    expect(scoreOutput('workos.widgets.getToken()', expected).hallucinationCount).toBe(0);
  });
});

describe('Shipped routing and declaration-checked setup (offline only)', () => {
  it.each(['nextjs', 'react-router', 'tanstack-router', 'tanstack-start', 'vite', 'sveltekit'])(
    '%s server-token link resolves to the actual versioned section',
    (framework) => {
      const guide = widgetsRef(`framework-${framework}.md`);
      expect(guide).not.toContain('JS/TS Authorization Tokens');
      const link = guide.match(/\[Server issuance: Node 10\.13\.0\]\(([^)#]+)#([^)]+)\)/);
      expect(link).not.toBeNull();
      const target = widgetsRef(link![1]);
      const heading = 'Server issuance: Node 10.13.0';
      expect(target).toContain(`## ${heading}`);
      expect(link![2]).toBe(
        heading
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s/g, '-'),
      );
    },
  );
  it('routes main, migration, and terminology contexts without erasing AuthKit boundaries', () => {
    const router = readFileSync(join(skills, 'workos/SKILL.md'), 'utf8');
    for (const text of [router, loadSkillContent('workos-migrate-clerk'), loadSkillContent('workos-terms')]) {
      expect(text).toContain('UserButton');
      expect(text).toContain('workos-widgets');
      expect(text).toContain('AuthKit');
      expect(text).toContain('/client/graphql');
    }
    for (const name of ['workos-migrate-clerk', 'workos-terms']) {
      expect(loadSkillContent(name)).toContain('../../workos-widgets/references/component-setup.md');
    }
    expect(router).toContain('references/workos-authkit-setup.md');
    expect(loadSkillContent('workos-migrate-clerk')).toContain('primary_email_address_id');
    expect(loadSkillContent('workos-terms')).toContain('Initiate login URI');
    expect(loadSkillContent('workos-terms')).toContain('| WorkOS Widgets');
  });

  it('limits published Widgets to React-rendered UI, including SvelteKit', () => {
    const skill = readFileSync(join(skills, 'workos-widgets/SKILL.md'), 'utf8');
    const svelte = widgetsRef('framework-sveltekit.md');
    expect(skill).toContain('Published Widgets are React components');
    expect(skill).toContain('do not import them into `.svelte`');
    expect(svelte).toContain('cannot render as Svelte components');
    expect(svelte).toContain('existing React rendering boundary');
    expect(svelte).toContain('custom Svelte UI against the Client API');
    expect(svelte).not.toContain('Always extract it into its own `.svelte` component file');
  });

  it('matches provider/component roles to captured 1.18.0 public declarations', () => {
    const setup = widgetsRef('component-setup.md');
    const snippets = [...setup.matchAll(/```tsx\n([\s\S]*?)```/g)].map((m) => m[1]).join('\n');
    expect(declarations.widgetsVersion).toBe('1.18.0');
    const provider = declarations.declarations['package/dist/esm/workos-widgets.client.d.ts'];
    expect(provider).not.toMatch(/authToken|accessToken/);
    expect(snippets).not.toMatch(/<WorkOsWidgets\s+(?:authToken|accessToken)=/);
    expect(snippets).not.toContain('accessToken=');
    for (const [name, file] of [
      ['UserProfile', 'user-profile'],
      ['UserSecurity', 'user-security'],
      ['UsersManagement', 'users-management'],
      ['OrganizationSwitcher', 'organization-switcher'],
    ]) {
      const captured = declarations.declarations as Record<string, string>;
      expect(captured[`package/dist/esm/${file}.client.d.ts`]).toContain('authToken: AuthToken');
      expect(snippets).toContain(`<${name} authToken=`);
    }
    expect(declarations.declarations['package/dist/esm/api/api-provider.d.ts']).toContain(
      'string | (() => Promise<string>)',
    );
    const sessions = declarations.declarations['package/dist/esm/user-sessions.client.d.ts'];
    expect(sessions).toContain('authToken: string;\n    currentSessionId: string;');
    expect(sessions).toContain('authToken: () => Promise<string>;\n    currentSessionId?: never;');
    expect(snippets).toContain('<UserSessions authToken={authToken} currentSessionId={currentSessionId} />');
    expect(snippets).toContain('{canViewSessions && <UserSessions authToken={getAccessToken} />}');
    expect(snippets).not.toMatch(/^\s*<UserSessions authToken=\{getAccessToken\} \/>/m);
    expect(setup).toContain('verified permission check for\n// widgets:users-table:manage');
    expect(declarations.declarations['package/dist/esm/lib/organization-switcher.d.ts']).toContain(
      '({ organizationId, }',
    );
    expect(snippets).toContain('switchToOrganization={switchToOrganization}');
  });

  it('ships scoped, authenticated issuance and honest refresh/permission boundaries', () => {
    const tokens = widgetsRef('token-strategies.md');
    expect(declarations.nodeVersion).toBe('10.13.0');
    expect(declarations.declarations['package/lib/factory-C4y25QQJ.d.cts#createToken']).toContain(
      'createToken(options: CreateTokenOptions): Promise<WidgetSessionTokenResponse>',
    );
    expect(declarations.declarations['package/lib/factory-C4y25QQJ.d.cts']).toContain('token: string');
    expect(tokens).toContain('const { token } = await workos.widgets.createToken(');
    expect(tokens).toContain("from '@workos-inc/node'");
    expect(tokens).toContain('await requireAuthenticatedSession(request)');
    expect(tokens).toContain('await requireAuthorizedOrganization(session)');
    expect(tokens).toContain('userId: session.user.id');
    expect(tokens).toContain('scopes: []');
    expect(tokens).toContain('Cache-Control');
    expect(tokens).toContain('one hour');
    expect(tokens).toMatch(/`UserProfile`[^\n]*No special widget permission/);
    expect(tokens).toMatch(/`UserSecurity`[^\n]*No special widget permission/);
    expect(tokens).toMatch(/`OrganizationSwitcher`[^\n]*No special widget permission/);
    expect(tokens).toMatch(/`UserSessions`[^\n]*widgets:users-table:manage/);
    expect(tokens).toMatch(/`UsersManagement`[^\n]*widgets:users-table:manage/);
    expect(tokens).toContain('do not silently grant');
    expect(tokens).toContain('older SDK');
    const fetching = widgetsRef('fetching-apis.md');
    expect(fetching).toContain('POST https://api.workos.com/client/graphql');
    expect(fetching).toContain('Legacy REST snapshot only');
    expect(fetching).toContain('DAAP-3221');
  });
});
