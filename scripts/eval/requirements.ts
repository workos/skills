import type { UnorderedRequirement } from './types.ts';

/** Validate only the opt-in field; legacy case schemas are unchanged. */
export function validateUnorderedRequirements(value: unknown): void {
  if (value === undefined) return;
  const phrases = (items: unknown): items is string[] =>
    Array.isArray(items) &&
    items.length > 0 &&
    items.every((item) => typeof item === 'string' && /[a-z0-9]/i.test(item));
  if (
    !Array.isArray(value) ||
    value.some(
      (item) =>
        !item ||
        typeof item !== 'object' ||
        !phrases(item.anyOf) ||
        (item.noneOf !== undefined && !phrases(item.noneOf)) ||
        Object.keys(item).some((key) => key !== 'anyOf' && key !== 'noneOf'),
    )
  ) {
    throw new Error('unorderedRequirements must be an array of { anyOf: nonempty phrases, noneOf?: nonempty phrases }');
  }
}

const tokens = (text: string): string[] => text.toLowerCase().match(/[a-z0-9_]+(?:['’][a-z]+)?/g) ?? [];
const denial = new Set([
  'no',
  'not',
  'never',
  "don't",
  'don’t',
  "doesn't",
  'doesn’t',
  "isn't",
  'isn’t',
  "shouldn't",
  'shouldn’t',
  'cannot',
  'without',
  'skip',
  'omit',
  'avoid',
  'optional',
  'unnecessary',
  'wrong',
  'incorrect',
  'false',
]);

/**
 * Conservative lexical evidence, not semantic entailment. Every phrase word must
 * occur in order in one clause, with at most three intervening words per gap.
 * Alternatives are case-authored; words from separate clauses cannot combine.
 */
export function summarizeRequirements(output: string, requirements: UnorderedRequirement[] = []) {
  const clauses = output
    .replace(/^\s*>.*$/gm, '') // Quoted answers are not the agent's recommendation.
    .replace(/"[^"\n]*"|“[^”\n]*”|‘[^’\n]*’|(?<!\w)'[^'\n]*'(?!\w)/g, '')
    .replace(/[^.!?;\n]*\?/g, '') // A question alone is not affirmative advice.
    .split(/[.!?;\n,]|\b(?:and|or|but|however|instead)\b/i)
    .map(tokens);

  function evidence(phrase: string) {
    const words = tokens(phrase);
    let affirmed = false;
    let denied = false;
    for (const clause of clauses) {
      for (let start = 0; start < clause.length; start++) {
        if (clause[start] !== words[0]) continue;
        const indices = [start];
        for (const word of words.slice(1)) {
          const previous = indices[indices.length - 1];
          const next = clause.findIndex((token, index) => index > previous && index <= previous + 4 && token === word);
          if (next === -1) break;
          indices.push(next);
        }
        if (indices.length !== words.length) continue;
        // A literal negative requirement (e.g. "no server callback") owns its
        // negation token. Extra negation before/within/after a match denies it.
        if (clause.some((word, index) => denial.has(word) && !indices.includes(index))) denied = true;
        else affirmed = true;
      }
    }
    return { affirmed, denied };
  }

  const matched: string[] = [];
  const missing: string[] = [];
  for (const requirement of requirements) {
    const alternatives = requirement.anyOf.map(evidence);
    const satisfied =
      alternatives.some((item) => item.affirmed) &&
      !alternatives.some((item) => item.denied) &&
      !(requirement.noneOf ?? []).some((phrase) => evidence(phrase).affirmed);
    (satisfied ? matched : missing).push(requirement.anyOf[0]);
  }
  return { found: matched.length, total: requirements.length, matched, missing };
}
