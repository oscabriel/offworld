import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

// Use import.meta.glob to load modules for convex-test
const modules = import.meta.glob("../**/*.ts");

const t = () => convexTest(schema, modules);

/**
 * Unit tests for Convex analyses functions
 */

// Sample analysis data for testing
const sampleAnalysis = {
	fullName: "tanstack/router",
	provider: "github",
	summary: "# TanStack Router\n\nA fully type-safe router for React.",
	architecture: {
		projectType: "library",
		entities: [
			{
				name: "router-core",
				type: "package",
				path: "packages/router-core",
				description: "Core routing logic",
				responsibilities: ["URL matching", "Route definitions"],
				exports: ["createRouter", "Route"],
				dependencies: [],
			},
		],
		relationships: [{ from: "router-core", to: "utils", type: "imports" }],
		keyFiles: [{ path: "src/index.ts", role: "entry", description: "Main export" }],
		patterns: {
			framework: "React",
			buildTool: "Vite",
			testFramework: "Vitest",
		},
	},
	skill: {
		name: "tanstack-router",
		description: "TanStack Router skill",
		allowedTools: ["Read", "Glob", "Grep"],
		repositoryStructure: [{ path: "packages/", purpose: "Monorepo packages" }],
		keyFiles: [{ path: "src/index.ts", description: "Main entry point" }],
		searchStrategies: ["grep for createRouter"],
		whenToUse: ["When working with TanStack Router"],
	},
	fileIndex: [
		{
			path: "src/index.ts",
			importance: 0.9,
			type: "entry",
			exports: ["createRouter"],
			imports: ["./router"],
		},
	],
	commitSha: "abc123def456",
	analyzedAt: "2026-01-09T10:00:00.000Z",
	version: "0.1.0",
};

describe("pull", () => {
	it("returns null for missing repo", async () => {
		const ctx = t();

		const result = await ctx.query(api.analyses.pull, {
			fullName: "nonexistent/repo",
		});

		expect(result).toBeNull();
	});

	it("returns analysis for existing repo", async () => {
		const ctx = t();

		// Insert test data directly
		await ctx.run(async (ctx) => {
			await ctx.db.insert("analyses", {
				...sampleAnalysis,
				pullCount: 0,
				isVerified: false,
			});
		});

		const result = await ctx.query(api.analyses.pull, {
			fullName: "tanstack/router",
		});

		expect(result).not.toBeNull();
		expect(result?.fullName).toBe("tanstack/router");
		expect(result?.summary).toContain("TanStack Router");
		expect(result?.commitSha).toBe("abc123def456");
	});
});

describe("check", () => {
	it("returns exists: false for missing repo", async () => {
		const ctx = t();

		const result = await ctx.query(api.analyses.check, {
			fullName: "nonexistent/repo",
		});

		expect(result.exists).toBe(false);
	});

	it("returns commitSha and analyzedAt when exists", async () => {
		const ctx = t();

		await ctx.run(async (ctx) => {
			await ctx.db.insert("analyses", {
				...sampleAnalysis,
				pullCount: 42,
				isVerified: true,
			});
		});

		const result = await ctx.query(api.analyses.check, {
			fullName: "tanstack/router",
		});

		expect(result.exists).toBe(true);
		if (result.exists) {
			expect(result.commitSha).toBe("abc123def456");
			expect(result.analyzedAt).toBe("2026-01-09T10:00:00.000Z");
		}
	});
});

describe("push", () => {
	it("returns auth_required when not authenticated", async () => {
		const ctx = t();

		const result = await ctx.mutation(api.analyses.push, {
			fullName: sampleAnalysis.fullName,
			summary: sampleAnalysis.summary,
			architecture: sampleAnalysis.architecture,
			skill: sampleAnalysis.skill,
			fileIndex: sampleAnalysis.fileIndex,
			commitSha: sampleAnalysis.commitSha,
			analyzedAt: sampleAnalysis.analyzedAt,
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe("auth_required");
		}
	});

	it("creates new analysis when authenticated", async () => {
		const ctx = t();

		// Mock authenticated user
		const asUser = ctx.withIdentity({
			subject: "workos_test_user",
			email: "test@example.com",
		});

		const result = await asUser.mutation(api.analyses.push, {
			fullName: sampleAnalysis.fullName,
			summary: sampleAnalysis.summary,
			architecture: sampleAnalysis.architecture,
			skill: sampleAnalysis.skill,
			fileIndex: sampleAnalysis.fileIndex,
			commitSha: sampleAnalysis.commitSha,
			analyzedAt: sampleAnalysis.analyzedAt,
		});

		expect(result.success).toBe(true);

		// Verify analysis was created
		const analysis = await ctx.query(api.analyses.pull, {
			fullName: "tanstack/router",
		});
		expect(analysis).not.toBeNull();
		expect(analysis?.fullName).toBe("tanstack/router");
	});

	it("updates existing analysis when newer", async () => {
		const ctx = t();

		// Insert initial analysis
		await ctx.run(async (ctx) => {
			await ctx.db.insert("analyses", {
				...sampleAnalysis,
				analyzedAt: "2026-01-09T08:00:00.000Z", // Older
				pullCount: 10,
				isVerified: true,
			});
		});

		// Mock authenticated user
		const asUser = ctx.withIdentity({
			subject: "workos_test_user",
			email: "test@example.com",
		});

		// Update with newer analysis
		const result = await asUser.mutation(api.analyses.push, {
			fullName: sampleAnalysis.fullName,
			summary: "# Updated Summary",
			architecture: sampleAnalysis.architecture,
			skill: sampleAnalysis.skill,
			fileIndex: sampleAnalysis.fileIndex,
			commitSha: "newsha123",
			analyzedAt: "2026-01-09T12:00:00.000Z", // Newer
		});

		expect(result.success).toBe(true);

		// Verify analysis was updated
		const analysis = await ctx.query(api.analyses.pull, {
			fullName: "tanstack/router",
		});
		expect(analysis?.summary).toBe("# Updated Summary");
		expect(analysis?.commitSha).toBe("newsha123");
	});

	it("rejects older analysis over newer", async () => {
		const ctx = t();

		// Insert initial analysis with newer timestamp
		await ctx.run(async (ctx) => {
			await ctx.db.insert("analyses", {
				...sampleAnalysis,
				analyzedAt: "2026-01-09T12:00:00.000Z", // Newer
				pullCount: 0,
				isVerified: false,
			});
		});

		// Mock authenticated user
		const asUser = ctx.withIdentity({
			subject: "workos_test_user",
			email: "test@example.com",
		});

		// Try to update with older analysis
		const result = await asUser.mutation(api.analyses.push, {
			fullName: sampleAnalysis.fullName,
			summary: sampleAnalysis.summary,
			architecture: sampleAnalysis.architecture,
			skill: sampleAnalysis.skill,
			fileIndex: sampleAnalysis.fileIndex,
			commitSha: sampleAnalysis.commitSha,
			analyzedAt: "2026-01-09T08:00:00.000Z", // Older
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe("conflict");
		}
	});

	it("enforces rate limit (3/repo/day)", async () => {
		const ctx = t();

		const workosId = "workos_test_user";

		// Add 3 push logs
		await ctx.run(async (ctx) => {
			for (let i = 0; i < 3; i++) {
				await ctx.db.insert("pushLogs", {
					fullName: "tanstack/router",
					workosId,
					pushedAt: new Date().toISOString(),
					commitSha: `commit${i}`,
				});
			}
		});

		// Mock authenticated user
		const asUser = ctx.withIdentity({
			subject: workosId,
			email: "test@example.com",
		});

		// 4th push should be rate limited
		const result = await asUser.mutation(api.analyses.push, {
			fullName: sampleAnalysis.fullName,
			summary: sampleAnalysis.summary,
			architecture: sampleAnalysis.architecture,
			skill: sampleAnalysis.skill,
			fileIndex: sampleAnalysis.fileIndex,
			commitSha: "newcommit",
			analyzedAt: new Date().toISOString(),
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe("rate_limit");
		}
	});
});

describe("get", () => {
	it("returns full analysis for web app", async () => {
		const ctx = t();

		await ctx.run(async (ctx) => {
			await ctx.db.insert("analyses", {
				...sampleAnalysis,
				pullCount: 42,
				isVerified: true,
			});
		});

		const result = await ctx.query(api.analyses.get, {
			fullName: "tanstack/router",
		});

		expect(result).not.toBeNull();
		expect(result?.fullName).toBe("tanstack/router");
		expect(result?.pullCount).toBe(42);
		expect(result?.isVerified).toBe(true);
	});
});

describe("list", () => {
	it("returns analyses sorted by pullCount", async () => {
		const ctx = t();

		await ctx.run(async (ctx) => {
			await ctx.db.insert("analyses", {
				...sampleAnalysis,
				fullName: "repo/low",
				pullCount: 5,
				isVerified: false,
			});
			await ctx.db.insert("analyses", {
				...sampleAnalysis,
				fullName: "repo/high",
				pullCount: 100,
				isVerified: true,
			});
		});

		const result = await ctx.query(api.analyses.list, {});

		expect(result.length).toBe(2);
		expect(result[0].fullName).toBe("repo/high");
		expect(result[1].fullName).toBe("repo/low");
	});
});
