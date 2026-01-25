import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
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
		const repoId = await runCtx.db.insert("repository", {
			...sampleRepo,
			...repoOverrides,
		});
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

describe("push", () => {
	it("returns auth_required when not authenticated", async () => {
		const ctx = t();

		const result = await ctx.mutation(api.analyses.push, {
			fullName: sampleRepo.fullName,
			skillName: sampleSkillData.skillName,
			skillDescription: sampleSkillData.skillDescription,
			skillContent: sampleSkillData.skillContent,
			commitSha: sampleSkillData.commitSha,
			analyzedAt: sampleSkillData.analyzedAt,
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe("auth_required");
		}
	});

	it("creates new skill when authenticated", async () => {
		const ctx = t();

		// Mock authenticated user
		const asUser = ctx.withIdentity({
			subject: "workos_test_user",
			email: "test@example.com",
		});

		const result = await asUser.mutation(api.analyses.push, {
			fullName: sampleRepo.fullName,
			skillName: sampleSkillData.skillName,
			skillDescription: sampleSkillData.skillDescription,
			skillContent: sampleSkillData.skillContent,
			commitSha: sampleSkillData.commitSha,
			analyzedAt: sampleSkillData.analyzedAt,
		});

		expect(result.success).toBe(true);

		// Verify skill was created
		const analysis = await ctx.query(api.analyses.pull, {
			fullName: "tanstack/router",
		});
		expect(analysis).not.toBeNull();
		expect(analysis?.fullName).toBe("tanstack/router");
	});

	it("updates existing skill when newer", async () => {
		const ctx = t();

		// Insert initial repo and skill
		await createRepoAndSkill(
			ctx,
			{},
			{
				analyzedAt: "2026-01-09T08:00:00.000Z", // Older
				pullCount: 10,
				isVerified: true,
			},
		);

		// Mock authenticated user
		const asUser = ctx.withIdentity({
			subject: "workos_test_user",
			email: "test@example.com",
		});

		// Update with newer skill
		const result = await asUser.mutation(api.analyses.push, {
			fullName: sampleRepo.fullName,
			skillName: sampleSkillData.skillName,
			skillDescription: sampleSkillData.skillDescription,
			skillContent: "# Updated Skill",
			commitSha: "newsha123",
			analyzedAt: "2026-01-09T12:00:00.000Z", // Newer
		});

		expect(result.success).toBe(true);

		// Verify skill was updated
		const analysis = await ctx.query(api.analyses.pull, {
			fullName: "tanstack/router",
		});
		expect(analysis?.skillContent).toBe("# Updated Skill");
		expect(analysis?.commitSha).toBe("newsha123");
	});

	it("rejects older skill over newer", async () => {
		const ctx = t();

		// Insert initial repo and skill with newer timestamp
		await createRepoAndSkill(
			ctx,
			{},
			{
				analyzedAt: "2026-01-09T12:00:00.000Z", // Newer
				pullCount: 0,
				isVerified: false,
			},
		);

		// Mock authenticated user
		const asUser = ctx.withIdentity({
			subject: "workos_test_user",
			email: "test@example.com",
		});

		// Try to update with older skill
		const result = await asUser.mutation(api.analyses.push, {
			fullName: sampleRepo.fullName,
			skillName: sampleSkillData.skillName,
			skillDescription: sampleSkillData.skillDescription,
			skillContent: sampleSkillData.skillContent,
			commitSha: sampleSkillData.commitSha,
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
		await ctx.run(async (runCtx) => {
			for (let i = 0; i < 3; i++) {
				await runCtx.db.insert("pushLog", {
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
			fullName: sampleRepo.fullName,
			skillName: sampleSkillData.skillName,
			skillDescription: sampleSkillData.skillDescription,
			skillContent: sampleSkillData.skillContent,
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
