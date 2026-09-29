import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { loadCases, loadSkillContent } from '../eval/runner.ts';
import { categorizeErrors, scoreOutput } from '../eval/scorer.ts';

const react = loadSkillContent('workos-authkit-react');
const vanilla = loadSkillContent('workos-authkit-vanilla-js');
const router = loadSkillContent('workos-authkit-react-router');
const setup = loadSkillContent('workos-authkit-setup');
const routing = readFileSync(join(process.cwd(), 'plugins/workos/skills/workos/SKILL.md'), 'utf8');

function codeBlocks(content: string, language: string): string[] {
  return [...content.matchAll(new RegExp('```' + language + '\\n([\\s\\S]*?)```', 'g'))].map((match) => match[1]);
}

// Execute the shipped examples, not copies. SDK/rendering stubs capture option wiring only;
// these checks intentionally do not simulate SDK callback handling or a hosted app.
async function executeExample(code: string, env: Record<string, string> = {}) {
  const provider = Symbol('AuthKitProvider');
  const callbackLoader = Symbol('authLoader');
  const captured: { rendered?: { type: unknown; props: Record<string, unknown> }; clientArgs?: unknown[] } = {};
  const modules: Record<string, unknown> = {
    '@workos-inc/authkit-react': { AuthKitProvider: provider },
    '@workos-inc/authkit-js': {
      createClient: async (...args: unknown[]) => {
        captured.clientArgs = args;
        return {};
      },
    },
    '@workos-inc/authkit-react-router': { authLoader: () => callbackLoader },
    'react/jsx-runtime': { jsx: (type: unknown, props: Record<string, unknown>) => ({ type, props }) },
    'react-dom/client': {
      createRoot: () => ({
        render: (element: typeof captured.rendered) => {
          captured.rendered = element;
        },
      }),
    },
  };
  const compiled = ts.transpileModule(code.replaceAll('import.meta.env', 'fixtureEnv'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports: Record<string, unknown> = {};
  await runInNewContext(`(async () => { ${compiled} })()`, {
    require: (name: string) => {
      if (!(name in modules)) throw new Error(`Unexpected import: ${name}`);
      return modules[name];
    },
    exports,
    fixtureEnv: env,
    process: { env },
    document: { getElementById: () => ({}) },
    App: () => null,
  });
  return { ...captured, exports, provider, callbackLoader };
}

describe('shipped AuthKit option examples (offline wiring only)', () => {
  it('Vite SPA uses the client ID and leaves redirectUri unset for the documented origin default', async () => {
    const examples = codeBlocks(react, 'jsx');
    expect(examples).toHaveLength(2);
    const result = await executeExample(examples[0], {
      VITE_WORKOS_CLIENT_ID: 'client_vite',
      // An unused env variable must not silently become an SDK option.
      VITE_WORKOS_REDIRECT_URI: 'http://localhost:5173/unused',
    });
    expect(result.rendered?.type).toBe(result.provider);
    expect(result.rendered?.props.clientId).toBe('client_vite');
    expect(result.rendered?.props).not.toHaveProperty('redirectUri');
    expect(react).toContain('omit `redirectUri` and register the actual app origin');
  });

  it('CRA explicitly consumes its own prefix and passes the full custom destination to the provider', async () => {
    const result = await executeExample(codeBlocks(react, 'jsx')[1], {
      REACT_APP_WORKOS_CLIENT_ID: 'client_cra',
      REACT_APP_WORKOS_REDIRECT_URI: 'https://app.example.com/auth/complete',
      VITE_WORKOS_REDIRECT_URI: 'https://wrong.example.com',
    });
    expect(result.rendered?.type).toBe(result.provider);
    expect(result.rendered?.props).toMatchObject({
      clientId: 'client_cra',
      redirectUri: 'https://app.example.com/auth/complete',
    });
    expect(result.rendered?.props.children).toBeDefined();
  });

  it('vanilla examples await initialization, with default and explicitly configured redirects', async () => {
    const examples = codeBlocks(vanilla, 'javascript').filter((code) => code.includes('import '));
    expect(examples).toHaveLength(2);
    for (const code of examples) expect(code).toContain('await createClient(');
    expect((await executeExample(examples[0])).clientArgs).toEqual(['client_example']);
    expect((await executeExample(examples[1])).clientArgs).toEqual([
      'client_example',
      { redirectUri: 'https://app.example.com/auth/complete' },
    ]);
  });

  it('server callback example exports authLoader(), not the session-data loader', async () => {
    const examples = codeBlocks(router, 'ts');
    expect(examples).toHaveLength(1);
    const result = await executeExample(examples[0]);
    expect(result.exports.loader).toBe(result.callbackLoader);
    expect(router).toContain('Register this module in the project');
    expect(router).toContain('`configure({ redirectUri, ... })` values take priority');
  });
});

describe('shipped offline URL comparison aid', () => {
  const snippets = codeBlocks(setup, 'javascript');
  const compare = runInNewContext(`${snippets[0]}\ncompareAuthKitUrls`, { URL }) as (
    redirect: string,
    registered: string[],
    appUrl: string,
    origins: string[],
  ) => { redirectRegistered: boolean; appOrigin: string; corsOriginRegistered: boolean };

  // Both mounted and missing-destination fixtures intentionally have list agreement.
  // Only route/deployment/flow inspection can distinguish them, not this comparison.
  it.each([
    ['Vite origin default', 'http://localhost:5173', 'http://localhost:5173', 'http://localhost:5173', true, true],
    [
      'auth-prefixed app host',
      'https://auth.example.com',
      'https://auth.example.com',
      'https://auth.example.com',
      true,
      true,
    ],
    [
      'mounted custom destination',
      'https://app.example.com/auth/complete',
      'https://app.example.com/auth/complete',
      'https://app.example.com',
      true,
      true,
    ],
    [
      'missing destination despite registration',
      'https://app.example.com/missing',
      'https://app.example.com/missing',
      'https://app.example.com',
      true,
      true,
    ],
    [
      'custom redirect registration mismatch',
      'https://app.example.com/auth/complete',
      'https://app.example.com',
      'https://app.example.com',
      false,
      true,
    ],
    [
      'origin trailing-slash agreement',
      'http://localhost:5173/',
      'http://localhost:5173/',
      'http://localhost:5173',
      true,
      true,
    ],
    [
      'origin trailing-slash mismatch',
      'http://localhost:5173',
      'http://localhost:5173/',
      'http://localhost:5173',
      false,
      true,
    ],
    [
      'custom trailing-slash agreement',
      'https://app.example.com/auth/complete/',
      'https://app.example.com/auth/complete/',
      'https://app.example.com',
      true,
      true,
    ],
    [
      'custom trailing-slash mismatch',
      'https://app.example.com/auth/complete/',
      'https://app.example.com/auth/complete',
      'https://app.example.com',
      false,
      true,
    ],
    ['wrong localhost port', 'http://localhost:5173', 'http://localhost:3000', 'http://localhost:3000', false, false],
    [
      'CORS path is not an origin',
      'https://app.example.com/auth/complete',
      'https://app.example.com/auth/complete',
      'https://app.example.com/auth/complete',
      true,
      false,
    ],
  ] as const)('%s', (_name, effective, registered, cors, redirectRegistered, corsOriginRegistered) => {
    expect(snippets).toHaveLength(1);
    const result = compare(effective, ['https://existing.example.com', registered], effective, [cors]);
    expect(result).toEqual({ redirectRegistered, appOrigin: new URL(effective).origin, corsOriginRegistered });
    expect(result).not.toHaveProperty('valid');
  });

  it('derives CORS from the actual requesting app, not a redirect on another host', () => {
    expect(
      compare('https://return.example.com', ['https://return.example.com'], 'https://app.example.com/page', [
        'https://app.example.com',
      ]),
    ).toEqual({
      redirectRegistered: true,
      appOrigin: 'https://app.example.com',
      corsOriginRegistered: true,
    });
    expect(setup).toContain('only list agreement, not a valid integration');
    expect(setup).toContain('a 404, missing provider, or guard that navigates away');
    expect(setup).toContain('report this check as unverified');
  });
});

// These are the original setup requirements, retained as unordered presence signals.
const setupSignals = {
  'authkit-redirect-vite-origin': ['origin default', 'register redirect', 'allowed origins', 'separate login route'],
  'authkit-redirect-cra-custom': ['pass redirectUri', 'register full URL', 'CORS origin', 'verify destination'],
  'authkit-redirect-vanilla-custom': [
    'await createClient',
    'origin default',
    'explicit redirect option',
    'CORS origin',
    'inspect webpack configuration',
  ],
  'authkit-redirect-router-static': ['inspect deployment', 'client SDK', 'origin default', 'no server callback'],
  'authkit-redirect-router-server': [
    'programmatic configuration priority',
    'register callback route',
    'match registration',
    'server-only secrets',
  ],
  'authkit-redirect-router-ambiguous': ['inspect configuration', 'inspect runtime', 'ask for clarification'],
  'authkit-redirect-registration-vs-reachability': [
    'compare effective redirect',
    'verify destination',
    'separate CORS origin',
    'preserve existing entries',
    'confirm environment',
  ],
};

function permutations(items: string[]): string[][] {
  if (items.length === 0) return [[]];
  return items.flatMap((item, index) =>
    permutations(items.filter((_, other) => other !== index)).map((rest) => [item, ...rest]),
  );
}

describe.each(Object.entries(setupSignals))('unordered setup scoring: %s', (id, requirements) => {
  const { expected } = loadCases(undefined, { caseId: id })[0];
  const otherSignals = [
    ...expected.methods,
    ...expected.envVars,
    ...expected.imports,
    ...expected.params.filter((signal) => !requirements.includes(signal)),
  ];
  const output = (signals: string[]) => [...signals, ...otherSignals].join('\n\n');

  it('keeps every setup requirement without imposing a flow sequence', () => {
    expect(expected.params).toEqual(expect.arrayContaining(requirements));
    expect(expected.flowSteps).toEqual([]);
  });

  it('gives all permutations equal full credit through the real scorer', () => {
    const baseline = scoreOutput(output(requirements), expected);
    expect(baseline.composite).toBe(100);
    for (const order of permutations(requirements)) {
      expect(scoreOutput(output(order), expected), order.join(', ')).toEqual(baseline);
      expect(categorizeErrors(output(order), expected)).toEqual([]);
    }
  });

  it('penalizes each omitted requirement as missing presence, not wrong ordering', () => {
    for (const missing of requirements) {
      const incomplete = output(requirements.filter((signal) => signal !== missing));
      const score = scoreOutput(incomplete, expected);
      expect(score.paramAccuracy, missing).toBeCloseTo((expected.params.length - 1) / expected.params.length);
      expect(score.flowCorrectness).toBe(1);
      expect(score.composite).toBeLessThan(100);
      expect(categorizeErrors(incomplete, expected)).toEqual(['wrong_params']);
    }
  });
});

it('scores CORS-first and redirect-first setup explanations equally without losing missing-CORS coverage', () => {
  const { expected } = loadCases(undefined, { caseId: 'authkit-redirect-vite-origin' })[0];
  const paragraphs = [
    'Use the origin default at http://localhost:5173 with AuthKitProvider from @workos-inc/authkit-react and VITE_WORKOS_CLIENT_ID.',
    'Register redirect URLs for the confirmed environment.',
    'Configure allowed origins separately for browser requests.',
    'Provide a separate login route as the Initiate login URI and configure the Sign-out URI.',
  ];
  const forward = paragraphs.join('\n\n');
  const corsFirst = [paragraphs[2], paragraphs[1], paragraphs[3], paragraphs[0]].join('\n\n');
  expect(scoreOutput(forward, expected).composite).toBe(100);
  expect(scoreOutput(corsFirst, expected)).toEqual(scoreOutput(forward, expected));
  expect(scoreOutput(paragraphs.filter((_, index) => index !== 2).join('\n\n'), expected).composite).toBeLessThan(100);
});

it('retains causal flow penalties for the existing SSO case', () => {
  const { expected } = loadCases(undefined, { caseId: 'sso-node-basic' })[0];
  const otherSignals = [...expected.methods, ...expected.envVars, ...expected.imports, ...expected.params];
  const output = (steps: string[]) => [...steps, ...otherSignals].join('\n\n');
  const forward = scoreOutput(output(expected.flowSteps), expected);
  const reversedOutput = output([...expected.flowSteps].reverse());
  const reversed = scoreOutput(reversedOutput, expected);
  expect(forward.flowCorrectness).toBe(1);
  expect(forward.composite).toBe(100);
  expect(reversed.flowCorrectness).toBeCloseTo(0.6);
  expect(reversed.composite).toBe(92); // 40% ordering * the unchanged 20-point flow dimension.
  expect(categorizeErrors(reversedOutput, expected)).toContain('wrong_flow_order');
});

describe('documentation contracts, not model behavior or project classification', () => {
  it.each([
    ['declarative/library', '<BrowserRouter>', 'Use `@workos-inc/authkit-react`'],
    ['data/library', 'createBrowserRouter', 'Use React client guidance'],
    ['framework SPA', 'ssr: false', 'Framework SPA mode: use React client guidance'],
    ['framework server', 'deployed request-time server', 'server callback-loader setup below'],
    ['ambiguous/mixed', 'Next.js config plus a React Router dependency', 'ask which runtime/deployment is intended'],
  ])('keeps the %s evidence and action together in the shipped mode table', (_name, evidence, action) => {
    const row = router.split('\n').find((line) => line.startsWith('|') && line.includes(evidence));
    expect(row).toBeDefined();
    expect(row).toContain(action);
  });

  it('router requires execution evidence and clarification rather than dependency precedence', () => {
    expect(routing).toContain('Dependency names alone do not select an SDK');
    expect(routing).toContain('a browser loader does not establish a server');
    expect(routing).toContain('Client-only React, including React Router library/data/declarative use');
    expect(routing).toContain('ASK the user which runtime is intended');
    expect(routing).not.toContain('React Router wins');
    expect(react).not.toContain('WARN: Server framework detected');
  });

  it('does not infer CRA/webpack env behavior from absent config or expose server secrets', () => {
    expect(react).toContain('A missing `vite.config.ts` does not imply CRA');
    expect(react).toContain('No universal prefix');
    expect(react).toContain('Never put `WORKOS_API_KEY` or `WORKOS_COOKIE_PASSWORD` in a client bundle');
    expect(vanilla).toContain('`REACT_APP_` is a CRA convention, not a webpack default');
    expect(vanilla).toContain('Static/CDN scripts have no automatic');
    expect(router).toContain('These server requirements do not apply to client-only React Router apps');
  });

  it('preserves independent application URLs, safe registration, and qualified verification', () => {
    for (const content of [react, vanilla, router, setup, loadSkillContent('workos-authkit-base')]) {
      expect(content).toContain('Sign-out URI');
      expect(content).toContain('Initiate login URI');
      expect(content).not.toMatch(/redirect URI must be the app origin, no path|no callback path at all/);
    }
    for (const rule of [
      'confirmed `--environment-id`',
      'Preserve the existing default',
      'replace the full list',
      'Run it with `--dry-run` first',
      'Read the settings back using the same environment ID',
      'Report this as a remaining setup step until it is verified',
      'This is not the callback URL',
    ])
      expect(setup).toContain(rule);
    expect(react).toContain('separate SDK-backed `/login` route');
    expect(loadSkillContent('workos-management')).toContain('never a full callback path');
  });

  it('loads future regression eval cases with existing schemas and resolvable skills', () => {
    const cases = loadCases().filter((item) => item.id.startsWith('authkit-redirect-'));
    expect(cases.map((item) => item.id)).toEqual([
      'authkit-redirect-vite-origin',
      'authkit-redirect-cra-custom',
      'authkit-redirect-vanilla-custom',
      'authkit-redirect-router-static',
      'authkit-redirect-router-server',
      'authkit-redirect-router-ambiguous',
      'authkit-redirect-registration-vs-reachability',
    ]);
    for (const item of cases) {
      expect(loadSkillContent(item.skill)).toContain('If this file conflicts with fetched docs, follow the docs.');
      expect(item.expected.params.length).toBeGreaterThan(0);
      expect(item.expected.flowSteps).toEqual([]);
      for (const patterns of Object.values(item.expected)) {
        expect(Array.isArray(patterns)).toBe(true);
        for (const pattern of patterns) expect(typeof pattern).toBe('string');
      }
    }
  });
});
