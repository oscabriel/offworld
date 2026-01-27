import { mkdir, copyFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(scriptDir, "..");
const repoRoot = resolve(packageDir, "..", "..");
const sourceDir = join(repoRoot, "packages/backend/convex/_generated");
const targetDir = join(repoRoot, "packages/backend-api/dist/_generated");

const files = ["api.js", "api.d.ts", "server.js", "server.d.ts", "dataModel.d.ts"];

async function copyGenerated(): Promise<void> {
	await mkdir(targetDir, { recursive: true });
	await Promise.all(files.map((file) => copyFile(join(sourceDir, file), join(targetDir, file))));
}

copyGenerated().catch((error) => {
	console.error(error);
	process.exit(1);
});
