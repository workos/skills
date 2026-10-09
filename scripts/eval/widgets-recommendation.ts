import type { WidgetsRecommendation } from './types.ts';

// Shared vocabulary: an explicit rejection of any supported recommendation
// target must veto both same-clause and adjacent-clause positive evidence.
const PACKAGE = String.raw`(?:\bWorkOS\s+Widgets|@workos-inc/widgets)(?![\w/-])`;
const PROFILE = String.raw`\bUserProfile\b`;
const RECOMMEND = String.raw`(?:use|recommend)`;
const NEGATION = String.raw`(?:do\s+not|not|never|cannot|(?:don|doesn|shouldn|wouldn|can|won)['’]t)`;
const AVOID = String.raw`avoid(?:\s+(?:using|recommending))?`;
const TARGET = String.raw`(?:${PACKAGE}|\bWidgets\b|(?:\bWorkOS(?:['’]s)?\s+)?${PROFILE})`;
// Negation anywhere in the clause blocks credit; tentative words block it only
// in a coordinated part that carries the recommendation (see below).
const NEGATIVE = new RegExp(String.raw`\b(?:${NEGATION}|${AVOID}|no)\b`, 'i');
const TENTATIVE = /\b(?:might|could|maybe|perhaps|possibly|whether|unsure)\b/i;
const RECOMMENDATION_PART = new RegExp(String.raw`${PACKAGE}|${PROFILE}|\b${RECOMMEND}\b`, 'i');
const RETRACTION = new RegExp(
  String.raw`\b(?:${AVOID}|${NEGATION}\s+${RECOMMEND})[:\s]+(?:the\s+)?<?${TARGET}|(?:^|[,:(])\s*(?:the\s+)?${TARGET}\s+(?:(?:is|are)\s+${NEGATION}|(?:should|must)\s+not\s+be)\s+(?:used|recommended)\b`,
  'gi',
);
const NEGATED_PREFIX = new RegExp(String.raw`\b${NEGATION}\s*$`, 'i');

function isDisclaimed(prefix: string): boolean {
  return /(?:^\s*|\bit is\s+|\bit's\s+)(?:not true|false) that(?:\s+(?:you|we|one)\s+should)?\s*$/i.test(prefix);
}

function hasRetraction(clause: string): boolean {
  for (const match of clause.matchAll(RETRACTION)) {
    const prefix = clause.slice(0, match.index);
    const suffix = clause.slice(match.index + match[0].length);
    // Negated avoidance and explicit no-drop-in usage qualifications are not
    // withdrawals of the component recommendation. Other trailing prose is OK.
    if (isDisclaimed(prefix) || NEGATED_PREFIX.test(prefix)) continue;
    if (/^\s+as\s+(?:an?\s+)?(?:exact\s+)?drop[- ]in\b/i.test(suffix)) continue;
    // A closed authentication-purpose qualifier limits the job of the widget,
    // not its profile UI recommendation. Require the whole remaining qualifier:
    // "for authentication or profile UI" is not an authentication-only boundary.
    if (
      /^\s+(?:for\s+(?:authentication|sign[- ]?in|log[- ]?in)|to\s+authenticate(?:\s+users)?|as\s+an?\s+authentication\s+provider)\s*,?\s*$/i.test(
        suffix,
      )
    )
      continue;
    return true;
  }
  return false;
}

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
    .replace(/"[^"\n]*"|“[^”\n]*”|‘[^’\n]*’/g, '\n')
    .replace(/(^|\s)'[^'\n]+'(?=[\s,.!?]|$)/g, '$1\n')
    .replace(/`([^`\n]+)`/g, '$1');
  // Retain delimiters so excluding a labeled clause cannot join neighboring
  // evidence. Both positive paths and retractions see the same scoped text.
  const parts = prose
    .split(/([.!?;\n]+|\b(?:but|however)\b)/i)
    .map((part, index) =>
      index % 2 === 0 &&
      /\b(?:bad example|incorrect claim|incorrect recommendation|anti[- ]pattern|myth)\s*:/i.test(part)
        ? '\n'
        : part,
    );
  const clauses = parts.filter((_, index) => index % 2 === 0);
  // Only an explicit recommendation immediately followed by "its UserProfile"
  // and an affirmative capability counts across clauses. No proximity window,
  // intervening text, quoted spans, or independent catalog mentions.
  let recommendation = new RegExp(
    String.raw`(?:^|[.!?\n])[ \t]*(?:(?:I|we)[ \t]+)?${RECOMMEND}[ \t]+${PACKAGE}[ \t]*[;.][ \t]+its ${PROFILE} (?:provides|offers) (?:pre[- ]?built )?(?:profile|account) UI\b`,
    'i',
  ).test(parts.join(''));
  let retractedRecommendation = false;
  let limitation = false;
  let denial = false;
  let parity = false;

  for (const clause of clauses) {
    if (hasRetraction(clause)) retractedRecommendation = true;
    const denialPattern =
      /\bWorkOS\s+(?:(?:does not|doesn't|doesn’t)\s+(?:have|offer|provide)|(?:has|provides|offers) no|lacks)\s+(?:(?:any|a)\s+)?(?:(?:pre[- ]?built)\s+)?(?:(?:profile|account)(?:\s*(?:\/|or|and)\s*(?:profile|account))?\s+)?UI\b/gi;
    const claim = clause.replace(denialPattern, (match, offset: number) => {
      // Negation attaches to this match only; a later denial in the same
      // clause must still count. Use the same vocabulary for both paths.
      if (isDisclaimed(clause.slice(0, offset))) return '';
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

    // The whole clause must carry the recommendation and no negation, so
    // "Use X, and its UserProfile provides…" counts and "…, and it does not
    // provide…" does not. Tentative words only matter in coordinated parts that
    // carry the recommendation, so "…, and you could keep a custom menu" stays
    // firm. The recognized no-parity caveat was already removed from parityClaim.
    const tentative = parityClaim
      .split(/,\s*(?:and|or|while|so|then)\s+/i)
      .some((part) => RECOMMENDATION_PART.test(part) && TENTATIVE.test(part));
    if (
      new RegExp(PROFILE, 'i').test(parityClaim) &&
      new RegExp(PACKAGE, 'i').test(parityClaim) &&
      new RegExp(String.raw`\b(?:${RECOMMEND}|provides?|offers?)\b`, 'i').test(parityClaim) &&
      !NEGATIVE.test(parityClaim) &&
      !tentative
    ) {
      recommendation = true;
    }
  }

  if ((denial || parity) && recommendation) return 'mixed';
  if (denial) return 'denied';
  if (parity) return 'overclaim';
  return recommendation && limitation && !retractedRecommendation ? 'supported' : 'unknown';
}
