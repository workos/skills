import type { WidgetsRecommendation } from './types.ts';

/**
 * Opt-in, bounded prose contract — NOT a semantic judge or confidence estimate.
 * Needs an affirmative UserProfile recommendation AND an explicit no-drop-in
 * limitation. Code, quotations and incidental catalog mentions are not proof.
 * ponytail: unrecognized paraphrases stay unknown; expand only with fixtures.
 */
export function assessWidgetsRecommendation(output: string): WidgetsRecommendation {
  const prose = output
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '')
    .replace(/^\s*>.*$/gm, '')
    .replace(/"[^"\n]*"|“[^”\n]*”/g, '')
    .replace(/(^|\s)'[^'\n]+'(?=[\s,.!?]|$)/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1');
  const clauses = prose.split(/[.!?\n]+|\b(?:but|however)\b/i);
  let recommendation = false;
  let limitation = false;
  let denial = false;
  let parity = false;

  for (const clause of clauses) {
    // Ignore explicit bad-example labels and metalinguistic negation locally,
    // not a global 30-character lookback that swallows "does not have".
    if (/\b(?:bad example|incorrect claim|anti-pattern|myth)\s*:/i.test(clause)) continue;
    const claim = clause.replace(
      /\b(?:(?:it is|it's)\s+)?not true that\s+WorkOS\s+(?:has no|does not have|doesn't have)\s+(?:(?:pre[- ]?built)\s+)?(?:profile|account)\s+UI/gi,
      '',
    );
    if (
      /\bWorkOS\s+(?:(?:does not|doesn't|doesn’t)\s+(?:have|offer|provide)|has no|lacks)\s+(?:(?:any|a)\s+)?(?:(?:pre[- ]?built)\s+)?(?:(?:profile|account)(?:\s*(?:\/|or|and)\s*(?:profile|account))?\s+)?UI\b/i.test(
        claim,
      )
    ) {
      denial = true;
    }

    const noParity =
      /\bnot\s+(?:an?\s+)?(?:exact\s+)?drop[- ]in\s+(?:(?:replacement|equivalent)\s*(?:for\s+)?)?(?:Clerk\b|replacement\b)/i;
    if (noParity.test(claim)) limitation = true;
    const parityClaim = claim.replace(noParity, '');
    if (
      /\b(?:WorkOS|Widgets|UserProfile)\b.{0,100}\b(?:is|are|provides?|offers?)\s+(?:an?\s+)?(?:(?:exact\s+)?drop[- ]in|(?:exact|identical)\s+(?:parity|replacement|equivalent))\b/i.test(
        parityClaim,
      )
    ) {
      parity = true;
    }

    if (
      /\bUserProfile\b/i.test(claim) &&
      /WorkOS Widgets|@workos-inc\/widgets/i.test(claim) &&
      /\b(?:use|recommend|provides?|offers?)\b/i.test(claim) &&
      !/\b(?:not|never|don't|doesn't|no|avoid|might|maybe|perhaps|whether|unsure)\b/i.test(claim)
    ) {
      recommendation = true;
    }
  }

  if ((denial || parity) && recommendation) return 'mixed';
  if (denial) return 'denied';
  if (parity) return 'overclaim';
  return recommendation && limitation ? 'supported' : 'unknown';
}
