import {
	mkdirSync,
	writeFileSync,
	readFileSync,
	lstatSync,
	unlinkSync,
	rmSync,
	symlinkSync,
	existsSync,
} from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { loadConfig, toMetaDirName, toReferenceFileName } from "./config.js";
import { agents } from "./agents.js";
import { expandTilde, Paths } from "./paths.js";
import { readGlobalMap, writeGlobalMap } from "./index-manager.js";
import { getNpmKeywords } from "./dep-mappings.js";

const PackageJsonNameSchema = z.object({
	name: z.string().optional(),
});

export interface InstallReferenceMeta {
	/** ISO timestamp when the reference was generated */
	referenceUpdatedAt: string;
	/** Git commit SHA at time of generation */
	commitSha: string;
	/** SDK version used for generation */
	version: string;
}

function normalizeKeywords(values: string[]): string[] {
	const seen = new Set<string>();
	for (const value of values) {
		const normalized = value.trim().toLowerCase();
		if (normalized.length < 2) continue;
		seen.add(normalized);
	}
	return Array.from(seen);
}

function deriveMinimalKeywords(fullName: string): string[] {
	const normalized = fullName.trim().toLowerCase();
	if (!normalized) return [];

	const repoName = normalized.split("/").pop() ?? normalized;
	return normalizeKeywords([normalized, repoName]);
}

function getPackageName(localPath: string): string | null {
	const packageJsonPath = join(localPath, "package.json");
	if (!existsSync(packageJsonPath)) return null;

	try {
		const content = readFileSync(packageJsonPath, "utf-8");
		const json = JSON.parse(content);
		const parsed = PackageJsonNameSchema.safeParse(json);
		if (!parsed.success || !parsed.data.name) return null;
		return parsed.data.name;
	} catch {
		return null;
	}
}

/**
 * Resolve keywords with npm-first strategy.
 * - npm package: package name + npm keywords
 * - non-npm package: minimal repo-derived keywords
 */
export async function resolveReferenceKeywords(
	fullName: string,
	localPath: string,
): Promise<string[]> {
	const packageName = getPackageName(localPath);
	if (!packageName) {
		return deriveMinimalKeywords(fullName);
	}

	const npmKeywords = await getNpmKeywords(packageName);
	if (npmKeywords.length > 0) {
		return normalizeKeywords([packageName, ...npmKeywords]);
	}

	return normalizeKeywords([packageName]);
}

/**
 * Ensure a symlink exists, removing any existing file/directory at the path
 */
function ensureSymlink(target: string, linkPath: string): void {
	try {
		const stat = lstatSync(linkPath);
		if (stat.isSymbolicLink()) {
			unlinkSync(linkPath);
		} else if (stat.isDirectory()) {
			rmSync(linkPath, { recursive: true });
		} else {
			unlinkSync(linkPath);
		}
	} catch {}

	const linkDir = join(linkPath, "..");
	mkdirSync(linkDir, { recursive: true });
	symlinkSync(target, linkPath, "dir");
}

/**
 * Static template for the global SKILL.md file.
 * This is the single routing skill that all agents see.
 */
const GLOBAL_SKILL_TEMPLATE = `---
name: offworld
description: Routes queries to Offworld reference files. Find and read per-repo references for dependency knowledge.
allowed-tools: Bash(ow:*) Read
---

# Offworld Reference Router

Use \`ow\` to locate and read Offworld reference files for dependencies.

## What This Does

- Finds references for libraries and repos
- Returns paths for reference files and local clones
- Helps you read the right context fast

## When to Use

- You need docs or patterns for a dependency
- You want the verified reference instead of web search
- You are about to work inside a repo clone

## Installation and Setup

If Offworld CLI or opencode is missing, read \`references/installation.md\` in this skill directory and follow it.

## Usage

**Find a reference:**
\`\`\`bash
ow map search <term>     # search by name or keyword
ow map show <repo>       # get info for specific repo
\`\`\`

**Get paths for tools:**
\`\`\`bash
ow map show <repo> --ref   # reference file path (use with Read)
ow map show <repo> --path  # clone directory path
\`\`\`

**Example workflow:**
\`\`\`bash
# 1. Find the repo
ow map search zod

# 2. Get reference path
ow map show colinhacks/zod --ref
# Output: /Users/.../.local/share/offworld/skill/offworld/references/colinhacks-zod.md

# 3. Read the reference with the path from step 2
\`\`\`

## If Reference Not Found

\`\`\`bash
ow pull <owner/repo>    # clone + generate reference
ow project init         # scan project deps, install references
\`\`\`

## Notes

- Project map (\`.offworld/map.json\`) takes precedence over global map when present
- Reference files are markdown with API docs, patterns, best practices
- Clone paths useful for exploring source code after reading reference

## Additional Resources

- Docs: https://offworld.sh/cli
`;

const INSTALLATION_REFERENCE_TEMPLATE = `# Offworld Installation

Use this when Offworld CLI or opencode is not installed.

## 1) Check opencode

\`\`\`bash
opencode --version
\`\`\`

If missing:

\`\`\`bash
curl -fsSL https://opencode.ai/install | bash
\`\`\`

## 2) Check Offworld CLI

\`\`\`bash
ow --version
\`\`\`

If missing:

\`\`\`bash
curl -fsSL https://offworld.sh/install | bash
\`\`\`

## 3) Initialize Offworld (non-interactive)

\`\`\`bash
ow init --yes --agents "<agent-list>" --repo-root "<clone-dir>" --model "<provider/model>"
\`\`\`

Example:

\`\`\`bash
ow init --yes --agents "opencode,codex" --repo-root "~/ow" --model "anthropic/claude-sonnet-4-20250514"
\`\`\`

## 4) Initialize current project

\`\`\`bash
ow project init --yes --all
\`\`\`

## 5) Verify

\`\`\`bash
ow config show
ow list
\`\`\`
`;

/**
 * Ensures the global SKILL.md exists and symlinks the offworld/ directory to all agent skill directories.
 *
 * Creates:
 * - ~/.local/share/offworld/skill/offworld/SKILL.md (static routing template)
 * - ~/.local/share/offworld/skill/offworld/assets/ (for map.json)
 * - ~/.local/share/offworld/skill/offworld/references/ (for reference files)
 * - Symlinks entire offworld/ directory to each agent's skill directory
 */
export function installGlobalSkill(): void {
	const config = loadConfig();

	mkdirSync(Paths.offworldSkillDir, { recursive: true });
	mkdirSync(Paths.offworldAssetsDir, { recursive: true });
	mkdirSync(Paths.offworldReferencesDir, { recursive: true });

	const skillPath = join(Paths.offworldSkillDir, "SKILL.md");
	if (!existsSync(skillPath)) {
		writeFileSync(skillPath, GLOBAL_SKILL_TEMPLATE, "utf-8");
	}

	const installationReferencePath = join(Paths.offworldReferencesDir, "installation.md");
	if (!existsSync(installationReferencePath)) {
		writeFileSync(installationReferencePath, INSTALLATION_REFERENCE_TEMPLATE, "utf-8");
	}

	const configuredAgents = config.agents ?? [];
	for (const agentName of configuredAgents) {
		const agentConfig = agents[agentName];
		if (agentConfig) {
			const agentSkillDir = expandTilde(join(agentConfig.globalSkillsDir, "offworld"));
			ensureSymlink(Paths.offworldSkillDir, agentSkillDir);
		}
	}
}

/**
 * Install a reference file for a specific repository.
 *
 * Creates:
 * - ~/.local/share/offworld/skill/offworld/references/{owner-repo}.md
 * - ~/.local/share/offworld/meta/{owner-repo}/meta.json
 * - Updates global map with reference info
 *
 * @param qualifiedName - Qualified key for map storage (e.g., "github.com:owner/repo" or "local:name")
 * @param fullName - Full repo name for file naming (e.g., "owner/repo")
 * @param localPath - Absolute path to the cloned repository
 * @param referenceContent - The generated reference markdown content
 * @param meta - Metadata about the generation (referenceUpdatedAt, commitSha, version)
 * @param keywords - Optional array of keywords for search/routing
 */
export function installReference(
	qualifiedName: string,
	fullName: string,
	localPath: string,
	referenceContent: string,
	meta: InstallReferenceMeta,
	keywords?: string[],
): void {
	installGlobalSkill();

	const referenceFileName = toReferenceFileName(fullName);
	const metaDirName = toMetaDirName(fullName);

	const referencePath = join(Paths.offworldReferencesDir, referenceFileName);
	mkdirSync(Paths.offworldReferencesDir, { recursive: true });
	writeFileSync(referencePath, referenceContent, "utf-8");

	const metaDir = join(Paths.metaDir, metaDirName);
	mkdirSync(metaDir, { recursive: true });
	const metaJson = JSON.stringify(meta, null, 2);
	writeFileSync(join(metaDir, "meta.json"), metaJson, "utf-8");

	const map = readGlobalMap();
	const existingEntry = map.repos[qualifiedName];
	const legacyProviderMap: Record<string, string> = {
		"github.com": "github",
		"gitlab.com": "gitlab",
		"bitbucket.org": "bitbucket",
	};
	const [host] = qualifiedName.split(":");
	const legacyProvider = host ? legacyProviderMap[host] : undefined;
	const legacyQualifiedName = legacyProvider ? `${legacyProvider}:${fullName}` : undefined;
	const legacyEntry = legacyQualifiedName ? map.repos[legacyQualifiedName] : undefined;

	const references = [...(existingEntry?.references ?? []), ...(legacyEntry?.references ?? [])];
	if (!references.includes(referenceFileName)) {
		references.push(referenceFileName);
	}

	const derivedKeywords =
		keywords && keywords.length > 0 ? keywords : deriveMinimalKeywords(fullName);

	map.repos[qualifiedName] = {
		localPath,
		references,
		primary: referenceFileName,
		keywords: normalizeKeywords(derivedKeywords),
		updatedAt: new Date().toISOString(),
	};

	if (legacyQualifiedName && legacyQualifiedName in map.repos) {
		delete map.repos[legacyQualifiedName];
	}

	writeGlobalMap(map);
}
