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

// One punctuation vocabulary for splitting, verdict attachment and sentence labels.
// Newlines and conjunctions split clauses but intentionally do not link verdicts.
const sentenceBoundaries = new Set(['.', '!', '?']);
const punctuationBoundaries = new Set([...sentenceBoundaries, ';', ',', '—']);
const clauseBoundary = new RegExp(
  `([${[...punctuationBoundaries].join('')}\\n]|\\b(?:and|or|but|however|instead)\\b)`,
  'i',
);
const question = new RegExp(`[^${[...sentenceBoundaries].join('')};\\n]*\\?`, 'g');

/**
 * Conservative lexical evidence, not semantic entailment. Every phrase word must
 * occur in order in one clause, with at most three intervening words per gap.
 * Alternatives are case-authored; words from separate clauses cannot combine.
 */
export function summarizeRequirements(output: string, requirements: UnorderedRequirement[] = []) {
  const parts = output
    .replace(/^\s*>.*$/gm, '') // Quoted answers are not the agent's recommendation.
    .replace(/"[^"\n]*"|“[^”\n]*”|‘[^’\n]*’|(?<!\w)'[^'\n]*'(?!\w)/g, '')
    // Questions are not evidence, but retain '?' so a following verdict refers
    // back to the removed question rather than rejecting the replacement advice.
    .replace(question, '?')
    .split(clauseBoundary);
  const clauses = parts.filter((_, index) => index % 2 === 0).map(tokens);
  const rejected = new Set<number>();
  for (const [index, clause] of clauses.entries()) {
    if (
      !/^(?:(?:(?:that|this|it) (?:is|was)|that's|that’s) )?(?:incorrect|wrong|false|not (?:correct|right))$/.test(
        clause.join(' '),
      )
    )
      continue;
    // A standalone verdict rejects the adjacent claim, not the replacement:
    // "X — incorrect; Y" rejects X; a leading "Incorrect — X" rejects X.
    // Never carry verdicts across a newline or a conjunction into another task.
    const before = parts[index * 2 - 1];
    const after = parts[index * 2 + 1];
    if (sentenceBoundaries.has(before) && after === '—' && clause.length === 1 && clauses[index + 1]?.length) {
      // "X. Incorrect — Y" starts a new labeled example; it does not retract X.
      rejected.add(index + 1);
    } else if (punctuationBoundaries.has(before) && (clauses[index - 1]?.length || before === '?')) {
      rejected.add(index - 1);
    } else if (clauses[index + 1]?.length && punctuationBoundaries.has(after)) {
      rejected.add(index + 1);
    }
  }

  function evidence(phrase: string) {
    const words = tokens(phrase);
    let affirmed = false;
    let denied = false;
    for (const [clauseIndex, clause] of clauses.entries()) {
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
        if (rejected.has(clauseIndex) || clause.some((word, index) => denial.has(word) && !indices.includes(index)))
          denied = true;
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
