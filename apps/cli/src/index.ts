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
	upgradeHandler,
	uninstallHandler,
	mapShowHandler,
	mapSearchHandler,
} from "./handlers/index.js";

export const version = "0.1.10";

export const router = os.router({
	pull: os
		.input(
			z.object({
				repo: z.string().describe("repo").meta({ positional: true }),
				reference: z
					.string()
					.optional()
					.describe("Reference name to pull (defaults to owner-repo)")
					.meta({ alias: "r" }),
				shallow: z
					.boolean()
					.default(false)
					.describe("Use shallow clone (--depth 1)")
					.meta({ negativeAlias: "full-history" }),
				sparse: z
					.boolean()
					.default(false)
					.describe("Use sparse checkout (only src/, lib/, packages/, docs/)"),
				branch: z.string().optional().describe("Branch to clone"),
				force: z.boolean().default(false).describe("Force re-generation").meta({ alias: "f" }),
				verbose: z.boolean().default(false).describe("Show detailed output"),
				model: z
					.string()
					.optional()
					.describe("Model override (provider/model)")
					.meta({ alias: "m" }),
			}),
		)
		.meta({
			description: "Clone a repository and fetch or generate its reference",
			negateBooleans: true,
		})
		.handler(async ({ input }) => {
			await pullHandler({
				repo: input.repo,
				reference: input.reference,
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
			description: "Generate reference locally (ignores remote)",
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
			description: "Push local reference to offworld.sh",
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
				referenceOnly: z
					.boolean()
					.default(false)
					.describe("Only remove reference files (keep repo)"),
				repoOnly: z.boolean().default(false).describe("Only remove cloned repo (keep reference)"),
				dryRun: z.boolean().default(false).describe("Show what would be done").meta({ alias: "d" }),
			}),
		)
		.meta({
			description: "Remove a cloned repository and its reference",
			aliases: { command: ["rm"] },
		})
		.handler(async ({ input }) => {
			await rmHandler({
				repo: input.repo,
				yes: input.yes,
				referenceOnly: input.referenceOnly,
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
  agents          (list)    Comma-separated agents (e.g., claude-code,opencode)`,
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
			.meta({ description: "Interactively select agents for reference installation" })
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
						.describe("Generate references for deps without existing ones")
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
				description: "Scan manifest, install references, update AGENTS.md",
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

	map: os.router({
		show: os
			.input(
				z.object({
					repo: z.string().describe("repo").meta({ positional: true }),
					json: z.boolean().default(false).describe("Output as JSON"),
					path: z.boolean().default(false).describe("Print only local path"),
					ref: z.boolean().default(false).describe("Print only reference file path"),
				}),
			)
			.meta({
				description: "Show map entry for a repo",
				default: true,
			})
			.handler(async ({ input }) => {
				await mapShowHandler({
					repo: input.repo,
					json: input.json,
					path: input.path,
					ref: input.ref,
				});
			}),

		search: os
			.input(
				z.object({
					term: z.string().describe("term").meta({ positional: true }),
					limit: z.number().default(10).describe("Max results").meta({ alias: "n" }),
					json: z.boolean().default(false).describe("Output as JSON"),
				}),
			)
			.meta({
				description: "Search map for repos matching a term",
			})
			.handler(async ({ input }) => {
				await mapSearchHandler({
					term: input.term,
					limit: input.limit,
					json: input.json,
				});
			}),
	}),

	repo: os.router({
		list: os
			.input(
				z.object({
					json: z.boolean().default(false).describe("Output as JSON"),
					paths: z.boolean().default(false).describe("Show full paths"),
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
					pattern: input.pattern,
				});
			}),

		update: os
			.input(
				z.object({
					all: z.boolean().default(false).describe("Update all repos"),
					pattern: z.string().optional().describe("Filter by pattern"),
					dryRun: z
						.boolean()
						.default(false)
						.describe("Show what would be updated")
						.meta({ alias: "d" }),
					unshallow: z.boolean().default(false).describe("Convert shallow clones to full clones"),
				}),
			)
			.meta({ description: "Update repos (git fetch + pull)" })
			.handler(async ({ input }) => {
				await repoUpdateHandler({
					all: input.all,
					pattern: input.pattern,
					dryRun: input.dryRun,
					unshallow: input.unshallow,
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
					withoutReference: z.boolean().default(false).describe("Remove repos without references"),
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
					withoutReference: input.withoutReference,
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

	upgrade: os
		.input(
			z.object({
				target: z.string().optional().describe("Version to upgrade to"),
			}),
		)
		.meta({
			description: "Upgrade offworld to latest or specific version",
		})
		.handler(async ({ input }) => {
			await upgradeHandler({
				target: input.target,
			});
		}),

	uninstall: os
		.input(
			z.object({
				keepConfig: z.boolean().default(false).describe("Keep configuration files"),
				keepData: z.boolean().default(false).describe("Keep data files (references, repos)"),
				dryRun: z
					.boolean()
					.default(false)
					.describe("Show what would be removed")
					.meta({ alias: "d" }),
				force: z.boolean().default(false).describe("Skip confirmation").meta({ alias: "f" }),
			}),
		)
		.meta({
			description: "Uninstall offworld and remove related files",
		})
		.handler(async ({ input }) => {
			await uninstallHandler({
				keepConfig: input.keepConfig,
				keepData: input.keepData,
				dryRun: input.dryRun,
				force: input.force,
			});
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
		router,
		description: "Offworld CLI - Repository reference generation for AI coding agents",
	});

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
