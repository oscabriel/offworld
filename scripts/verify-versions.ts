import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();

const packages = [
	{ name: "apps/cli", path: join(ROOT, "apps/cli/package.json") },
	{ name: "packages/sdk", path: join(ROOT, "packages/sdk/package.json") },
	{ name: "packages/types", path: join(ROOT, "packages/types/package.json") },
];

async function main(): Promise<void> {
	const versions = new Map<string, string>();

	for (const pkg of packages) {
		const content = await readFile(pkg.path, "utf-8");
		const json = JSON.parse(content) as { version?: string };
		if (!json.version) {
			console.error(`Missing version in ${pkg.name}`);
			process.exit(1);
		}
		versions.set(pkg.name, json.version);
	}

	const unique = new Set(versions.values());
	if (unique.size > 1) {
		console.error("Version mismatch detected:");
		for (const [name, version] of versions) {
			console.error(`- ${name}: ${version}`);
		}
		process.exit(1);
	}

	const [version] = unique;
	console.log(`Versions in sync: ${version ?? "unknown"}`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
