import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const skillsDir = "skills";
const dirs = readdirSync(skillsDir).sort();

interface PluginEntry {
  name: string;
  description: string;
  version: string;
  author: { name: string; email: string };
  source?: string;
  homepage: string;
  repository: string;
  license: string;
  category: string;
  keywords: string[];
}

const plugins: PluginEntry[] = [];

for (const dir of dirs) {
  const skillPath = join(skillsDir, dir, "SKILL.md");
  let content: string;
  try {
    content = readFileSync(skillPath, "utf8");
  } catch {
    continue;
  }

  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) continue;
  const fm = fmMatch[1];
  const nameMatch = fm.match(/^name:\s*(.+)$/m);
  const descMatch = fm.match(/^description:\s*(.+)$/m);
  if (!nameMatch || !descMatch) continue;

  const name = nameMatch[1].trim();
  const description = descMatch[1].trim();

  const keywords = name
    .replace("workos-", "")
    .split("-")
    .filter((w) => w.length > 1);
  keywords.unshift("workos");
  if (name.includes("authkit")) keywords.push("authentication");
  if (name.includes("sso")) keywords.push("saml", "oidc");
  if (name.includes("migrate")) keywords.push("migration");
  if (name.includes("api-")) keywords.push("api-reference");

  let category = "enterprise";
  if (
    name.includes("authkit") ||
    name.includes("sso") ||
    name.includes("mfa") ||
    name.includes("magic-link")
  ) {
    category = "authentication";
  } else if (name.includes("migrate")) {
    category = "migration";
  } else if (name.includes("api-")) {
    category = "api-reference";
  }

  const plugin: PluginEntry = {
    name,
    description,
    version: "0.1.0",
    author: { name: "WorkOS", email: "support@workos.com" },
    source: `./skills/${dir}`,
    homepage: "https://workos.com/docs",
    repository: "https://github.com/workos/skills",
    license: "MIT",
    category,
    keywords: [...new Set(keywords)],
  };
  plugins.push(plugin);

  // Write per-skill plugin.json
  const pluginDir = join(skillsDir, dir, ".claude-plugin");
  mkdirSync(pluginDir, { recursive: true });
  const perSkill = { ...plugin };
  delete perSkill.source;
  writeFileSync(
    join(pluginDir, "plugin.json"),
    JSON.stringify(perSkill, null, 2) + "\n",
  );
}

// Write marketplace.json
const marketplace = {
  $schema: "https://anthropic.com/claude-code/marketplace.schema.json",
  name: "workos-skills",
  description:
    "Official WorkOS skills for AI coding agents — AuthKit, SSO, Directory Sync, RBAC, Vault, Migrations, and API references",
  owner: { name: "WorkOS", email: "support@workos.com" },
  metadata: {
    version: "0.1.0",
    description:
      "Complete WorkOS toolkit with 44 skills for authentication, enterprise features, migrations, and API integration",
  },
  plugins,
};

writeFileSync(
  ".claude-plugin/marketplace.json",
  JSON.stringify(marketplace, null, 2) + "\n",
);

console.log(`Generated ${plugins.length} plugin entries`);
console.log(
  `Wrote marketplace.json + ${plugins.length} per-skill plugin.json files`,
);
