import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";

// Use import.meta.glob to load modules for convex-test
const modules = import.meta.glob("../**/*.ts");

const t = () => convexTest(schema, modules);

/**
 * PRD T7.1: Unit tests for Convex functions
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

describe("getByRepo", () => {
	it("returns null for missing repo", async () => {
		const ctx = t();

		const result = await ctx.query(internal.analyses.getByRepo, {
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

		const result = await ctx.query(internal.analyses.getByRepo, {
			fullName: "tanstack/router",
		});

		expect(result).not.toBeNull();
		expect(result?.fullName).toBe("tanstack/router");
		expect(result?.summary).toContain("TanStack Router");
		expect(result?.commitSha).toBe("abc123def456");
	});
});

describe("getMeta", () => {
	it("returns null for missing repo", async () => {
		const ctx = t();

		const result = await ctx.query(internal.analyses.getMeta, {
			fullName: "nonexistent/repo",
		});

		expect(result).toBeNull();
	});

	it("returns only commitSha and analyzedAt", async () => {
		const ctx = t();

		await ctx.run(async (ctx) => {
			await ctx.db.insert("analyses", {
				...sampleAnalysis,
				pullCount: 42,
				isVerified: true,
			});
		});

		const result = await ctx.query(internal.analyses.getMeta, {
			fullName: "tanstack/router",
		});

		expect(result).not.toBeNull();
		expect(result?.commitSha).toBe("abc123def456");
		expect(result?.analyzedAt).toBe("2026-01-09T10:00:00.000Z");
		expect(result?.pullCount).toBe(42);
		// Should NOT contain full analysis data
		expect((result as unknown as Record<string, unknown>).summary).toBeUndefined();
		expect((result as unknown as Record<string, unknown>).architecture).toBeUndefined();
	});
});

describe("incrementPullCount", () => {
	it("increases count by 1", async () => {
		const ctx = t();

		await ctx.run(async (ctx) => {
			await ctx.db.insert("analyses", {
				...sampleAnalysis,
				pullCount: 5,
				isVerified: false,
			});
		});

		const result = await ctx.mutation(internal.analyses.incrementPullCount, {
			fullName: "tanstack/router",
		});

		expect(result).toBe(true);

		// Verify count was incremented
		const analysis = await ctx.query(internal.analyses.getByRepo, {
			fullName: "tanstack/router",
		});
		expect(analysis?.pullCount).toBe(6);
	});

	it("returns false for missing repo", async () => {
		const ctx = t();

		const result = await ctx.mutation(internal.analyses.incrementPullCount, {
			fullName: "nonexistent/repo",
		});

		expect(result).toBe(false);
	});
});

describe("upsert", () => {
	it("creates new analysis when not exists", async () => {
		const ctx = t();

		const result = await ctx.mutation(internal.analyses.upsert, {
			...sampleAnalysis,
		});

		expect(result.success).toBe(true);

		// Verify analysis was created
		const analysis = await ctx.query(internal.analyses.getByRepo, {
			fullName: "tanstack/router",
		});
		expect(analysis).not.toBeNull();
		expect(analysis?.fullName).toBe("tanstack/router");
		expect(analysis?.pullCount).toBe(0); // Initial count
		expect(analysis?.isVerified).toBe(false); // Initial verification
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

		// Update with newer analysis
		const result = await ctx.mutation(internal.analyses.upsert, {
			...sampleAnalysis,
			analyzedAt: "2026-01-09T12:00:00.000Z", // Newer
			commitSha: "newsha123",
			summary: "# Updated Summary",
		});

		expect(result.success).toBe(true);

		// Verify analysis was updated
		const analysis = await ctx.query(internal.analyses.getByRepo, {
			fullName: "tanstack/router",
		});
		expect(analysis?.summary).toBe("# Updated Summary");
		expect(analysis?.commitSha).toBe("newsha123");
		expect(analysis?.pullCount).toBe(10); // Preserved
		expect(analysis?.isVerified).toBe(true); // Preserved
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

		// Try to update with older analysis
		const result = await ctx.mutation(internal.analyses.upsert, {
			...sampleAnalysis,
			analyzedAt: "2026-01-09T08:00:00.000Z", // Older
		});

		expect(result.success).toBe(false);
		expect(result.error).toBe("conflict");
		expect(result.message).toContain("newer analysis already exists");
	});

	it("rejects different analysis for same commit", async () => {
		const ctx = t();

		// Insert initial analysis
		await ctx.run(async (ctx) => {
			await ctx.db.insert("analyses", {
				...sampleAnalysis,
				analyzedAt: "2026-01-09T10:00:00.000Z",
				commitSha: "samecommit123",
				pullCount: 0,
				isVerified: false,
			});
		});

		// Try to push different analysis for same commit
		const result = await ctx.mutation(internal.analyses.upsert, {
			...sampleAnalysis,
			analyzedAt: "2026-01-09T11:00:00.000Z", // Different time
			commitSha: "samecommit123", // Same commit
		});

		expect(result.success).toBe(false);
		expect(result.error).toBe("conflict");
		expect(result.message).toContain("different analysis exists");
	});

	it("enforces rate limit (3/repo/day)", async () => {
		const ctx = t();

		// Create a user first
		await ctx.run(async (ctx) => {
			await ctx.db.insert("users", {
				email: "test@example.com",
				createdAt: new Date().toISOString(),
			});
		});

		// Get the actual user ID for mutations
		const userIdTyped = await ctx.run(async (ctx) => {
			const user = await ctx.db
				.query("users")
				.filter((q) => q.eq(q.field("email"), "test@example.com"))
				.first();
			return user!._id;
		});

		// Push 3 times (should succeed)
		for (let i = 0; i < 3; i++) {
			await ctx.run(async (ctx) => {
				await ctx.db.insert("pushLogs", {
					fullName: "tanstack/router",
					userId: userIdTyped,
					pushedAt: new Date().toISOString(),
					commitSha: `commit${i}`,
				});
			});
		}

		// 4th push should be rate limited
		const result = await ctx.mutation(internal.analyses.upsert, {
			...sampleAnalysis,
			userId: userIdTyped,
		});

		expect(result.success).toBe(false);
		expect(result.error).toBe("rate_limit");
		expect(result.message).toContain("3 times per repository per day");
	});
});

describe("remove", () => {
	it("deletes existing analysis", async () => {
		const ctx = t();

		await ctx.run(async (ctx) => {
			await ctx.db.insert("analyses", {
				...sampleAnalysis,
				pullCount: 0,
				isVerified: false,
			});
		});

		const result = await ctx.mutation(internal.analyses.remove, {
			fullName: "tanstack/router",
		});

		expect(result).toBe(true);

		// Verify analysis was deleted
		const analysis = await ctx.query(internal.analyses.getByRepo, {
			fullName: "tanstack/router",
		});
		expect(analysis).toBeNull();
	});

	it("returns false for missing repo", async () => {
		const ctx = t();

		const result = await ctx.mutation(internal.analyses.remove, {
			fullName: "nonexistent/repo",
		});

		expect(result).toBe(false);
	});
});

describe("getPushCountToday", () => {
	it("counts only pushes within 24 hours", async () => {
		const ctx = t();

		// Create a user
		const userId = await ctx.run(async (ctx) => {
			const id = await ctx.db.insert("users", {
				email: "test@example.com",
				createdAt: new Date().toISOString(),
			});
			return id;
		});

		const now = new Date();
		const yesterday = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago

		// Add old push (should not count)
		await ctx.run(async (ctx) => {
			await ctx.db.insert("pushLogs", {
				fullName: "tanstack/router",
				userId,
				pushedAt: yesterday.toISOString(),
				commitSha: "oldcommit",
			});
		});

		// Add recent pushes (should count)
		await ctx.run(async (ctx) => {
			await ctx.db.insert("pushLogs", {
				fullName: "tanstack/router",
				userId,
				pushedAt: now.toISOString(),
				commitSha: "commit1",
			});
			await ctx.db.insert("pushLogs", {
				fullName: "tanstack/router",
				userId,
				pushedAt: now.toISOString(),
				commitSha: "commit2",
			});
		});

		const count = await ctx.query(internal.analyses.getPushCountToday, {
			fullName: "tanstack/router",
			userId,
		});

		expect(count).toBe(2); // Only recent pushes
	});
});
