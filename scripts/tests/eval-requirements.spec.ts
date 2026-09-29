import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { loadCases } from '../eval/runner.ts';
import { loadCaseExpected, summarizeSignals, formatSummary } from '../eval/diff.ts';
import { summarizeRequirements, validateUnorderedRequirements } from '../eval/requirements.ts';
import { scoreOutput, categorizeErrors } from '../eval/scorer.ts';

// Hand-written explanations, not generated from expected phrase strings.
const paraphrases = {
  'authkit-redirect-vite-origin': [
    'The default for this app is its origin.',
    'Add the redirect URI in the confirmed application settings.',
    'Configure the allowed browser origins separately.',
    'Use a dedicated SDK-backed login route.',
  ],
  'authkit-redirect-cra-custom': [
    'Supply the redirectUri option to AuthKitProvider.',
    'Allowlist the entire redirect URL in WorkOS.',
    'Add the app to the allowed browser origins.',
    'Check the deployed destination mounts AuthKitProvider.',
  ],
  'authkit-redirect-vanilla-custom': [
    'Wait for createClient to resolve before using the client.',
    'The default for this app is its origin.',
    'Pass the chosen redirectUri to the client constructor.',
    'Configure the allowed browser origins separately.',
    'Examine the webpack config for environment injection.',
  ],
  'authkit-redirect-router-static': [
    'Confirm this is static hosting before selecting an integration.',
    'Use the browser SDK for this app.',
    'The default for this app is its origin.',
    'A server callback is not required here.',
  ],
  'authkit-redirect-router-server': [
    'Explicit configuration takes precedence over environment variables.',
    'Mount a server-side callback route in the routing configuration.',
    'Ensure registration matches the effective URL.',
    'Secrets must stay on the server.',
  ],
  'authkit-redirect-router-ambiguous': [
    'Examine the framework config before selecting a package.',
    'Check the actual execution path in the active workspace.',
    'Clarify the intended deployment with the user.',
  ],
  'authkit-redirect-registration-vs-reachability': [
    'Compare the configured redirect with the saved registration.',
    'Check the deployed destination initializes the browser SDK.',
    'CORS uses the app origin.',
    'Retain all current registrations while adding this destination.',
    'Verify the target environment before changing settings.',
  ],
};

describe.each(Object.entries(paraphrases))('natural setup paraphrases: %s', (id, paragraphs) => {
  const { expected } = loadCases(undefined, { caseId: id })[0];
  const requirements = expected.unorderedRequirements!;
  const technicalSignals = [...expected.params, ...expected.methods, ...expected.imports, ...expected.envVars];
  const answer = (prose: string[]) => [...prose, ...technicalSignals].join('\n');

  it('recognizes each independent meaning and gives reordered prose equal credit', () => {
    expect(requirements).toHaveLength(paragraphs.length);
    paragraphs.forEach((paragraph, index) => {
      expect(summarizeRequirements(paragraph, [requirements[index]]).found, paragraph).toBe(1);
    });
    const forward = scoreOutput(answer(paragraphs), expected);
    expect(forward.composite).toBe(100);
    expect(scoreOutput(answer([...paragraphs].reverse()), expected)).toEqual(forward);
    expect(categorizeErrors(answer(paragraphs), expected)).toEqual([]);
  });

  it('penalizes every omitted meaning and reports the same missing signals', () => {
    paragraphs.forEach((_, index) => {
      const incomplete = answer(paragraphs.filter((_, other) => index !== other));
      const score = scoreOutput(incomplete, expected);
      const summary = summarizeSignals(incomplete, expected);
      expect(score.composite).toBeLessThan(100);
      expect(score.paramAccuracy).toBe(summary.params.found / summary.params.total);
      expect(summary.params.missing).toContain(requirements[index].anyOf[0]);
      expect(formatSummary(summary)).toContain(requirements[index].anyOf[0]);
      expect(categorizeErrors(incomplete, expected)).toContain('wrong_params');
    });
  });
});

describe('bounded, affirmative requirement evidence', () => {
  const { expected } = loadCases(undefined, { caseId: 'authkit-redirect-cra-custom' })[0];
  const registration = expected.unorderedRequirements![1];

  it.each([
    'Register the full redirect URL.',
    'Allowlist the entire redirect URL.',
    'Register the complete callback redirect address.',
    'Register the full URL, not just its origin.',
    'Register the full URL. The old advice was "do not register the full URL".',
  ])('accepts equivalent affirmative wording: %s', (answer) => {
    expect(summarizeRequirements(answer, [registration]).found).toBe(1);
  });

  it.each([
    'Register users; log the full URL.',
    'Register users. The full URL appears in logs.',
    'Register users\nFull URL validation is separate.',
    'Register users, use the full URL in a log.',
    'Register users and log the full URL.',
    'Register users or log the full URL.',
    'Unregister the full URL.',
    'Register the URL.', // "full"/"entire" is a meaningful requirement, not filler.
    'Register the full URL? No.',
    'Register these multiple completely unrelated additional example items before considering the full URL.',
    '"Register the full redirect URL"',
    '“Allowlist the entire redirect URL”',
    '‘Register the full redirect URL’',
    "'Register the full redirect URL'",
    '> Register the full redirect URL.',
    'Do not register the full redirect URL.',
    "Don't register the full redirect URL.",
    'Register the full redirect URL is unnecessary.',
    'It is incorrect to allowlist the entire redirect URL.',
    'Register the full URL. Do not register the full URL.',
    'Do not register the full URL. Register the full URL.',
    'Register the full URL. Never allowlist the entire redirect URL.',
    'Register the full URL. Register only the origin.',
  ])('rejects missing, quoted, negated, cross-clause or contradictory evidence: %s', (answer) => {
    expect(summarizeRequirements(answer, [registration]).found).toBe(0);
    const rest = paraphrases['authkit-redirect-cra-custom'].filter((_, index) => index !== 1);
    const completeButWrong = [
      ...rest,
      answer,
      ...expected.params,
      ...expected.methods,
      ...expected.imports,
      ...expected.envVars,
    ].join('\n');
    expect(scoreOutput(completeButWrong, expected).composite).toBeLessThan(100);
    expect(categorizeErrors(completeButWrong, expected)).toContain('wrong_params');
    expect(summarizeSignals(completeButWrong, expected).params.missing).toContain('register full URL');
  });

  it.each(['No server callback is needed.', 'A server callback is not required.', 'A server callback is unnecessary.'])(
    'accepts a legitimate negative requirement: %s',
    (answer) => {
      const { expected } = loadCases(undefined, { caseId: 'authkit-redirect-router-static' })[0];
      expect(summarizeRequirements(answer, [expected.unorderedRequirements![3]]).found).toBe(1);
    },
  );

  it.each([
    'A server callback is required.',
    'There is "no server callback" in the old example.',
    'No server callback is needed. Create a server callback anyway.',
  ])('rejects incorrect or contradicted negative requirements: %s', (answer) => {
    const { expected } = loadCases(undefined, { caseId: 'authkit-redirect-router-static' })[0];
    expect(summarizeRequirements(answer, [expected.unorderedRequirements![3]]).found).toBe(0);
  });

  it('does not let keywords redeem advice to use a callback path for CORS', () => {
    const requirement = expected.unorderedRequirements![2];
    expect(
      summarizeRequirements('Configure the CORS origin. Set CORS to the full callback URL.', [requirement]).found,
    ).toBe(0);
  });
});

describe('schema, legacy compatibility and summaries', () => {
  it.each([
    null,
    {},
    ['register URL'],
    [{ anyOf: [] }],
    [{ anyOf: [''] }],
    [{ anyOf: [1] }],
    [{ anyOf: ['ok'], noneOf: [] }],
    [{ anyOf: ['ok'], typo: [] }],
  ])('rejects malformed opt-in requirements: %j', (value) => {
    expect(() => validateUnorderedRequirements(value)).toThrow('unorderedRequirements');
  });

  it('validates through the real loader without accepting malformed requirements silently', () => {
    const dir = mkdtempSync(join(process.cwd(), '.requirements-test-'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const original = loadCases(undefined, { caseId: 'authkit-redirect-cra-custom' })[0];
      const path = join(dir, 'cases.yaml');
      writeFileSync(path, JSON.stringify([original]));
      expect(loadCases(dir)).toEqual([original]);
      writeFileSync(
        path,
        JSON.stringify([{ ...original, expected: { ...original.expected, unorderedRequirements: [{ anyOf: [] }] } }]),
      );
      expect(loadCases(dir)).toEqual([]);
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('diff loading preserves the new field and needs no report format changes', async () => {
    const { expected } = loadCases(undefined, { caseId: 'authkit-redirect-cra-custom' })[0];
    expect(await loadCaseExpected('authkit-redirect-cra-custom')).toEqual(expected);
    const summary = summarizeSignals('Register the full redirect URL.', expected);
    expect(summary.params.matched).toContain('register full URL');
    expect(JSON.parse(JSON.stringify(summary))).toEqual(summary);
  });

  it('omitted/empty requirements preserve every legacy score and error category', () => {
    for (const { expected } of loadCases().filter((item) => !item.expected.unorderedRequirements)) {
      for (const output of ['', 'generate authorization URL\nhandle callback\nexchange code for profile']) {
        const explicitEmpty = { ...expected, unorderedRequirements: [] };
        expect(scoreOutput(output, explicitEmpty)).toEqual(scoreOutput(output, expected));
        expect(categorizeErrors(output, explicitEmpty)).toEqual(categorizeErrors(output, expected));
        expect(summarizeSignals(output, explicitEmpty)).toEqual(summarizeSignals(output, expected));
      }
    }
  });
});
