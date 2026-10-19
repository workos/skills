/** A single eval test case — declarative, lives in YAML */
export interface EvalCase {
  id: string;
  product: string;
  skill: string;
  skillType: 'generated' | 'hand-crafted';
  language?: string;
  framework?: string;
  prompt: string;
  expected: ExpectedSignals;
}

/** One unordered setup requirement; alternatives are equivalent, noneOf lists contradictory advice. */
export interface UnorderedRequirement {
  anyOf: string[];
  noneOf?: string[];
}

/** Expected signals to check in LLM output */
export interface ExpectedSignals {
  methods: string[];
  envVars: string[];
  imports: string[];
  params: string[];
  /** Optional prose requirements, each sharing one signal's weight in paramAccuracy. */
  unorderedRequirements?: UnorderedRequirement[];
  flowSteps: string[];
  antiPatterns: string[];
  hallucinations?: string[];
  /** Opt-in bounded Widgets recommendation contract; not a semantic judge. */
  widgetsRecommendation?: true;
}

export type WidgetsRecommendation = 'supported' | 'denied' | 'overclaim' | 'mixed' | 'unknown';

/** Scores for a single generation run (with or without skill) */
export interface ScoreCard {
  methodAccuracy: number;
  paramAccuracy: number;
  envVarCoverage: number;
  importAccuracy: number;
  flowCorrectness: number;
  antiPatternAvoidance: number;
  hallucinationCount: number;
  composite: number;
  widgetsRecommendation?: WidgetsRecommendation;
}

export type ErrorCategory =
  | 'hallucinated_method'
  | 'missing_method'
  | 'wrong_params'
  | 'missing_env_var'
  | 'wrong_flow_order'
  | 'incorrect_config'
  | 'missing_error_handling'
  | 'wrong_import'
  | 'security_issue'
  | 'incorrect_recommendation'
  | 'unverified_recommendation';

export interface TokenUsage {
  input: number;
  output: number;
}

/** Result of one eval case (both arms) */
export interface EvalResult {
  caseId: string;
  product: string;
  language?: string;
  skillType: 'generated' | 'hand-crafted';
  withSkill: { output: string; scores: ScoreCard; tokenUsage: TokenUsage };
  withoutSkill: { output: string; scores: ScoreCard; tokenUsage: TokenUsage };
  delta: number;
  topErrors: ErrorCategory[];
  withSkillErrors: ErrorCategory[];
  withoutSkillErrors: ErrorCategory[];
  sampleCount: number;
  withSkillStddev: number;
  withoutSkillStddev: number;
  deltaStddev: number;
  allSampleOutputs?: {
    withSkill: { output: string; composite: number }[];
    withoutSkill: { output: string; composite: number }[];
  };
}

/** Per-product aggregated summary */
export interface ProductSummary {
  product: string;
  caseCount: number;
  avgWithSkill: number;
  avgWithoutSkill: number;
  avgDelta: number;
  medianDelta: number;
  p80Delta: number;
  minDelta: number;
  maxDelta: number;
  topErrors: ErrorCategory[];
  skillType?: 'generated' | 'hand-crafted';
  avgDeltaStddev: number;
}

/** Exact, fixed Widgets bundle input; paths are relative to plugins/workos/skills. */
export interface SkillSource {
  path: string;
  content: string;
  sha256: string;
}

/** Full eval run report */
export interface EvalReport {
  runId: string;
  model: string;
  skillHash?: string;
  /** Present only for cases that explicitly load the shipped Widgets bundle. */
  widgetsSources?: SkillSource[];
  totalCases: number;
  results: EvalResult[];
  summary: ProductSummary[];
  languageBreakdown?: Record<
    string,
    {
      caseCount: number;
      avgWithSkill: number;
      avgWithoutSkill: number;
      avgDelta: number;
    }
  >;
}

/** CLI options */
export interface EvalOptions {
  product?: string;
  caseId?: string;
  caseIds?: string[];
  model: string;
  noCache: boolean;
  dryRun: boolean;
  concurrency: number;
  apiKey: string;
  lang?: string;
  reportFormat?: string;
  failOnRegression?: boolean;
  samples?: number;
  saveAllSamples?: boolean;
}
