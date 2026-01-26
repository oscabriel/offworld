import { describe, expect, it } from "vitest";
import {
	AnalysisMetaSchema,
	ArchitectureSchema,
	ConfigSchema,
	EntitySchema,
	EntityTypeSchema,
	FileIndexEntrySchema,
	FileIndexSchema,
	FileRoleSchema,
	GitProviderSchema,
	LocalRepoSourceSchema,
	ProjectTypeSchema,
	RemoteRepoSourceSchema,
	RepoSourceSchema,
	ReferenceDataSchema,
	GlobalMapSchema,
	ProjectMapSchema,
} from "../schemas.js";

describe("ConfigSchema", () => {
	it("validates valid config objects", () => {
		const config = {
			repoRoot: "/custom/path",
			defaultShallow: false,
		};
		const result = ConfigSchema.safeParse(config);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.repoRoot).toBe("/custom/path");
		}
	});

	it("rejects invalid config (wrong types)", () => {
		const invalid = {
			repoRoot: 123,
			defaultShallow: "yes",
		};
		const result = ConfigSchema.safeParse(invalid);
		expect(result.success).toBe(false);
	});

	it("applies defaults correctly", () => {
		const empty = {};
		const result = ConfigSchema.safeParse(empty);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.repoRoot).toBe("~/ow");
			expect(result.data.defaultShallow).toBe(true);
		}
	});
});

describe("GitProviderSchema", () => {
	it("accepts github", () => {
		expect(GitProviderSchema.safeParse("github").success).toBe(true);
	});

	it("accepts gitlab", () => {
		expect(GitProviderSchema.safeParse("gitlab").success).toBe(true);
	});

	it("accepts bitbucket", () => {
		expect(GitProviderSchema.safeParse("bitbucket").success).toBe(true);
	});

	it("rejects invalid provider", () => {
		expect(GitProviderSchema.safeParse("azure").success).toBe(false);
		expect(GitProviderSchema.safeParse("").success).toBe(false);
	});
});

describe("RepoSourceSchema", () => {
	it("discriminates remote vs local correctly (remote)", () => {
		const remote = {
			type: "remote",
			provider: "github",
			owner: "tanstack",
			repo: "router",
			fullName: "tanstack/router",
			qualifiedName: "github:tanstack/router",
			cloneUrl: "https://github.com/tanstack/router.git",
		};
		const result = RepoSourceSchema.safeParse(remote);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.type).toBe("remote");
		}
	});

	it("discriminates remote vs local correctly (local)", () => {
		const local = {
			type: "local",
			path: "/home/user/projects/myrepo",
			name: "myrepo",
			qualifiedName: "local:abc123",
		};
		const result = RepoSourceSchema.safeParse(local);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.type).toBe("local");
		}
	});

	it("rejects invalid type discriminator", () => {
		const invalid = {
			type: "unknown",
			path: "/some/path",
		};
		const result = RepoSourceSchema.safeParse(invalid);
		expect(result.success).toBe(false);
	});

	it("rejects remote source with missing fields", () => {
		const incomplete = {
			type: "remote",
			provider: "github",
		};
		const result = RemoteRepoSourceSchema.safeParse(incomplete);
		expect(result.success).toBe(false);
	});

	it("rejects local source with missing fields", () => {
		const incomplete = {
			type: "local",
		};
		const result = LocalRepoSourceSchema.safeParse(incomplete);
		expect(result.success).toBe(false);
	});
});

describe("ArchitectureSchema", () => {
	it("validates complete architecture object", () => {
		const architecture = {
			projectType: "monorepo",
			entities: [
				{
					name: "web",
					type: "package",
					path: "apps/web",
					description: "Main web application",
					responsibilities: ["UI rendering", "User interactions"],
					exports: ["App"],
					dependencies: ["@offworld/sdk"],
				},
			],
			relationships: [
				{
					from: "web",
					to: "sdk",
					type: "depends-on",
				},
			],
			keyFiles: [
				{
					path: "apps/web/src/index.ts",
					role: "entry",
				},
			],
			patterns: {
				framework: "React",
				buildTool: "Vite",
				testFramework: "Vitest",
				language: "TypeScript",
			},
		};
		const result = ArchitectureSchema.safeParse(architecture);
		expect(result.success).toBe(true);
	});

	it("accepts minimal architecture", () => {
		const minimal = {
			projectType: "app",
			entities: [],
			relationships: [],
			keyFiles: [],
			patterns: {},
		};
		const result = ArchitectureSchema.safeParse(minimal);
		expect(result.success).toBe(true);
	});

	it("rejects invalid projectType", () => {
		const invalid = {
			projectType: "invalid-type",
			entities: [],
			relationships: [],
			keyFiles: [],
			patterns: {},
		};
		const result = ArchitectureSchema.safeParse(invalid);
		expect(result.success).toBe(false);
	});
});

describe("ProjectTypeSchema", () => {
	const validTypes = ["monorepo", "library", "cli", "app", "framework"];

	it.each(validTypes)("accepts valid type: %s", (type: string) => {
		expect(ProjectTypeSchema.safeParse(type).success).toBe(true);
	});

	it("rejects invalid type", () => {
		expect(ProjectTypeSchema.safeParse("website").success).toBe(false);
	});
});

describe("EntityTypeSchema", () => {
	const validTypes = ["package", "module", "feature", "util", "config"];

	it.each(validTypes)("accepts valid type: %s", (type: string) => {
		expect(EntityTypeSchema.safeParse(type).success).toBe(true);
	});

	it("rejects invalid type", () => {
		expect(EntityTypeSchema.safeParse("component").success).toBe(false);
	});
});

describe("EntitySchema", () => {
	it("validates entity with all fields", () => {
		const entity = {
			name: "sdk",
			type: "package",
			path: "packages/sdk",
			description: "Core SDK functionality",
			responsibilities: ["AI provider integration", "File parsing"],
			exports: ["runAnalysis", "parseRepoInput"],
			dependencies: ["@offworld/types"],
		};
		const result = EntitySchema.safeParse(entity);
		expect(result.success).toBe(true);
	});

	it("validates entity without optional fields", () => {
		const entity = {
			name: "types",
			type: "util",
			path: "packages/types",
			description: "Shared type definitions",
			responsibilities: ["Type exports"],
		};
		const result = EntitySchema.safeParse(entity);
		expect(result.success).toBe(true);
	});
});

describe("ReferenceDataSchema", () => {
	it("validates complete reference data", () => {
		const data = {
			fullName: "tanstack/router",
			referenceName: "tanstack-router.md",
			description: "TanStack Router reference",
			content: "# TanStack Router\n\nA router library.",
			commitSha: "abc123def456",
			generatedAt: "2026-01-25T12:00:00Z",
		};
		const result = ReferenceDataSchema.safeParse(data);
		expect(result.success).toBe(true);
	});

	it("rejects missing required fields", () => {
		const incomplete = {
			fullName: "tanstack/router",
			referenceName: "tanstack-router.md",
		};
		const result = ReferenceDataSchema.safeParse(incomplete);
		expect(result.success).toBe(false);
	});
});

describe("GlobalMapSchema", () => {
	it("validates global map with entries", () => {
		const map = {
			repos: {
				"tanstack/router": {
					localPath: "/home/user/ow/tanstack-router",
					references: ["tanstack-router.md"],
					primary: "tanstack-router.md",
					keywords: ["router", "typescript"],
					updatedAt: "2026-01-25",
				},
			},
		};
		const result = GlobalMapSchema.safeParse(map);
		expect(result.success).toBe(true);
	});

	it("accepts empty repos", () => {
		const map = { repos: {} };
		const result = GlobalMapSchema.safeParse(map);
		expect(result.success).toBe(true);
	});
});

describe("ProjectMapSchema", () => {
	it("validates project map", () => {
		const map = {
			version: 1,
			scope: "project",
			globalMapPath: "~/.local/share/offworld/skill/offworld/assets/map.json",
			repos: {
				"tanstack/router": {
					localPath: "/home/user/ow/tanstack-router",
					reference: "tanstack-router.md",
					keywords: ["router"],
				},
			},
		};
		const result = ProjectMapSchema.safeParse(map);
		expect(result.success).toBe(true);
	});

	it("applies default version", () => {
		const map = {
			scope: "project",
			globalMapPath: "~/.local/share/offworld/skill/offworld/assets/map.json",
			repos: {},
		};
		const result = ProjectMapSchema.safeParse(map);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.version).toBe(1);
		}
	});
});

describe("FileRoleSchema", () => {
	const validRoles = ["entry", "core", "types", "config", "test", "util", "doc"];

	it.each(validRoles)("accepts valid role: %s", (role: string) => {
		expect(FileRoleSchema.safeParse(role).success).toBe(true);
	});

	it("rejects invalid role", () => {
		expect(FileRoleSchema.safeParse("main").success).toBe(false);
	});
});

describe("FileIndexEntrySchema", () => {
	it("validates importance is in 0-1 range", () => {
		const validEntry = {
			path: "src/index.ts",
			importance: 0.85,
			type: "entry",
		};
		expect(FileIndexEntrySchema.safeParse(validEntry).success).toBe(true);
	});

	it("rejects importance below 0", () => {
		const invalid = {
			path: "src/index.ts",
			importance: -0.1,
			type: "entry",
		};
		expect(FileIndexEntrySchema.safeParse(invalid).success).toBe(false);
	});

	it("rejects importance above 1", () => {
		const invalid = {
			path: "src/index.ts",
			importance: 1.5,
			type: "entry",
		};
		expect(FileIndexEntrySchema.safeParse(invalid).success).toBe(false);
	});

	it("accepts boundary values 0 and 1", () => {
		const zero = { path: "a.ts", importance: 0, type: "util" };
		const one = { path: "b.ts", importance: 1, type: "entry" };
		expect(FileIndexEntrySchema.safeParse(zero).success).toBe(true);
		expect(FileIndexEntrySchema.safeParse(one).success).toBe(true);
	});

	it("accepts optional exports, imports, summary", () => {
		const full = {
			path: "src/utils.ts",
			importance: 0.5,
			type: "util",
			exports: ["helper", "formatDate"],
			imports: ["lodash", "./constants"],
			summary: "Utility functions for formatting",
		};
		const result = FileIndexEntrySchema.safeParse(full);
		expect(result.success).toBe(true);
	});
});

describe("FileIndexSchema", () => {
	it("validates array of file entries", () => {
		const index = [
			{ path: "src/index.ts", importance: 1.0, type: "entry" },
			{ path: "src/utils.ts", importance: 0.5, type: "util" },
		];
		const result = FileIndexSchema.safeParse(index);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toHaveLength(2);
		}
	});

	it("accepts empty array", () => {
		const result = FileIndexSchema.safeParse([]);
		expect(result.success).toBe(true);
	});
});

describe("AnalysisMetaSchema", () => {
	it("validates complete meta object", () => {
		const meta = {
			analyzedAt: "2026-01-09T12:00:00Z",
			commitSha: "abc123def456",
			version: "0.1.0",
			tokenCost: 1250,
		};
		const result = AnalysisMetaSchema.safeParse(meta);
		expect(result.success).toBe(true);
	});

	it("accepts meta without optional tokenCost", () => {
		const meta = {
			analyzedAt: "2026-01-09T12:00:00Z",
			commitSha: "abc123def456",
			version: "0.1.0",
		};
		const result = AnalysisMetaSchema.safeParse(meta);
		expect(result.success).toBe(true);
	});

	it("rejects missing required fields", () => {
		const incomplete = {
			analyzedAt: "2026-01-09T12:00:00Z",
		};
		const result = AnalysisMetaSchema.safeParse(incomplete);
		expect(result.success).toBe(false);
	});
});


