import type { ExpectedSignals, ScoreCard, ErrorCategory } from './types.ts';
import { summarizeRequirements } from './requirements.ts';

/**
 * Normalize a string for flexible matching across naming conventions.
 * Converts camelCase → snake_case, kebab-case → snake_case, lowercases.
 * Preserves dots for method chains (e.g., workos.sso.getAuthorizationUrl).
 */
export function normalizeForMatch(s: string): string {
  if (!s) return '';

  return (
    s
      // Insert underscore before uppercase runs: getAuthorizationUrl → get_Authorization_Url
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      // Handle consecutive caps: getHTTPResponse → get_HTTP_Response → get_h_t_t_p_response after lowercase
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      // kebab-case to snake_case
      .replace(/-/g, '_')
      .toLowerCase()
  );
}

/**
 * Ratio of expected items found in the output (0-1).
 * Returns 1.0 if expected array is empty (no penalty for empty expectations).
 */
export function ratioFound(expected: string[], output: string): number {
  if (expected.length === 0) return 1;

  const normalizedOutput = normalizeForMatch(output);
  let found = 0;

  for (const item of expected) {
    if (normalizedOutput.includes(normalizeForMatch(item))) {
      found++;
    }
  }

  return found / expected.length;
}

/**
 * Invocation-aware method matching (0-1).
 * Four-pass: full invocation → last-segment invocation → full substring → last-segment substring.
 * Returns 1.0 if expected array is empty.
 */
export function methodRatioFound(expected: string[], output: string): number {
  if (expected.length === 0) return 1;

  const normalizedOutput = normalizeForMatch(output);
  let found = 0;

  for (const method of expected) {
    const normalized = normalizeForMatch(method);

    // Pass 1: full invocation form — method_name( or workos.sso.method(
    if (normalizedOutput.includes(normalized + '(')) {
      found++;
      continue;
    }

    // Pass 2: last segment invocation — get_authorization_url(
    const dotParts = normalized.split('.');
    if (dotParts.length > 1) {
      const lastPart = dotParts[dotParts.length - 1] + '(';
      if (normalizedOutput.includes(lastPart)) {
        found++;
        continue;
      }
    }

    // Pass 3: full normalized substring (prose mentions still count)
    if (normalizedOutput.includes(normalized)) {
      found++;
      continue;
    }

    // Pass 4: last segment substring — catches "use getAuthorizationUrl to..."
    const parts = normalized.split('.');
    if (parts.length > 1 && normalizedOutput.includes(parts[parts.length - 1])) {
      found++;
    }
  }

  return found / expected.length;
}

/**
 * Score flow step presence and ordering (0-1).
 * 60% weight on presence, 40% weight on correct relative ordering.
 */
export function scoreFlowOrder(steps: string[], output: string): number {
  if (steps.length === 0) return 1;

  const lowerOutput = output.toLowerCase();

  // Find position of each step in the output (-1 if not found).
  // Uses proximity-based matching with a minimum co-occurrence threshold.
  // For multi-keyword steps, we anchor to the first "good enough" match
  // (>= ceil(keywords/2)) rather than the densest match to avoid checklist/
  // summary sections overshadowing earlier implementation steps.
  const positions = steps.map((step) => {
    const keywords = step.toLowerCase().split(/\s+/).filter(Boolean);
    if (keywords.length === 0) return -1;

    // Single keyword — use simple indexOf (no proximity needed)
    if (keywords.length === 1) {
      return lowerOutput.indexOf(keywords[0]);
    }

    // Multi-keyword: prefer anchors for the leading keyword, then fall back
    // to any keyword anchors. This reduces false positives where common
    // secondary keywords ("state", "parameter") appear out of context.
    const WINDOW = 200;
    const minCoverage = Math.ceil(keywords.length / 2);
    let bestPos = -1;
    let bestCount = 0;

    const collectAnchors = (kw: string): number[] => {
      const out: number[] = [];
      let searchFrom = 0;
      while (searchFrom < lowerOutput.length) {
        const anchor = lowerOutput.indexOf(kw, searchFrom);
        if (anchor === -1) break;
        out.push(anchor);
        searchFrom = anchor + 1;
      }
      return out;
    };

    const coverageAt = (anchor: number): number => {
      const windowStart = Math.max(0, anchor - WINDOW);
      const windowEnd = Math.min(lowerOutput.length, anchor + WINDOW);
      const window = lowerOutput.slice(windowStart, windowEnd);

      let coCount = 0;
      for (const other of keywords) {
        if (window.includes(other)) coCount++;
      }
      return coCount;
    };

    const leadingAnchors = collectAnchors(keywords[0]);
    const seen = new Set<number>();
    for (const anchor of leadingAnchors) {
      seen.add(anchor);
      const coCount = coverageAt(anchor);
      if (coCount > bestCount) {
        bestCount = coCount;
        bestPos = anchor;
      }
      if (coCount >= minCoverage) {
        return anchor;
      }
    }

    const allAnchors = new Set<number>();
    for (const kw of keywords) {
      for (const anchor of collectAnchors(kw)) {
        allAnchors.add(anchor);
      }
    }

    const sortedAnchors = [...allAnchors].sort((a, b) => a - b);
    for (const anchor of sortedAnchors) {
      if (seen.has(anchor)) continue;
      const coCount = coverageAt(anchor);

      if (coCount > bestCount) {
        bestCount = coCount;
        bestPos = anchor;
      }

      if (coCount >= minCoverage) {
        return anchor;
      }
    }

    // Only accept fallback anchor if it meets minimum coverage.
    return bestCount >= minCoverage ? bestPos : -1;
  });

  const foundPositions = positions.filter((p) => p !== -1);
  const presenceRatio = foundPositions.length / steps.length;

  if (foundPositions.length <= 1) {
    // 0 or 1 steps found — ordering is trivially correct for found steps
    return presenceRatio * 0.6 + (foundPositions.length > 0 ? 0.4 : 0);
  }

  // Check monotonically increasing order among found steps
  let inOrder = 0;
  for (let i = 1; i < foundPositions.length; i++) {
    if (foundPositions[i] > foundPositions[i - 1]) {
      inOrder++;
    }
  }
  const orderRatio = inOrder / (foundPositions.length - 1);

  return presenceRatio * 0.6 + orderRatio * 0.4;
}

/**
 * Count how many items from the list appear in the output.
 */
export function countFound(items: string[], output: string): number {
  if (items.length === 0) return 0;

  const normalizedOutput = normalizeForMatch(output);
  let count = 0;

  for (const item of items) {
    if (normalizedOutput.includes(normalizeForMatch(item))) {
      count++;
    }
  }

  return count;
}

/**
 * Count hallucinated methods/APIs while ignoring negated references.
 * Example ignored mention: "workos.sso.authenticate does not exist".
 */
export function countHallucinations(expected: string[], output: string): number {
  if (expected.length === 0) return 0;

  const lowerOutput = output.toLowerCase();
  const normalizedOutput = normalizeForMatch(output);
  let count = 0;

  for (const item of expected) {
    const lowerItem = item.toLowerCase();
    let lowerIdx = lowerOutput.indexOf(lowerItem);
    while (lowerIdx !== -1) {
      if (!isNegated(lowerOutput, lowerIdx)) {
        count++;
        break;
      }
      lowerIdx = lowerOutput.indexOf(lowerItem, lowerIdx + Math.max(1, lowerItem.length));
    }
    if (lowerIdx !== -1) {
      continue;
    }

    // Fallback for casing/convention mismatches
    const normalizedItem = normalizeForMatch(item);
    if (normalizedItem === lowerItem) {
      continue;
    }
    let normIdx = normalizedOutput.indexOf(normalizedItem);
    while (normIdx !== -1) {
      if (!isNegated(normalizedOutput, normIdx)) {
        count++;
        break;
      }
      normIdx = normalizedOutput.indexOf(normalizedItem, normIdx + Math.max(1, normalizedItem.length));
    }
  }

  return count;
}

/**
 * Check if a match appears inside a .env block or env placeholder context.
 * Returns true for patterns like `WORKOS_API_KEY=sk_test_xxx` or `# .env` blocks,
 * which are not real hardcoded keys — just configuration examples.
 */
export function isInEnvBlock(output: string, matchIndex: number): boolean {
  // Look back ~150 chars for env context
  const lookback = output.slice(Math.max(0, matchIndex - 150), matchIndex).toLowerCase();
  // Look at the line containing the match
  const lineStart = output.lastIndexOf('\n', matchIndex) + 1;
  const lineEnd = output.indexOf('\n', matchIndex);
  const line = output.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();

  // Env file header nearby: `.env`, `# .env`, `env vars`, `environment variables`
  if (/(?:^|\s|#\s*)\.env\b|env(?:ironment)?\s*var/i.test(lookback)) {
    return true;
  }

  // Line looks like KEY=value (env file format)
  if (/^[A-Z][A-Z0-9_]+=\S/.test(line)) {
    return true;
  }

  // Placeholder indicators on the same line
  if (/your[_-]|<your|replace|placeholder/i.test(line)) {
    return true;
  }

  return false;
}

/**
 * Check if a match at the given index is preceded by a negation word.
 * Looks back up to 30 chars for words like don't, not, never, avoid.
 */
export function isNegated(output: string, matchIndex: number): boolean {
  const prefix = output
    .slice(Math.max(0, matchIndex - 30), matchIndex)
    .toLowerCase()
    .trim();
  // Check for negation word in the 30-char prefix.
  // Uses word boundaries to avoid matching "note", "cannot", etc.
  if (/(?:\b)(don'?t|do not|never|avoid|shouldn'?t|should not|not)(?:\b)/.test(prefix)) {
    return true;
  }
  // Treat cautionary labels as negation context for anti-pattern examples
  // e.g., "Anti-pattern: no signature verification" should not count as usage
  if (/(anti[- ]pattern|pitfall|trap|caution)[:\s]/i.test(prefix)) {
    return true;
  }
  return false;
}

/**
 * Negation-aware ratio of anti-patterns found in output.
 * Returns 0 if expected is empty (no anti-patterns to check = 0 found).
 * Skips matches preceded by negation words.
 */
export function negationAwareRatioFound(expected: string[], output: string): number {
  if (expected.length === 0) return 0;

  const normalizedOutput = normalizeForMatch(output);
  const lowerOutput = output.toLowerCase();
  let found = 0;

  for (const item of expected) {
    const lowerItem = item.toLowerCase();
    // Try lowercase match first — index aligns with original text for
    // negation/env checks. Normalized match shifts indexes due to
    // camelCase→snake_case expansion.
    let lowerIdx = lowerOutput.indexOf(lowerItem);
    while (lowerIdx !== -1) {
      if (!isNegated(lowerOutput, lowerIdx) && !isInEnvBlock(output, lowerIdx)) {
        found++;
        break;
      }
      lowerIdx = lowerOutput.indexOf(lowerItem, lowerIdx + Math.max(1, lowerItem.length));
    }
    if (lowerIdx !== -1) {
      continue;
    }

    // Fallback: normalized match (handles camelCase/kebab variants)
    const normalizedItem = normalizeForMatch(item);
    if (normalizedItem === lowerItem) {
      continue;
    }
    let normIdx = normalizedOutput.indexOf(normalizedItem);
    while (normIdx !== -1) {
      if (!isNegated(normalizedOutput, normIdx)) {
        found++;
        break;
      }
      normIdx = normalizedOutput.indexOf(normalizedItem, normIdx + Math.max(1, normalizedItem.length));
    }
  }

  return found / expected.length;
}

/**
 * Compute weighted composite score (0-100).
 * Weights: methods(20) + flow(20) + imports(10) + params(15) + envVars(15) + antiPatterns(15) + clean(5)
 * Clean bonus: 5 points for zero hallucinations.
 * Hallucination penalty: -5 per hallucination, capped at -25.
 */
export function weightedScore(dimensions: Omit<ScoreCard, 'composite'>): number {
  const base =
    dimensions.methodAccuracy * 20 +
    dimensions.paramAccuracy * 15 +
    dimensions.envVarCoverage * 15 +
    dimensions.importAccuracy * 10 +
    dimensions.flowCorrectness * 20 +
    dimensions.antiPatternAvoidance * 15 +
    (dimensions.hallucinationCount === 0 ? 5 : 0);

  const penalty = Math.min(dimensions.hallucinationCount * 5, 25);
  return Math.max(0, Math.round(base - penalty));
}

/** Optional unordered prose signals share the existing parameter dimension; no new weights. */
function parameterAccuracy(expected: ExpectedSignals, output: string): number {
  if (!expected.unorderedRequirements?.length) return ratioFound(expected.params, output);
  const requirements = summarizeRequirements(output, expected.unorderedRequirements);
  return (countFound(expected.params, output) + requirements.found) / (expected.params.length + requirements.total);
}

/**
 * Score an LLM output against expected signals.
 */
export function scoreOutput(output: string, expected: ExpectedSignals): ScoreCard {
  const methodAccuracy = methodRatioFound(expected.methods, output);
  const paramAccuracy = parameterAccuracy(expected, output);
  const envVarCoverage = ratioFound(expected.envVars, output);
  const importAccuracy = expected.imports.length > 0 ? ratioFound(expected.imports, output) : 1;
  const flowCorrectness = scoreFlowOrder(expected.flowSteps, output);
  const antiPatternAvoidance = 1 - negationAwareRatioFound(expected.antiPatterns, output);
  const hallucinationCount = countHallucinations(expected.hallucinations ?? [], output);

  const dimensions = {
    methodAccuracy,
    paramAccuracy,
    envVarCoverage,
    importAccuracy,
    flowCorrectness,
    antiPatternAvoidance,
    hallucinationCount,
  };

  return {
    ...dimensions,
    composite: weightedScore(dimensions),
  };
}

/**
 * Categorize errors in an LLM output based on expected signals.
 */
export function categorizeErrors(output: string, expected: ExpectedSignals): ErrorCategory[] {
  const errors: ErrorCategory[] = [];

  if (countHallucinations(expected.hallucinations ?? [], output) > 0) {
    errors.push('hallucinated_method');
  }
  if (expected.methods.length > 0 && methodRatioFound(expected.methods, output) < 1) {
    errors.push('missing_method');
  }
  if (parameterAccuracy(expected, output) < 1) {
    errors.push('wrong_params');
  }
  if (ratioFound(expected.envVars, output) < 1) {
    errors.push('missing_env_var');
  }
  if (ratioFound(expected.imports, output) < 1) {
    errors.push('wrong_import');
  }
  if (scoreFlowOrder(expected.flowSteps, output) < 0.8) {
    errors.push('wrong_flow_order');
  }
  if (negationAwareRatioFound(expected.antiPatterns, output) > 0) {
    errors.push('security_issue');
  }

  return errors;
}
