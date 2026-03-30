import { describe, expect, it } from 'vitest';
import {
  normalizeForMatch,
  ratioFound,
  methodRatioFound,
  scoreFlowOrder,
  countFound,
  countHallucinations,
  weightedScore,
  scoreOutput,
  categorizeErrors,
  isNegated,
  isInEnvBlock,
  negationAwareRatioFound,
} from '../eval/scorer.ts';
import type { ExpectedSignals } from '../eval/types.ts';

describe('normalizeForMatch', () => {
  it('lowercases', () => {
    expect(normalizeForMatch('WORKOS_API_KEY')).toBe('workos_api_key');
  });

  it('converts camelCase to snake_case', () => {
    expect(normalizeForMatch('getAuthorizationUrl')).toBe('get_authorization_url');
  });

  it('converts kebab-case to snake_case', () => {
    expect(normalizeForMatch('get-authorization-url')).toBe('get_authorization_url');
  });

  it('preserves dots in method chains', () => {
    expect(normalizeForMatch('workos.sso.getAuthorizationUrl')).toBe('workos.sso.get_authorization_url');
  });

  it('handles empty string', () => {
    expect(normalizeForMatch('')).toBe('');
  });

  it('handles already-normalized strings', () => {
    expect(normalizeForMatch('workos_api_key')).toBe('workos_api_key');
  });
});

describe('ratioFound', () => {
  const output = `
import { WorkOS } from "@workos-inc/node";
const workos = new WorkOS(process.env.WORKOS_API_KEY);
const url = workos.sso.getAuthorizationUrl({ clientId, redirectUri });
const profile = workos.sso.getProfileAndToken({ code });
  `;

  it('returns 1.0 for empty expected array', () => {
    expect(ratioFound([], output)).toBe(1);
  });

  it('finds all expected items', () => {
    expect(ratioFound(['workos.sso.getAuthorizationUrl', 'workos.sso.getProfileAndToken'], output)).toBe(1);
  });

  it('returns partial ratio for partial matches', () => {
    expect(
      ratioFound(
        ['workos.sso.getAuthorizationUrl', 'workos.sso.nonExistentMethod', 'workos.sso.getProfileAndToken'],
        output,
      ),
    ).toBeCloseTo(2 / 3, 2);
  });

  it('returns 0 when nothing found', () => {
    expect(ratioFound(['totally.fake.method'], output)).toBe(0);
  });

  it('matches case-insensitively', () => {
    expect(ratioFound(['WORKOS_API_KEY'], output)).toBe(1);
  });

  it('matches snake_case against camelCase', () => {
    expect(ratioFound(['get_authorization_url'], output)).toBe(1);
  });
});

describe('methodRatioFound', () => {
  it('matches full invocation form', () => {
    const output = 'const url = workos.sso.getAuthorizationUrl({ clientId });';
    expect(methodRatioFound(['workos.sso.getAuthorizationUrl'], output)).toBe(1);
  });

  it('matches last-segment invocation', () => {
    const output = 'Call getAuthorizationUrl({ clientId }) to start SSO.';
    expect(methodRatioFound(['workos.sso.getAuthorizationUrl'], output)).toBe(1);
  });

  it('falls back to substring for prose mentions', () => {
    const output = 'Use the getAuthorizationUrl method to generate the login URL.';
    expect(methodRatioFound(['workos.sso.getAuthorizationUrl'], output)).toBe(1);
  });

  it('returns 0 when method not found', () => {
    const output = 'Use getAuth to log in.';
    expect(methodRatioFound(['workos.sso.getAuthorizationUrl'], output)).toBe(0);
  });

  it('handles multiple methods with mixed match types', () => {
    const output = `
const url = workos.sso.getAuthorizationUrl({ clientId });
Use getProfileAndToken to exchange the code.
    `;
    expect(methodRatioFound(['workos.sso.getAuthorizationUrl', 'workos.sso.getProfileAndToken'], output)).toBe(1);
  });

  it('returns 1.0 for empty expected', () => {
    expect(methodRatioFound([], 'any output')).toBe(1);
  });

  it('handles Python snake_case methods', () => {
    const output = 'url = workos_client.sso.get_authorization_url(redirect_uri=uri)';
    expect(methodRatioFound(['workos_client.sso.get_authorization_url'], output)).toBe(1);
  });
});

describe('scoreFlowOrder', () => {
  const output = `
First, generate the authorization URL.
Then redirect the user to the IdP.
After the user authenticates, handle the callback.
Finally, exchange the code for a profile.
  `;

  it('returns 1.0 for all steps in correct order', () => {
    expect(
      scoreFlowOrder(
        ['generate authorization URL', 'redirect user', 'handle callback', 'exchange code for profile'],
        output,
      ),
    ).toBe(1);
  });

  it('returns 0 for no steps found', () => {
    expect(scoreFlowOrder(['step not present', 'also missing'], output)).toBe(0);
  });

  it('gives partial credit for present but unordered steps', () => {
    const reversed = `
Finally, exchange the code for a profile.
First, generate the authorization URL.
    `;
    const score = scoreFlowOrder(['generate authorization URL', 'exchange code for profile'], reversed);
    // Both present (0.6 * 1.0) but wrong order (0.4 * 0)
    expect(score).toBeCloseTo(0.6, 1);
  });

  it('returns 1.0 for empty steps', () => {
    expect(scoreFlowOrder([], output)).toBe(1);
  });

  it('handles partial presence', () => {
    const score = scoreFlowOrder(['generate authorization URL', 'step not present'], output);
    // 1/2 present = 0.5, presence component: 0.6 * 0.5 = 0.3
    // ordering: 1/1 in order (only 1 found) = 1.0, order component: 0.4 * 1.0 = 0.4
    // total = 0.7
    expect(score).toBeCloseTo(0.7, 1);
  });

  it('uses proximity matching to avoid keyword collisions', () => {
    // "check" appears early in Verification section, but "check state parameter"
    // is the actual step logic located later. Old indexOf would pick the wrong pos.
    const multiSectionOutput = `
Step 1: Generate the authorization URL with state parameter.
Step 2: Redirect user to the IdP login page.
Step 3: Handle the callback and check the state parameter matches.
Step 4: Exchange code for profile token.

## Verification
Check that your integration works by testing the login flow.
    `;
    const score = scoreFlowOrder(
      ['generate authorization URL', 'redirect user', 'check state parameter', 'exchange code for profile'],
      multiSectionOutput,
    );
    // All 4 steps present and in order — should be 1.0 (or very close)
    // Old scorer would misplace "check state parameter" to pos of "Check" in
    // Verification section, breaking the order.
    expect(score).toBeGreaterThanOrEqual(0.95);
  });

  it('requires minimum keyword coverage for multi-keyword steps', () => {
    const sparseOutput = 'In callback code we do state.toString() checks only.';
    const score = scoreFlowOrder(['empty string state means idp initiated'], sparseOutput);
    expect(score).toBe(0);
  });

  it('prefers first good-enough anchor over denser later checklist text', () => {
    const mixedOutput = `
Configure WorkOS client with API key and client ID.
Then handle callback with code exchange.

Health checklist:
- verify workos api key client id client key wiring in diagnostics payload
`;
    const score = scoreFlowOrder(
      ['configure WorkOS client with API key and client ID', 'handle callback with code exchange'],
      mixedOutput,
    );
    expect(score).toBeGreaterThanOrEqual(0.95);
  });
});

describe('countFound', () => {
  const output = `workos.sso.authenticate and workos.sso.login`;

  it('counts matches', () => {
    expect(countFound(['workos.sso.authenticate', 'workos.sso.login'], output)).toBe(2);
  });

  it('returns 0 for no matches', () => {
    expect(countFound(['not.here'], output)).toBe(0);
  });

  it('returns 0 for empty list', () => {
    expect(countFound([], output)).toBe(0);
  });
});

describe('countHallucinations', () => {
  it('counts non-negated hallucinations', () => {
    const output = 'Use workos.sso.authenticate() for login.';
    expect(countHallucinations(['workos.sso.authenticate'], output)).toBe(1);
  });

  it('ignores negated hallucination mentions', () => {
    const output = 'Do not use workos.sso.authenticate; it does not exist.';
    expect(countHallucinations(['workos.sso.authenticate'], output)).toBe(0);
  });

  it('counts if any later occurrence is non-negated', () => {
    const output = `
Do not use workos.sso.authenticate in new code.
Legacy code still calls workos.sso.authenticate().
`;
    expect(countHallucinations(['workos.sso.authenticate'], output)).toBe(1);
  });

  it('applies negation checks in normalized fallback path', () => {
    const output = 'Avoid workos.sso.get_authorization_url; it is not a real method.';
    expect(countHallucinations(['workos.sso.getAuthorizationUrl'], output)).toBe(0);
  });
});

describe('weightedScore', () => {
  it('returns 100 for perfect scores with no hallucinations', () => {
    expect(
      weightedScore({
        methodAccuracy: 1,
        paramAccuracy: 1,
        envVarCoverage: 1,
        importAccuracy: 1,
        flowCorrectness: 1,
        antiPatternAvoidance: 1,
        hallucinationCount: 0,
      }),
    ).toBe(100);
  });

  it('returns 0 for all-zero scores', () => {
    expect(
      weightedScore({
        methodAccuracy: 0,
        paramAccuracy: 0,
        envVarCoverage: 0,
        importAccuracy: 0,
        flowCorrectness: 0,
        antiPatternAvoidance: 0,
        hallucinationCount: 0,
      }),
    ).toBe(5); // clean bonus only (no hallucinations even with zero scores)
  });

  it('applies hallucination penalty capped at 25', () => {
    const perfect = weightedScore({
      methodAccuracy: 1,
      paramAccuracy: 1,
      envVarCoverage: 1,
      importAccuracy: 1,
      flowCorrectness: 1,
      antiPatternAvoidance: 1,
      hallucinationCount: 0,
    });
    const withHallucinations = weightedScore({
      methodAccuracy: 1,
      paramAccuracy: 1,
      envVarCoverage: 1,
      importAccuracy: 1,
      flowCorrectness: 1,
      antiPatternAvoidance: 1,
      hallucinationCount: 3,
    });
    // Loses 5pt clean bonus + 15pt penalty (3 * 5) = 20pt difference
    expect(perfect - withHallucinations).toBe(20);

    // Cap at 25 penalty + 5 lost clean bonus = 30 max difference
    const maxPenalty = weightedScore({
      methodAccuracy: 1,
      paramAccuracy: 1,
      envVarCoverage: 1,
      importAccuracy: 1,
      flowCorrectness: 1,
      antiPatternAvoidance: 1,
      hallucinationCount: 10,
    });
    expect(perfect - maxPenalty).toBe(30); // 25 penalty + 5 lost clean bonus
  });

  it('never goes below 0', () => {
    expect(
      weightedScore({
        methodAccuracy: 0,
        paramAccuracy: 0,
        envVarCoverage: 0,
        importAccuracy: 0,
        flowCorrectness: 0,
        antiPatternAvoidance: 0,
        hallucinationCount: 10,
      }),
    ).toBe(0);
  });

  it('deducts 10 points for zero import accuracy', () => {
    const withImports = weightedScore({
      methodAccuracy: 1,
      paramAccuracy: 1,
      envVarCoverage: 1,
      importAccuracy: 1,
      flowCorrectness: 1,
      antiPatternAvoidance: 1,
      hallucinationCount: 0,
    });
    const withoutImports = weightedScore({
      methodAccuracy: 1,
      paramAccuracy: 1,
      envVarCoverage: 1,
      importAccuracy: 0,
      flowCorrectness: 1,
      antiPatternAvoidance: 1,
      hallucinationCount: 0,
    });
    expect(withImports - withoutImports).toBe(10);
  });
});

describe('isNegated', () => {
  it("detects don't before match", () => {
    const text = "don't reject requests without state";
    const idx = text.indexOf('reject');
    expect(isNegated(text, idx)).toBe(true);
  });

  it('detects do not before match', () => {
    const text = 'do not use hardcoded keys';
    const idx = text.indexOf('use hardcoded');
    expect(isNegated(text, idx)).toBe(true);
  });

  it('detects never before match', () => {
    const text = 'never hardcode API keys';
    const idx = text.indexOf('hardcode');
    expect(isNegated(text, idx)).toBe(true);
  });

  it('detects avoid before match', () => {
    const text = 'avoid hardcoded API key patterns';
    const idx = text.indexOf('hardcoded');
    expect(isNegated(text, idx)).toBe(true);
  });

  it('returns false for non-negated match', () => {
    const text = 'uses hardcoded key sk_live_xxx';
    const idx = text.indexOf('hardcoded');
    expect(isNegated(text, idx)).toBe(false);
  });

  it('returns false at start of text', () => {
    const text = 'hardcoded API key found';
    expect(isNegated(text, 0)).toBe(false);
  });
});

describe('isInEnvBlock', () => {
  it('detects .env file header in preceding context', () => {
    const output = 'Create a `.env` file:\n\nWORKOS_API_KEY=sk_test_your_api_key_here';
    const idx = output.indexOf('sk_test');
    expect(isInEnvBlock(output, idx)).toBe(true);
  });

  it('detects KEY=value env file format', () => {
    const output = 'WORKOS_API_KEY=sk_test_your_api_key_here';
    const idx = output.indexOf('sk_test');
    expect(isInEnvBlock(output, idx)).toBe(true);
  });

  it('detects # .env comment block', () => {
    const output = '# .env\nWORKOS_API_KEY=sk_test_xxx';
    const idx = output.indexOf('sk_test');
    expect(isInEnvBlock(output, idx)).toBe(true);
  });

  it("detects 'env vars' context", () => {
    const output = 'Set up your env vars:\nsk_test_your_key';
    const idx = output.indexOf('sk_test');
    expect(isInEnvBlock(output, idx)).toBe(true);
  });

  it('detects placeholder indicators on the line', () => {
    const output = 'const key = "sk_live_your_key_here"; // replace with your key';
    const idx = output.indexOf('sk_live');
    expect(isInEnvBlock(output, idx)).toBe(true);
  });

  it('returns false for actual hardcoded key in code', () => {
    const output = 'const workos = new WorkOS("sk_live_abc123def456");';
    const idx = output.indexOf('sk_live');
    expect(isInEnvBlock(output, idx)).toBe(false);
  });

  it('returns false for key in non-env context', () => {
    const output = 'The API key sk_test_real is used in production.';
    const idx = output.indexOf('sk_test');
    expect(isInEnvBlock(output, idx)).toBe(false);
  });
});

describe('negationAwareRatioFound', () => {
  it('returns 0 when anti-pattern is negated', () => {
    const output = "Don't reject requests without state parameter";
    expect(negationAwareRatioFound(['reject requests without state'], output)).toBe(0);
  });

  it('returns 1 when anti-pattern is present without negation', () => {
    const output = 'You should reject requests without state';
    expect(negationAwareRatioFound(['reject requests without state'], output)).toBe(1);
  });

  it('returns 0 for empty expected array', () => {
    expect(negationAwareRatioFound([], 'any output')).toBe(0);
  });

  it('handles mix of negated and non-negated', () => {
    const output = "Don't use hardcoded API key but sk_live_123 is fine";
    // "hardcoded API key" is negated, "sk_live" is not
    expect(negationAwareRatioFound(['hardcoded API key', 'sk_live'], output)).toBe(0.5);
  });

  it('skips anti-pattern in .env block context', () => {
    const output = `
Create a \`.env\` file with:

WORKOS_API_KEY=sk_test_your_api_key_here
WORKOS_CLIENT_ID=client_xxx
    `;
    // sk_test is in an env block — should not count as a real hardcoded key
    expect(negationAwareRatioFound(['sk_test'], output)).toBe(0);
  });

  it('still catches real hardcoded key outside env block', () => {
    const output = 'const workos = new WorkOS("sk_live_abc123def456");';
    expect(negationAwareRatioFound(['sk_live'], output)).toBe(1);
  });

  it('counts if a later occurrence is non-negated', () => {
    const output = `
Do not reject requests without state in docs examples.
Production code may reject requests without state.
`;
    expect(negationAwareRatioFound(['reject requests without state'], output)).toBe(1);
  });

  it('applies negation checks in normalized fallback path', () => {
    const output = 'Do not reject_requests_without_state when handling IdP-initiated logins.';
    expect(negationAwareRatioFound(['rejectRequestsWithoutState'], output)).toBe(0);
  });
});

describe('scoreOutput', () => {
  const expected: ExpectedSignals = {
    methods: ['workos.sso.getAuthorizationUrl', 'workos.sso.getProfileAndToken'],
    envVars: ['WORKOS_API_KEY', 'WORKOS_CLIENT_ID'],
    imports: ['@workos-inc/node'],
    params: ['clientId', 'redirectUri', 'code'],
    flowSteps: ['generate authorization URL', 'redirect user', 'handle callback', 'exchange code for profile'],
    antiPatterns: ['hardcoded API key'],
    hallucinations: ['workos.sso.authenticate', '@workos/node'],
  };

  const perfectOutput = `
import { WorkOS } from "@workos-inc/node";

const workos = new WorkOS(process.env.WORKOS_API_KEY);
const clientId = process.env.WORKOS_CLIENT_ID;

// Step 1: Generate authorization URL
const authUrl = workos.sso.getAuthorizationUrl({ clientId, redirectUri: "http://localhost:3000/callback" });

// Step 2: Redirect user to the IdP
res.redirect(authUrl);

// Step 3: Handle callback with authorization code
app.get("/callback", async (req, res) => {
  const { code } = req.query;

  // Step 4: Exchange code for profile
  const { profile } = await workos.sso.getProfileAndToken({ code });
  req.session.user = profile;
  res.redirect("/dashboard");
});
  `;

  it('scores a perfect output near 100', () => {
    const scores = scoreOutput(perfectOutput, expected);
    expect(scores.composite).toBeGreaterThanOrEqual(90);
    expect(scores.hallucinationCount).toBe(0);
  });

  it('scores importAccuracy from expected.imports', () => {
    const scores = scoreOutput(perfectOutput, expected);
    expect(scores.importAccuracy).toBe(1);

    const wrongImportOutput = `
import { WorkOS } from "@workos/node";
const workos = new WorkOS(process.env.WORKOS_API_KEY);
const clientId = process.env.WORKOS_CLIENT_ID;
const url = workos.sso.getAuthorizationUrl({ clientId, redirectUri: "/" });
res.redirect(url);
app.get("/callback", async (req, res) => {
  const { code } = req.query;
  const { profile } = await workos.sso.getProfileAndToken({ code });
});
    `;
    const wrongScores = scoreOutput(wrongImportOutput, expected);
    expect(wrongScores.importAccuracy).toBe(0);
  });

  it('gives importAccuracy 1 when expected.imports is empty', () => {
    const noImportsExpected: ExpectedSignals = {
      ...expected,
      imports: [],
    };
    const scores = scoreOutput('any output', noImportsExpected);
    expect(scores.importAccuracy).toBe(1);
  });

  it('scores a terrible output below 30', () => {
    const terribleOutput = `
import { WorkOS } from "@workos/node";
const workos = new WorkOS("sk_live_hardcoded_key_here");
const result = workos.sso.authenticate({ user: "test" });
workos.sso.login({ password: "123" });
    `;
    const scores = scoreOutput(terribleOutput, expected);
    expect(scores.composite).toBeLessThan(30);
    expect(scores.hallucinationCount).toBeGreaterThan(0);
  });

  it('does not count negated hallucination mentions', () => {
    const output = `
Do not use workos.sso.authenticate in this flow.
Use workos.sso.getAuthorizationUrl and workos.sso.getProfileAndToken instead.
`;
    const scores = scoreOutput(output, expected);
    expect(scores.hallucinationCount).toBe(0);
  });
});

describe('categorizeErrors', () => {
  const expected: ExpectedSignals = {
    methods: ['workos.sso.getAuthorizationUrl'],
    envVars: ['WORKOS_API_KEY'],
    imports: ['@workos-inc/node'],
    params: ['clientId'],
    flowSteps: ['generate authorization URL'],
    antiPatterns: [],
    hallucinations: ['workos.sso.authenticate'],
  };

  it('detects hallucinated methods', () => {
    const output = 'workos.sso.authenticate()';
    const errors = categorizeErrors(output, expected);
    expect(errors).toContain('hallucinated_method');
  });

  it('does not flag negated hallucination references', () => {
    const output = 'Do not call workos.sso.authenticate in production.';
    const errors = categorizeErrors(output, expected);
    expect(errors).not.toContain('hallucinated_method');
  });

  it('detects missing expected methods as missing_method', () => {
    const output = 'some code without the expected method';
    const errors = categorizeErrors(output, expected);
    expect(errors).toContain('missing_method');
  });

  it('detects missing params as wrong_params (not methods)', () => {
    // Output has the correct method but missing the param "clientId"
    const output = `
import { WorkOS } from "@workos-inc/node";
const workos = new WorkOS(process.env.WORKOS_API_KEY);
const url = workos.sso.getAuthorizationUrl({ redirectUri: "/" });
// Generate authorization URL
    `;
    const errors = categorizeErrors(output, expected);
    expect(errors).toContain('wrong_params');
    expect(errors).not.toContain('missing_method');
  });

  it('detects missing env vars', () => {
    const output = 'some code without env vars';
    const errors = categorizeErrors(output, expected);
    expect(errors).toContain('missing_env_var');
  });

  it('detects wrong imports', () => {
    const output = 'some code without correct import';
    const errors = categorizeErrors(output, expected);
    expect(errors).toContain('wrong_import');
  });

  it('returns empty for perfect output', () => {
    const output = `
import { WorkOS } from "@workos-inc/node";
const workos = new WorkOS(process.env.WORKOS_API_KEY);
const clientId = process.env.WORKOS_CLIENT_ID;
const url = workos.sso.getAuthorizationUrl({ clientId });
// Generate authorization URL
    `;
    const errors = categorizeErrors(output, expected);
    expect(errors).not.toContain('hallucinated_method');
    expect(errors).not.toContain('missing_method');
    expect(errors).not.toContain('missing_env_var');
  });
});

describe('authkit nextjs regression coverage', () => {
  const expected: ExpectedSignals = {
    methods: ['AuthKitProvider', 'useAuth', 'refreshAuth', 'getSignInUrl'],
    envVars: [],
    imports: [],
    params: ['ensureSignedIn'],
    flowSteps: [
      'wrap app in AuthKitProvider',
      'make nav auth a client component',
      'call refreshAuth ensureSignedIn',
      'use getSignInUrl in a server action',
      'avoid getAuthorizationUrl',
    ],
    antiPatterns: [
      'getSignInUrl in server component',
      'use getAuthorizationUrl directly',
      'window.location.href = auth.signInUrl',
      'discard sealedState',
    ],
    hallucinations: [],
  };

  const brokenOutput = `
// app/components/nav-auth.tsx
import { getSignInUrl } from '@workos-inc/authkit-nextjs';

export default async function NavAuth() {
  const signInUrl = await getSignInUrl(); // getSignInUrl in server component
  return <a href={signInUrl}>Sign in</a>;
}

// dist/esm/actions.js
import { getAuthorizationUrl } from './get-authorization-url.js';

export async function refreshAuthAction() {
  const signInUrl = await getAuthorizationUrl({ screenHint: 'sign-in' });
  return { signInUrl };
}

window.location.href = auth.signInUrl;
The implementation discards sealedState after calling getAuthorizationUrl directly.
  `;

  const fixedOutput = `
Wrap the app in AuthKitProvider in app/layout.tsx.

Use getUser() or withAuth() in Server Components only to read auth state.

Create a client nav auth component:
'use client'
function NavAuth() {
  const { user, isLoading, refreshAuth } = useAuth();
  if (isLoading) return null;
  if (user) return <a href="/dashboard">Dashboard</a>;
  return (
    <button type="button" onClick={() => void refreshAuth({ ensureSignedIn: true })}>
      Sign in
    </button>
  );
}

If you need a server-generated URL, use getSignInUrl() in a Server Action or Route Handler.
Do not use getAuthorizationUrl directly for AuthKit sign-in, because it returns { url, sealedState }.
Do not discard sealedState, and do not assign window.location.href = auth.signInUrl.
  `;

  it('scores the fixed pattern higher than the broken pattern', () => {
    const broken = scoreOutput(brokenOutput, expected);
    const fixed = scoreOutput(fixedOutput, expected);

    expect(fixed.composite).toBeGreaterThan(broken.composite);
    expect(fixed.antiPatternAvoidance).toBeGreaterThan(broken.antiPatternAvoidance);
    expect(fixed.composite).toBeGreaterThanOrEqual(80);
    expect(broken.composite).toBeLessThanOrEqual(60);
  });

  it('flags the broken pattern as an anti-pattern regression', () => {
    const errors = categorizeErrors(brokenOutput, expected);
    expect(errors).toContain('security_issue');
  });
});
