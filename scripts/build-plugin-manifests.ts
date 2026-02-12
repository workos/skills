import {
  readdirSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  statSync,
} from "fs";
import { join } from "path";

const skillsDir = "skills";

/** Skills excluded from manifests (kept on disk but not shipped) */
const EXCLUDE_FROM_MANIFEST = new Set([
  "workos-fga",
  "workos-magic-link",
  "workos-pipes",
  "workos-domain-verification",
  "workos-feature-flags",
]);

/** Skills exposed as standalone plugins in manifests (visible in installer + system prompt) */
const EXPOSED_SKILLS = new Set([
  "workos",
  "workos-authkit-base",
  "workos-authkit-nextjs",
  "workos-authkit-react",
  "workos-authkit-react-router",
  "workos-authkit-tanstack-start",
  "workos-authkit-vanilla-js",
]);

const entries = readdirSync(skillsDir).sort();

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

// Only process directories (exposed skills use skills/{name}/SKILL.md format)
const dirs = entries.filter((e) => {
  try {
    return statSync(join(skillsDir, e)).isDirectory();
  } catch {
    return false;
  }
});

for (const dir of dirs) {
  // Non-exposed skill directories: clean up stale .claude-plugin/ dirs
  if (!EXPOSED_SKILLS.has(dir)) {
    rmSync(join(skillsDir, dir, ".claude-plugin"), {
      recursive: true,
      force: true,
    });
    continue;
  }

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
      "WorkOS plugin with router + AuthKit framework skills for authentication, enterprise features, migrations, and API integration",
  },
  plugins,
};

writeFileSync(
  ".claude-plugin/marketplace.json",
  JSON.stringify(marketplace, null, 2) + "\n",
);

const hiddenFiles = entries.filter(
  (e) => e.endsWith(".md") && !e.startsWith("."),
);
console.log(
  `Generated ${plugins.length} exposed plugin entries (${hiddenFiles.length} hidden docs on disk)`,
);
console.log(
  `Wrote marketplace.json + ${plugins.length} per-skill plugin.json files`,
);
