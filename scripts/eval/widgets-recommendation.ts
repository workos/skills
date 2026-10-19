import type { WidgetsRecommendation } from './types.ts';

/**
 * Opt-in, bounded prose contract — NOT a semantic judge or confidence estimate.
 * Needs an affirmative UserProfile recommendation AND an explicit no-drop-in
 * limitation. Code, quotations and incidental catalog mentions are not proof.
 * ponytail: fixture-bounded patterns, not semantic completeness. Unsupported
 * evidence stays unknown, but supported signals cannot rule out every possible
 * contradiction phrased outside this vocabulary. Expand only with fixtures.
 */
export function assessWidgetsRecommendation(output: string): WidgetsRecommendation {
  const prose = output
    // Keep a boundary where excluded text stood; never join evidence across it.
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '\n')
    .replace(/^\s*>.*$/gm, '\n')
    .replace(/"[^"\n]*"|“[^”\n]*”/g, '\n')
    .replace(/(^|\s)'[^'\n]+'(?=[\s,.!?]|$)/g, '$1\n')
    .replace(/`([^`\n]+)`/g, '$1');
  const clauses = prose.split(/[.!?;\n]+|\b(?:but|however)\b/i);
  // Only an explicit recommendation immediately followed by "its UserProfile"
  // and an affirmative capability counts across clauses. No proximity window,
  // intervening text, quoted spans, or independent catalog mentions.
  let recommendation =
    /(?:^|[.!?\n])[ \t]*(?:(?:I|we)[ \t]+)?(?:recommend|use)[ \t]+(?:WorkOS Widgets|@workos-inc\/widgets)[ \t]*[;.][ \t]+its UserProfile (?:provides|offers) (?:pre[- ]?built )?(?:profile|account) UI\b/i.test(
      prose,
    );
  let retractedRecommendation = false;
  let limitation = false;
  let denial = false;
  let parity = false;

  for (const clause of clauses) {
    // Ignore explicit bad-example labels and metalinguistic negation locally,
    // not a global 30-character lookback that swallows "does not have".
    if (/\b(?:bad example|incorrect claim|anti-pattern|myth)\s*:/i.test(clause)) continue;
    if (
      /\b(?:do not|don't|never) (?:use|recommend) (?:WorkOS Widgets|@workos-inc\/widgets|UserProfile)\s*$/i.test(clause)
    ) {
      retractedRecommendation = true;
    }
    const denialPattern =
      /\bWorkOS\s+(?:(?:does not|doesn't|doesn’t)\s+(?:have|offer|provide)|(?:has|provides|offers) no|lacks)\s+(?:(?:any|a)\s+)?(?:(?:pre[- ]?built)\s+)?(?:(?:profile|account)(?:\s*(?:\/|or|and)\s*(?:profile|account))?\s+)?UI\b/gi;
    const claim = clause.replace(denialPattern, (match, offset: number) => {
      // Negation attaches to this match only; a later denial in the same
      // clause must still count. Use the same vocabulary for both paths.
      if (/(?:^\s*|\bit is\s+|\bit's\s+)(?:not true|false) that\s*$/i.test(clause.slice(0, offset))) return '';
      denial = true;
      return match;
    });

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
  return recommendation && limitation && !retractedRecommendation ? 'supported' : 'unknown';
}
