import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";

// Use import.meta.glob to load modules for convex-test
const modules = import.meta.glob("../**/*.ts");

const t = () => convexTest(schema, modules);

/**
 * Unit tests for Convex skill functions
 */

// Sample repository data
const sampleRepo = {
	fullName: "tanstack/router",
	owner: "tanstack",
	name: "router",
	description: "TanStack Router - fully type-safe router for React",
	stars: 1000,
	language: "TypeScript",
	defaultBranch: "main",
	githubUrl: "https://github.com/tanstack/router",
	fetchedAt: "2026-01-09T10:00:00.000Z",
};

// Sample skill data for testing (without repositoryId - added dynamically)
const sampleSkillData = {
	skillName: "tanstack-router",
	skillDescription: "TanStack Router skill",
	skillContent: "# TanStack Router\n\nA fully type-safe router for React.",
	commitSha: "abc123def456",
	analyzedAt: "2026-01-09T10:00:00.000Z",
};

// Helper to create repo and skill together
async function createRepoAndSkill(
	ctx: ReturnType<typeof t>,
	repoOverrides: Partial<typeof sampleRepo> = {},
	skillOverrides: Partial<typeof sampleSkillData & { pullCount: number; isVerified: boolean }> = {},
) {
	return await ctx.run(async (runCtx) => {
		const repoData = { ...sampleRepo, ...repoOverrides };
		const repoId = await runCtx.db.insert("repository", repoData);
		const skillId = await runCtx.db.insert("skill", {
			repositoryId: repoId,
			...sampleSkillData,
			pullCount: 0,
			isVerified: false,
			...skillOverrides,
		});
		return { repoId, skillId };
	});
}

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

		await createRepoAndSkill(ctx);

		const result = await ctx.query(api.analyses.pull, {
			fullName: "tanstack/router",
		});

		expect(result).not.toBeNull();
		expect(result?.fullName).toBe("tanstack/router");
		expect(result?.skillContent).toContain("TanStack Router");
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

		await createRepoAndSkill(ctx, {}, { pullCount: 42, isVerified: true });

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

describe("pushInternal", () => {
	// Note: The public push action validates via GitHub API (tested separately)
	// These tests verify the internal mutation behavior

	it("creates new skill", async () => {
		const ctx = t();

		const result = await ctx.mutation(internal.analyses.pushInternal, {
			fullName: sampleRepo.fullName,
			skillName: sampleSkillData.skillName,
			skillDescription: sampleSkillData.skillDescription,
			skillContent: sampleSkillData.skillContent,
			commitSha: sampleSkillData.commitSha,
			analyzedAt: sampleSkillData.analyzedAt,
			workosId: "workos_test_user",
		});

		expect(result.success).toBe(true);

		// Verify skill was created
		const analysis = await ctx.query(api.analyses.pull, {
			fullName: "tanstack/router",
		});
		expect(analysis).not.toBeNull();
		expect(analysis?.fullName).toBe("tanstack/router");
	});

	it("rejects duplicate commit (immutability)", async () => {
		const ctx = t();

		// Create initial skill
		await createRepoAndSkill(ctx);

		// Try to push same commit again
		const result = await ctx.mutation(internal.analyses.pushInternal, {
			fullName: sampleRepo.fullName,
			skillName: sampleSkillData.skillName,
			skillDescription: sampleSkillData.skillDescription,
			skillContent: "# Updated Content",
			commitSha: sampleSkillData.commitSha, // Same commit SHA
			analyzedAt: new Date().toISOString(),
			workosId: "workos_test_user",
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe("commit_already_exists");
		}
	});

	it("allows different commit for same repo", async () => {
		const ctx = t();

		// Create initial skill
		await createRepoAndSkill(ctx);

		// Push with different commit SHA
		const result = await ctx.mutation(internal.analyses.pushInternal, {
			fullName: sampleRepo.fullName,
			skillName: sampleSkillData.skillName,
			skillDescription: sampleSkillData.skillDescription,
			skillContent: "# Updated Content",
			commitSha: "different123sha456789012345678901234567890", // Different commit (40 chars)
			analyzedAt: new Date().toISOString(),
			workosId: "workos_test_user",
		});

		expect(result.success).toBe(true);
	});

	it("enforces rate limit (20/day/user)", async () => {
		const ctx = t();

		const workosId = "workos_test_user";

		// Add 20 push logs for this user
		await ctx.run(async (runCtx) => {
			for (let i = 0; i < 20; i++) {
				await runCtx.db.insert("pushLog", {
					fullName: `repo${i}/test`,
					workosId,
					pushedAt: new Date().toISOString(),
					commitSha: `commit${i}${"0".repeat(33)}`,
				});
			}
		});

		// 21st push should be rate limited
		const result = await ctx.mutation(internal.analyses.pushInternal, {
			fullName: sampleRepo.fullName,
			skillName: sampleSkillData.skillName,
			skillDescription: sampleSkillData.skillDescription,
			skillContent: sampleSkillData.skillContent,
			commitSha: "newcommit1234567890123456789012345678901",
			analyzedAt: new Date().toISOString(),
			workosId,
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe("rate_limit");
		}
	});

	it("creates user if not exists", async () => {
		const ctx = t();

		const newWorkosId = "new_workos_user";

		await ctx.mutation(internal.analyses.pushInternal, {
			fullName: sampleRepo.fullName,
			skillName: sampleSkillData.skillName,
			skillDescription: sampleSkillData.skillDescription,
			skillContent: sampleSkillData.skillContent,
			commitSha: sampleSkillData.commitSha,
			analyzedAt: sampleSkillData.analyzedAt,
			workosId: newWorkosId,
		});

		// Verify user was created
		const user = await ctx.run(async (runCtx) => {
			return await runCtx.db
				.query("user")
				.withIndex("by_workosId", (q) => q.eq("workosId", newWorkosId))
				.first();
		});

		expect(user).not.toBeNull();
		expect(user?.workosId).toBe(newWorkosId);
	});
});

describe("get", () => {
	it("returns full skill for web app", async () => {
		const ctx = t();

		await createRepoAndSkill(ctx, {}, { pullCount: 42, isVerified: true });

		const result = await ctx.query(api.analyses.get, {
			fullName: "tanstack/router",
		});

		expect(result).not.toBeNull();
		expect(result?.pullCount).toBe(42);
		expect(result?.isVerified).toBe(true);
	});
});

describe("list", () => {
	it("returns skills sorted by pullCount", async () => {
		const ctx = t();

		await ctx.run(async (runCtx) => {
			const lowRepoId = await runCtx.db.insert("repository", {
				...sampleRepo,
				fullName: "repo/low",
				owner: "repo",
				name: "low",
			});
			await runCtx.db.insert("skill", {
				repositoryId: lowRepoId,
				...sampleSkillData,
				pullCount: 5,
				isVerified: false,
			});

			const highRepoId = await runCtx.db.insert("repository", {
				...sampleRepo,
				fullName: "repo/high",
				owner: "repo",
				name: "high",
			});
			await runCtx.db.insert("skill", {
				repositoryId: highRepoId,
				...sampleSkillData,
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
