import { os } from "@orpc/server";
import { createCli } from "trpc-cli";
import { z } from "zod";
import {
	pullHandler,
	generateHandler,
	pushHandler,
	rmHandler,
	configShowHandler,
	configSetHandler,
	configGetHandler,
	configResetHandler,
	configPathHandler,
	configAgentsHandler,
	authLoginHandler,
	authLogoutHandler,
	authStatusHandler,
	initHandler,
	projectInitHandler,
	repoListHandler,
	repoUpdateHandler,
	repoPruneHandler,
	repoStatusHandler,
	repoGcHandler,
	repoDiscoverHandler,
} from "./handlers/index.js";

export const version = "0.1.0";

export const router = os.router({
	pull: os
		.input(
			z.object({
				repo: z.string().describe("repo").meta({ positional: true }),
				shallow: z
					.boolean()
					.default(true)
					.describe("Use shallow clone (--depth 1)")
					.meta({ negativeAlias: "full-history" }),
				sparse: z
					.boolean()
					.default(false)
					.describe("Use sparse checkout (only src/, lib/, packages/, docs/)"),
				branch: z.string().optional().describe("Branch to clone"),
				force: z.boolean().default(false).describe("Force re-analysis").meta({ alias: "f" }),
				verbose: z.boolean().default(false).describe("Show detailed output"),
				model: z
					.string()
					.optional()
					.describe("Model override (provider/model)")
					.meta({ alias: "m" }),
			}),
		)
		.meta({
			description: "Clone a repository and fetch or generate its analysis",
			negateBooleans: true,
		})
		.handler(async ({ input }) => {
			await pullHandler({
				repo: input.repo,
				shallow: input.shallow,
				sparse: input.sparse,
				branch: input.branch,
				force: input.force,
				verbose: input.verbose,
				model: input.model,
			});
		}),

	list: os
		.input(
			z.object({
				json: z.boolean().default(false).describe("Output as JSON"),
				paths: z.boolean().default(false).describe("Show full paths"),
				stale: z.boolean().default(false).describe("Only show stale repos"),
				pattern: z.string().optional().describe("Filter by pattern (e.g. 'react-*')"),
			}),
		)
		.meta({
			description: "List managed repositories (alias for 'ow repo list')",
			aliases: { command: ["ls"] },
		})
		.handler(async ({ input }) => {
			await repoListHandler({
				json: input.json,
				paths: input.paths,
				stale: input.stale,
				pattern: input.pattern,
			});
		}),

	generate: os
		.input(
			z.object({
				repo: z.string().describe("repo").meta({ positional: true }),
				force: z
					.boolean()
					.default(false)
					.describe("Force even if remote exists")
					.meta({ alias: "f" }),
				model: z
					.string()
					.optional()
					.describe("Model override (provider/model)")
					.meta({ alias: "m" }),
			}),
		)
		.meta({
			description: "Generate analysis locally (ignores remote)",
			aliases: { command: ["gen"] },
		})
		.handler(async ({ input }) => {
			await generateHandler({
				repo: input.repo,
				force: input.force,
				model: input.model,
			});
		}),

	push: os
		.input(
			z.object({
				repo: z.string().describe("repo").meta({ positional: true }),
			}),
		)
		.meta({
			description: "Push local analysis to offworld.sh",
		})
		.handler(async ({ input }) => {
			await pushHandler({
				repo: input.repo,
			});
		}),

	remove: os
		.input(
			z.object({
				repo: z.string().describe("repo").meta({ positional: true }),
				yes: z.boolean().default(false).describe("Skip confirmation").meta({ alias: "y" }),
				skillOnly: z.boolean().default(false).describe("Only remove skill files (keep repo)"),
				repoOnly: z.boolean().default(false).describe("Only remove cloned repo (keep skill)"),
				dryRun: z.boolean().default(false).describe("Show what would be done").meta({ alias: "d" }),
			}),
		)
		.meta({
			description: "Remove a cloned repository and its analysis",
			aliases: { command: ["rm"] },
		})
		.handler(async ({ input }) => {
			await rmHandler({
				repo: input.repo,
				yes: input.yes,
				skillOnly: input.skillOnly,
				repoOnly: input.repoOnly,
				dryRun: input.dryRun,
			});
		}),

	auth: os.router({
		login: os
			.input(z.object({}))
			.meta({ description: "Login to offworld.sh" })
			.handler(async () => {
				await authLoginHandler();
			}),

		logout: os
			.input(z.object({}))
			.meta({ description: "Logout from offworld.sh" })
			.handler(async () => {
				await authLogoutHandler();
			}),

		status: os
			.input(z.object({}))
			.meta({ description: "Show authentication status" })
			.handler(async () => {
				await authStatusHandler();
			}),
	}),

	config: os.router({
		show: os
			.input(
				z.object({
					json: z.boolean().default(false).describe("Output as JSON"),
				}),
			)
			.meta({ description: "Show all config settings", default: true })
			.handler(async ({ input }) => {
				await configShowHandler({ json: input.json });
			}),

		set: os
			.input(
				z.object({
					key: z.string().describe("key").meta({ positional: true }),
					value: z.string().describe("value").meta({ positional: true }),
				}),
			)
			.meta({
				description: `Set a config value

Valid keys:
  repoRoot        (string)  Where to clone repos (e.g., ~/ow)
  defaultShallow  (boolean) Use shallow clone by default (true/false)
  defaultModel    (string)  AI provider/model (e.g., anthropic/claude-sonnet-4-20250514)
  agents          (list)    Comma-separated agents (e.g., opencode,claude-code)`,
			})
			.handler(async ({ input }) => {
				await configSetHandler({ key: input.key, value: input.value });
			}),

		get: os
			.input(
				z.object({
					key: z.string().describe("key").meta({ positional: true }),
				}),
			)
			.meta({
				description: `Get a config value

Valid keys: repoRoot, defaultShallow, defaultModel, agents`,
			})
			.handler(async ({ input }) => {
				await configGetHandler({ key: input.key });
			}),

		reset: os
			.input(z.object({}))
			.meta({ description: "Reset config to defaults" })
			.handler(async () => {
				await configResetHandler();
			}),

		path: os
			.input(z.object({}))
			.meta({ description: "Show config file location" })
			.handler(async () => {
				await configPathHandler();
			}),

		agents: os
			.input(z.object({}))
			.meta({ description: "Interactively select agents for skill installation" })
			.handler(async () => {
				await configAgentsHandler();
			}),
	}),

	init: os
		.input(
			z.object({
				yes: z.boolean().default(false).describe("Skip confirmation prompts").meta({ alias: "y" }),
				force: z
					.boolean()
					.default(false)
					.describe("Reconfigure even if config exists")
					.meta({ alias: "f" }),
				model: z
					.string()
					.optional()
					.describe("AI provider/model (e.g., anthropic/claude-sonnet-4-20250514)")
					.meta({ alias: "m" }),
				repoRoot: z.string().optional().describe("Where to clone repos"),
				agents: z.string().optional().describe("Comma-separated agents").meta({ alias: "a" }),
			}),
		)
		.meta({
			description: "Initialize configuration with interactive setup",
		})
		.handler(async ({ input }) => {
			await initHandler({
				yes: input.yes,
				force: input.force,
				model: input.model,
				repoRoot: input.repoRoot,
				agents: input.agents,
			});
		}),

	project: os.router({
		init: os
			.input(
				z.object({
					all: z.boolean().default(false).describe("Select all detected dependencies"),
					deps: z.string().optional().describe("Comma-separated deps to include (skip selection)"),
					skip: z.string().optional().describe("Comma-separated deps to exclude"),
					generate: z
						.boolean()
						.default(false)
						.describe("Generate skills for deps without existing ones")
						.meta({ alias: "g" }),
					dryRun: z
						.boolean()
						.default(false)
						.describe("Show what would be done without doing it")
						.meta({ alias: "d" }),
					yes: z.boolean().default(false).describe("Skip confirmations").meta({ alias: "y" }),
				}),
			)
			.meta({
				description: "Scan manifest, install skills, update AGENTS.md",
				default: true,
			})
			.handler(async ({ input }) => {
				await projectInitHandler({
					all: input.all,
					deps: input.deps,
					skip: input.skip,
					generate: input.generate,
					dryRun: input.dryRun,
					yes: input.yes,
				});
			}),
	}),

	repo: os.router({
		list: os
			.input(
				z.object({
					json: z.boolean().default(false).describe("Output as JSON"),
					paths: z.boolean().default(false).describe("Show full paths"),
					stale: z.boolean().default(false).describe("Only show stale repos"),
					pattern: z.string().optional().describe("Filter by pattern (e.g. 'react-*')"),
				}),
			)
			.meta({
				description: "List managed repositories",
				default: true,
				aliases: { command: ["ls"] },
			})
			.handler(async ({ input }) => {
				await repoListHandler({
					json: input.json,
					paths: input.paths,
					stale: input.stale,
					pattern: input.pattern,
				});
			}),

		update: os
			.input(
				z.object({
					all: z.boolean().default(false).describe("Update all repos"),
					stale: z.boolean().default(false).describe("Only update stale repos"),
					pattern: z.string().optional().describe("Filter by pattern"),
					dryRun: z
						.boolean()
						.default(false)
						.describe("Show what would be updated")
						.meta({ alias: "d" }),
				}),
			)
			.meta({ description: "Update repos (git fetch + pull)" })
			.handler(async ({ input }) => {
				await repoUpdateHandler({
					all: input.all,
					stale: input.stale,
					pattern: input.pattern,
					dryRun: input.dryRun,
				});
			}),

		prune: os
			.input(
				z.object({
					dryRun: z
						.boolean()
						.default(false)
						.describe("Show what would be pruned")
						.meta({ alias: "d" }),
					yes: z.boolean().default(false).describe("Skip confirmation").meta({ alias: "y" }),
					removeOrphans: z.boolean().default(false).describe("Also remove orphaned directories"),
				}),
			)
			.meta({ description: "Remove stale index entries and find orphaned directories" })
			.handler(async ({ input }) => {
				await repoPruneHandler({
					dryRun: input.dryRun,
					yes: input.yes,
					removeOrphans: input.removeOrphans,
				});
			}),

		status: os
			.input(
				z.object({
					json: z.boolean().default(false).describe("Output as JSON"),
				}),
			)
			.meta({ description: "Show summary of managed repos" })
			.handler(async ({ input }) => {
				await repoStatusHandler({ json: input.json });
			}),

		gc: os
			.input(
				z.object({
					olderThan: z
						.string()
						.optional()
						.describe("Remove repos not accessed in N days (e.g. '30d')"),
					unanalyzed: z.boolean().default(false).describe("Remove repos without analysis"),
					withoutSkill: z.boolean().default(false).describe("Remove repos without skills"),
					dryRun: z
						.boolean()
						.default(false)
						.describe("Show what would be removed")
						.meta({ alias: "d" }),
					yes: z.boolean().default(false).describe("Skip confirmation").meta({ alias: "y" }),
				}),
			)
			.meta({ description: "Garbage collect old/unused repos" })
			.handler(async ({ input }) => {
				await repoGcHandler({
					olderThan: input.olderThan,
					unanalyzed: input.unanalyzed,
					withoutSkill: input.withoutSkill,
					dryRun: input.dryRun,
					yes: input.yes,
				});
			}),

		discover: os
			.input(
				z.object({
					dryRun: z
						.boolean()
						.default(false)
						.describe("Show what would be added")
						.meta({ alias: "d" }),
					yes: z.boolean().default(false).describe("Skip confirmation").meta({ alias: "y" }),
				}),
			)
			.meta({ description: "Discover and index existing repos in repoRoot" })
			.handler(async ({ input }) => {
				await repoDiscoverHandler({
					dryRun: input.dryRun,
					yes: input.yes,
				});
			}),
	}),
});

const stripSecondaryDescription = (help: string) =>
	help
		.split("\n")
		.filter((line) => !line.startsWith("Available subcommands:"))
		.join("\n");

const stripDefaultCommandHelp = (help: string) => {
	const firstUsageIndex = help.indexOf("Usage:");
	if (firstUsageIndex === -1) return help.trimEnd();
	const secondUsageIndex = help.indexOf("Usage:", firstUsageIndex + 1);
	if (secondUsageIndex === -1) return help.trimEnd();
	return help.slice(0, secondUsageIndex).trimEnd();
};

const normalizeRootHelp = (help: string) =>
	stripDefaultCommandHelp(stripSecondaryDescription(help));

export function createOwCli() {
	const cli = createCli({
		router: router as any,
		description: "Offworld CLI - Repository analysis and skill generation for AI coding agents",
	} as any);

	const buildProgram: typeof cli.buildProgram = (runParams) => {
		const program = cli.buildProgram(runParams);
		const originalHelpInformation = program.helpInformation.bind(program);
		program.helpInformation = () => normalizeRootHelp(originalHelpInformation());
		return program;
	};

	const run: typeof cli.run = (runParams, program) =>
		cli.run(runParams, program ?? buildProgram(runParams));

	return {
		...cli,
		buildProgram,
		run,
	};
}
