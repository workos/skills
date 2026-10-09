import { describe, expect, it } from 'vitest';
import { loadCases } from '../eval/runner.ts';
import { categorizeErrors, scoreOutput } from '../eval/scorer.ts';

const expected = loadCases(undefined, { caseId: 'migrate-clerk-widgets-recommendation' })[0].expected;
const adjacent =
  'Recommend WorkOS Widgets; its UserProfile provides prebuilt profile UI. It is not a drop-in Clerk replacement.';
const sameClause =
  'Use UserProfile from @workos-inc/widgets for prebuilt profile UI. It is not a drop-in Clerk replacement.';

function expectCapped(output: string) {
  const score = scoreOutput(output, expected);
  expect(score.widgetsRecommendation, output).toBe('unknown');
  expect(score.composite, output).toBeLessThanOrEqual(60);
  expect(categorizeErrors(output, expected), output).toContain('unverified_recommendation');
}

describe('Scoped Widgets recommendation retractions through scoreOutput', () => {
  it('caps the exact PR50 reproduction, not just the assessor enum', () => {
    const output =
      'Recommend WorkOS Widgets; its UserProfile provides prebuilt profile UI. It is not a drop-in Clerk replacement. Avoid WorkOS Widgets.';
    const { widgetsRecommendation: _contract, ...legacy } = expected;
    expect(scoreOutput(output, legacy).composite).toBeGreaterThan(60);
    expectCapped(output);
    expect(scoreOutput(output, expected).composite).toBe(60);
  });

  it.each([
    'Avoid WorkOS Widgets.',
    'Avoid @workos-inc/widgets because we should build everything ourselves.',
    'Avoid Widgets!',
    'Avoid UserProfile for this project.',
    'Avoid using WorkOS Widgets in this app.',
    'Avoid recommending @workos-inc/widgets.',
    'Do not use WorkOS Widgets in this app.',
    "Don't recommend Widgets for this migration.",
    'Never use UserProfile, build your own.',
    'I would not recommend @workos-inc/widgets.',
    "We shouldn't use WorkOS Widgets here.",
    'I cannot recommend UserProfile.',
    'I can’t recommend WorkOS Widgets.',
    'WorkOS Widgets is not recommended for this app.',
    'UserProfile should not be used here.',
    'AVOID: WORKOS WIDGETS!',
    'Do not use <UserProfile /> here.',
    'Avoid `UserProfile` for account UI.',
    "Do not recommend WorkOS's UserProfile for this app.",
    'Do not use WorkOS Widgets or UserProfile.',
    'Do not use the UserProfile widget for this app.',
    'AvOiD\t@workos-inc/widgets: build a custom account page instead.',
  ])('rejects earlier/later direct retraction: %s', (retraction) => {
    for (const positive of [adjacent, sameClause]) {
      expectCapped(`${positive} ${retraction}`);
      expectCapped(`${retraction}\n${positive}`);
      expectCapped(`${positive.slice(0, -1)}; ${retraction}`);
    }
    // A direct retraction is not itself a capability denial or a recommendation.
    expectCapped(retraction);
  });

  it.each([
    '"Avoid WorkOS Widgets."',
    '“Avoid WorkOS Widgets because everything must be custom.”',
    "'Avoid @workos-inc/widgets.'",
    '‘Avoid UserProfile.’',
    '> Avoid WorkOS Widgets.',
    '```text\nAvoid WorkOS Widgets.\n```',
    'Bad example: Avoid WorkOS Widgets.',
    'INCORRECT CLAIM: Do not recommend @workos-inc/widgets here.',
    'Incorrect recommendation: Avoid Widgets.',
    'Anti-pattern: Avoid UserProfile for this project.',
    'Myth: Never use WorkOS Widgets.',
    'Avoid exposing API secrets in the browser.',
    "Don't recommend Clerk UserProfile for a WorkOS integration.",
    'Clerk UserProfile is not recommended for a WorkOS integration.',
    'Do not avoid WorkOS Widgets.',
    'It is not true that you should avoid UserProfile.',
    'Avoid treating Widgets as a drop-in Clerk replacement.',
    'Do not use WorkOS Widgets as a drop-in Clerk replacement.',
    'Avoid SuperUserProfile.',
    'Avoid @workos-inc/widgets-experimental.',
    'Avoid Widgetstown.',
  ])('does not treat exclusions or qualified limitations as direct retraction: %s', (nonRetraction) => {
    for (const positive of [adjacent, sameClause]) {
      for (const output of [`${positive}\n${nonRetraction}`, `${nonRetraction}\n${positive}`]) {
        expect(scoreOutput(output, expected).widgetsRecommendation, output).toBe('supported');
        const { widgetsRecommendation: _contract, ...legacy } = expected;
        expect(scoreOutput(output, expected).composite, output).toBe(scoreOutput(output, legacy).composite);
        expect(categorizeErrors(output, expected), output).not.toContain('unverified_recommendation');
      }
    }
  });

  it.each(['Bad example', 'Incorrect recommendation', 'Anti-pattern'])(
    '%s excludes positive as well as negative evidence',
    (label) => {
      const output = `${label}: Recommend WorkOS Widgets; its UserProfile provides prebuilt profile UI. It is not a drop-in Clerk replacement.`;
      expectCapped(output);
    },
  );

  it('does not let a quoted or labeled retraction hide an actual one', () => {
    expectCapped(`${adjacent} "Avoid Widgets." Avoid UserProfile for this app.`);
    expectCapped(`${adjacent} Bad example: Avoid Widgets; avoid @workos-inc/widgets for this app.`);
  });
});
