import { spawnSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';

interface TriageCase {
  caseId: string;
  riskScore?: number;
}

interface TriageReport {
  triageCases?: TriageCase[];
}

interface Options {
  cases?: string[];
  triagePath?: string;
  top: number;
  minRisk: number;
  samples: number;
  concurrency: number;
  model?: string;
  report: string;
  dryRun: boolean;
  noCache: boolean;
  saveAllSamples: boolean;
  failOnRegression: boolean;
}

const OUTPUT_DIR = join(process.cwd(), 'scripts', 'output');
const DEFAULT_CASES = [
  'authkit-ruby-rails',
  'sso-node-basic',
  'sso-ruby-idp-initiated',
  'sso-ruby-domain-routing',
  'rbac-python-role-assignment',
];

function argValue(args: string[], name: string): string | undefined {
  return args.find((arg) => arg.startsWith(`${name}=`))?.split('=')[1];
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function parseTop(raw: string | undefined): number {
  if (raw === 'all') return Number.POSITIVE_INFINITY;
  return parsePositiveInt(raw, 9);
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const cases = argValue(args, '--cases')
    ?.split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  return {
    cases,
    triagePath: argValue(args, '--triage'),
    top: parseTop(argValue(args, '--top')),
    minRisk: parsePositiveInt(argValue(args, '--min-risk'), 1),
    samples: parsePositiveInt(argValue(args, '--samples'), 8),
    concurrency: parsePositiveInt(argValue(args, '--concurrency'), 3),
    model: argValue(args, '--model'),
    report: argValue(args, '--report') ?? 'both',
    dryRun: args.includes('--dry-run'),
    noCache: !args.includes('--cache'),
    saveAllSamples: !args.includes('--no-save-all-samples'),
    failOnRegression: args.includes('--fail-on-regression'),
  };
}

function latestTriagePath(): string | undefined {
  if (!existsSync(OUTPUT_DIR)) return undefined;

  return readdirSync(OUTPUT_DIR)
    .filter((file) => file.startsWith('eval-triage-') && file.endsWith('.json'))
    .map((file) => join(OUTPUT_DIR, file))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

function readTriageCases(path: string, options: Options): string[] {
  const report = JSON.parse(readFileSync(path, 'utf8')) as TriageReport;
  const riskyCases = report.triageCases ?? [];
  const filtered = riskyCases.filter((entry) => (entry.riskScore ?? 0) >= options.minRisk).map((entry) => entry.caseId);
  return Number.isFinite(options.top) ? filtered.slice(0, options.top) : filtered;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function resolveCaseIds(options: Options): { caseIds: string[]; source: string } {
  if (options.cases?.length) {
    return { caseIds: unique(options.cases), source: '--cases' };
  }

  const triagePath = options.triagePath ? resolve(options.triagePath) : latestTriagePath();
  if (triagePath && existsSync(triagePath)) {
    const caseIds = unique(readTriageCases(triagePath, options));
    if (caseIds.length > 0) {
      return { caseIds, source: triagePath };
    }
  }

  return { caseIds: DEFAULT_CASES, source: 'built-in risky-case fallback' };
}

function shellQuote(value: string): string {
  return /^[a-zA-Z0-9_./:=,-]+$/.test(value) ? value : JSON.stringify(value);
}

function main() {
  const options = parseArgs();
  const { caseIds, source } = resolveCaseIds(options);

  const evalArgs = [
    'eval',
    '--',
    `--cases=${caseIds.join(',')}`,
    `--samples=${options.samples}`,
    `--concurrency=${options.concurrency}`,
    `--report=${options.report}`,
  ];

  if (options.noCache) evalArgs.push('--no-cache');
  if (options.saveAllSamples) evalArgs.push('--save-all-samples');
  if (options.model) evalArgs.push(`--model=${options.model}`);
  if (options.failOnRegression) evalArgs.push('--fail-on-regression');
  if (options.dryRun) evalArgs.push('--dry-run');

  console.log(`Selected ${caseIds.length} case(s) from ${source}:`);
  for (const caseId of caseIds) {
    console.log(`  - ${caseId}`);
  }
  console.log(`\nCommand:\n  pnpm ${evalArgs.map(shellQuote).join(' ')}\n`);

  if (options.dryRun) return;

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is required.');
    process.exit(1);
  }

  const result = spawnSync('pnpm', evalArgs, {
    stdio: 'inherit',
    env: process.env,
  });

  process.exit(result.status ?? 1);
}

main();
