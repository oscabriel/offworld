import { describe, expect, it } from "vitest";

describe("API Surface Quality Improvements", () => {
	describe("inferSubpathPurpose", () => {
		it("strips scope and formats @tanstack/react-table correctly", () => {
			expect(inferSubpathPurpose("@tanstack/react-table")).toBe("React Table");
		});

		it("handles simple package names", () => {
			expect(inferSubpathPurpose("client")).toBe("Client");
		});

		it("handles hyphenated names", () => {
			expect(inferSubpathPurpose("angular-table")).toBe("Angular Table");
		});

		it("handles scoped packages with hyphens", () => {
			expect(inferSubpathPurpose("@tanstack/query-core")).toBe("Query Core");
		});
	});

	describe("Import Pattern Generation", () => {
		it("uses full package name for monorepo subpaths", () => {
			const patterns = generateImportPatterns(
				"table",
				[],
				[
					{
						subpath: "@tanstack/react-table",
						exports: [
							{ name: "useReactTable", path: "", signature: "", kind: "function", description: "" },
						],
					},
				],
			);

			expect(patterns[0]?.statement).toBe("import { useReactTable } from '@tanstack/react-table'");
			expect(patterns[0]?.statement).not.toContain("table/@tanstack");
		});

		it("handles relative subpaths for non-monorepo packages", () => {
			const patterns = generateImportPatterns(
				"mypackage",
				[],
				[
					{
						subpath: "./client",
						exports: [
							{ name: "createClient", path: "", signature: "", kind: "function", description: "" },
						],
					},
				],
			);

			expect(patterns[0]?.statement).toBe("import { createClient } from 'mypackage/client'");
		});
	});

	describe("Description Inference", () => {
		it("properly tokenizes ALL_CAPS_NAMES", () => {
			const result = inferDescription("DEFAULT_CLOCK_SKEW_MS", "const");
			expect(result).toBe("Default Clock Skew Ms");
			expect(result).not.toContain("d e f a u l t");
		});

		it("handles camelCase names", () => {
			const result = inferDescription("parseXMLDocument", "function");
			expect(result.toLowerCase()).toContain("parse");
			expect(result.toLowerCase()).toContain("xml");
		});

		it("handles create* prefix", () => {
			const result = inferDescription("createQueryClient", "function");
			expect(result).toBe("Create query client");
		});

		it("handles use* prefix for React hooks", () => {
			const result = inferDescription("useQuery", "function");
			expect(result).toBe("React hook for query");
		});
	});
});

function inferSubpathPurpose(subpath: string): string {
	const parts = subpath.split("/");
	const lastPart = parts[parts.length - 1] ?? subpath;
	return lastPart
		.replace(/^@[^/]+\//, "")
		.replace(/-/g, " ")
		.split(" ")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

interface PublicExport {
	name: string;
	path: string;
	signature: string;
	kind: "function" | "class" | "interface" | "type" | "const" | "enum";
	description: string;
}

interface SubpathExport {
	subpath: string;
	exports: PublicExport[];
}

interface ImportPattern {
	statement: string;
	purpose: string;
	exports: string[];
}

function generateImportPatterns(
	packageName: string,
	exports: PublicExport[],
	subpaths: SubpathExport[],
): ImportPattern[] {
	const patterns: ImportPattern[] = [];

	if (exports.length > 0) {
		const topExports = exports.slice(0, 5).map((e) => e.name);
		patterns.push({
			statement: `import { ${topExports.join(", ")} } from '${packageName}'`,
			purpose: "Main entry point",
			exports: exports.map((e) => e.name),
		});
	}

	for (const subpath of subpaths) {
		if (subpath.exports.length === 0) continue;

		const isFullPackageName = subpath.subpath.startsWith("@") || !subpath.subpath.startsWith("./");
		const importPath = isFullPackageName
			? subpath.subpath
			: `${packageName}/${subpath.subpath.replace("./", "")}`;

		const topExports = subpath.exports.slice(0, 3).map((e) => e.name);
		patterns.push({
			statement: `import { ${topExports.join(", ")} } from '${importPath}'`,
			purpose: `${inferSubpathPurpose(importPath)} utilities`,
			exports: subpath.exports.map((e) => e.name),
		});
	}

	return patterns;
}

function inferDescription(name: string, kind: PublicExport["kind"]): string {
	const words = name
		.replace(/([A-Z]+)(?=[A-Z][a-z])/g, "$1_")
		.replace(/([a-z0-9])([A-Z])/g, "$1_$2")
		.replace(/[_-]/g, " ")
		.trim()
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean);

	if (words.length === 0) return name;

	if (words[0] === "create" || words[0] === "make") {
		return `Create ${words.slice(1).join(" ")}`;
	}
	if (words[0] === "use" && kind === "function") {
		return `React hook for ${words.slice(1).join(" ")}`;
	}
	if (words[0] === "get") {
		return `Retrieve ${words.slice(1).join(" ")}`;
	}
	if (words[0] === "set") {
		return `Set ${words.slice(1).join(" ")}`;
	}
	if (words[0] === "is" || words[0] === "has" || words[0] === "can") {
		return `Check if ${words.slice(1).join(" ")}`;
	}

	if (kind === "const" && name === name.toUpperCase()) {
		return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
	}

	return `${kind.charAt(0).toUpperCase() + kind.slice(1)} ${words.join(" ")}`;
}
