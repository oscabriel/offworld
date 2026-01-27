import { confirm, select, text } from "@clack/prompts";
import { execSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const CLI_PACKAGE_JSON_PATH = join(process.cwd(), "apps/cli/package.json");
const SDK_PACKAGE_JSON_PATH = join(process.cwd(), "packages/sdk/package.json");
const TYPES_PACKAGE_JSON_PATH = join(process.cwd(), "packages/types/package.json");
const BACKEND_API_PACKAGE_JSON_PATH = join(process.cwd(), "packages/backend-api/package.json");
const CLI_VERSION_PATH = join(process.cwd(), "apps/cli/src/index.ts");
const SDK_CONSTANTS_PATH = join(process.cwd(), "packages/sdk/src/constants.ts");

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const isDryRun = args.includes("--dry-run");
	let versionInput = args.find((arg) => !arg.startsWith("--"));

	if (!versionInput) {
		const bumpType = await select({
			message: "Release type?",
			options: [
				{ value: "patch", label: "Patch (x.y.z +1)" },
				{ value: "minor", label: "Minor (x.y+1.0)" },
				{ value: "major", label: "Major (x+1.0.0)" },
				{ value: "custom", label: "Custom version" },
			],
		});

		if (bumpType === "custom") {
			const customVersion = await text({
				message: "Version (x.y.z)",
				placeholder: "0.1.1",
			});
			versionInput = typeof customVersion === "string" ? customVersion : undefined;
		} else if (typeof bumpType === "string") {
			versionInput = bumpType;
		}

		if (!versionInput) {
			console.log("No version selected");
			process.exit(1);
		}
	}

	const cliPackageJson = JSON.parse(await readFile(CLI_PACKAGE_JSON_PATH, "utf-8"));
	const currentVersion = cliPackageJson.version as string;

	let newVersion = "";

	if (["major", "minor", "patch"].includes(versionInput)) {
		const [major = 0, minor = 0, patch = 0] = currentVersion.split(".").map(Number);

		switch (versionInput) {
			case "major":
				newVersion = `${major + 1}.0.0`;
				break;
			case "minor":
				newVersion = `${major}.${minor + 1}.0`;
				break;
			case "patch":
				newVersion = `${major}.${minor}.${patch + 1}`;
				break;
		}
	} else {
		if (!/^\d+\.\d+\.\d+$/.test(versionInput)) {
			console.error("Version must be x.y.z");
			process.exit(1);
		}
		newVersion = versionInput;
	}

	if (isDryRun) {
		console.log(`Would release v${newVersion} (dry run)`);
		return;
	}

	const statusResult = execSync("git status --porcelain", { encoding: "utf-8" });
	if (statusResult.trim()) {
		console.error("Uncommitted changes. Commit or stash first.");
		process.exit(1);
	}

	const sdkPackageJson = JSON.parse(await readFile(SDK_PACKAGE_JSON_PATH, "utf-8"));
	const typesPackageJson = JSON.parse(await readFile(TYPES_PACKAGE_JSON_PATH, "utf-8"));
	const backendApiPackageJson = JSON.parse(await readFile(BACKEND_API_PACKAGE_JSON_PATH, "utf-8"));

	cliPackageJson.version = newVersion;
	sdkPackageJson.version = newVersion;
	typesPackageJson.version = newVersion;
	backendApiPackageJson.version = newVersion;

	cliPackageJson.dependencies["@offworld/sdk"] = `^${newVersion}`;
	cliPackageJson.dependencies["@offworld/types"] = `^${newVersion}`;
	sdkPackageJson.dependencies["@offworld/types"] = `^${newVersion}`;
	sdkPackageJson.dependencies["@offworld/backend-api"] = `^${newVersion}`;

	await writeFile(CLI_PACKAGE_JSON_PATH, `${JSON.stringify(cliPackageJson, null, 2)}\n`);
	await writeFile(SDK_PACKAGE_JSON_PATH, `${JSON.stringify(sdkPackageJson, null, 2)}\n`);
	await writeFile(TYPES_PACKAGE_JSON_PATH, `${JSON.stringify(typesPackageJson, null, 2)}\n`);
	await writeFile(
		BACKEND_API_PACKAGE_JSON_PATH,
		`${JSON.stringify(backendApiPackageJson, null, 2)}\n`,
	);

	const cliVersionSource = await readFile(CLI_VERSION_PATH, "utf-8");
	await writeFile(
		CLI_VERSION_PATH,
		cliVersionSource.replace(
			/export const version = "[^"]+";/,
			`export const version = "${newVersion}";`,
		),
	);

	const sdkConstantsSource = await readFile(SDK_CONSTANTS_PATH, "utf-8");
	await writeFile(
		SDK_CONSTANTS_PATH,
		sdkConstantsSource.replace(
			/export const VERSION = "[^"]+";/,
			`export const VERSION = "${newVersion}";`,
		),
	);

	execSync("bun install", { stdio: "inherit" });
	execSync("bun run build:cli", { stdio: "inherit" });
	execSync(
		"git add apps/cli/package.json packages/sdk/package.json packages/types/package.json packages/backend-api/package.json apps/cli/src/index.ts packages/sdk/src/constants.ts bun.lock",
		{ stdio: "inherit" },
	);
	execSync(`git commit -m "chore(release): ${newVersion}"`, { stdio: "inherit" });

	const shouldRelease = await confirm({
		message: `Push and release v${newVersion}?`,
		initialValue: true,
	});

	if (shouldRelease) {
		execSync("git push", { stdio: "inherit" });
		execSync(`git tag v${newVersion}`, { stdio: "inherit" });
		execSync("git push --tags", { stdio: "inherit" });
		console.log(`\n✓ Released v${newVersion} — workflow triggered`);
	} else {
		console.log(
			`\nCommit created. To release later:\n  git push && git tag v${newVersion} && git push --tags`,
		);
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
