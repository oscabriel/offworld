import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const sourceDir = resolve(process.cwd(), "../backend/convex/_generated");
const targetDir = resolve(process.cwd(), "dist/convex/_generated");
const files = ["api.js", "api.d.ts", "server.js", "server.d.ts", "dataModel.d.ts"];

async function copyGenerated(): Promise<void> {
	await mkdir(targetDir, { recursive: true });
	for (const file of files) {
		const sourcePath = resolve(sourceDir, file);
		const targetPath = resolve(targetDir, file);
		await copyFile(sourcePath, targetPath);
	}
}

copyGenerated().catch((error) => {
	console.error(error);
	process.exit(1);
});
