import { os } from "@orpc/server";
import { createCli } from "trpc-cli";
import { z } from "zod";
import {
  pullHandler,
  generateHandler,
  listHandler,
  rmHandler,
  configShowHandler,
  configSetHandler,
  configGetHandler,
  configResetHandler,
  configPathHandler,
} from "./handlers/index.js";

export const version = "0.1.0";

/**
 * CLI router using @orpc/server
 * Commands: pull (default), push, generate, list, rm, auth, config
 */
export const router = os.router({
  // Pull command - default, clones repo and fetches/generates analysis
  pull: os
    .input(
      z.object({
        repo: z
          .string()
          .describe("Repository (owner/repo, URL, or local path)"),
        shallow: z
          .boolean()
          .default(true)
          .describe("Use shallow clone (--depth 1)"),
        branch: z.string().optional().describe("Branch to clone"),
        force: z.boolean().default(false).describe("Force re-analysis"),
      })
    )
    .meta({
      description: "Clone a repository and fetch or generate its analysis",
      default: true,
      negateBooleans: true,
    })
    .handler(async ({ input }) => {
      return pullHandler({
        repo: input.repo,
        shallow: input.shallow,
        branch: input.branch,
        force: input.force,
      });
    }),

  // List command - show cloned repos
  list: os
    .input(
      z.object({
        json: z.boolean().default(false).describe("Output as JSON"),
        paths: z.boolean().default(false).describe("Show full paths"),
        stale: z.boolean().default(false).describe("Only show stale repos"),
      })
    )
    .meta({
      description: "List all cloned repositories",
      aliases: { command: "ls" },
    })
    .handler(async ({ input }) => {
      return listHandler({
        json: input.json,
        paths: input.paths,
        stale: input.stale,
      });
    }),

  // Generate command - run local analysis
  generate: os
    .input(
      z.object({
        repo: z
          .string()
          .describe("Repository (owner/repo, URL, or local path)"),
        force: z
          .boolean()
          .default(false)
          .describe("Force even if remote exists"),
      })
    )
    .meta({
      description: "Generate analysis locally (ignores remote)",
      aliases: { command: "gen" },
    })
    .handler(async ({ input }) => {
      return generateHandler({
        repo: input.repo,
        force: input.force,
      });
    }),

  // Push command - upload analysis to offworld.sh
  push: os
    .input(
      z.object({
        repo: z.string().describe("Repository (owner/repo)"),
      })
    )
    .meta({
      description: "Push local analysis to offworld.sh",
    })
    .handler(async ({ input }) => {
      // Stub - will be implemented in PRD 4.5
      console.log(`Pushing ${input.repo}...`);
      return { success: true };
    }),

  // Remove command - delete repo and analysis
  rm: os
    .input(
      z.object({
        repo: z.string().describe("Repository to remove"),
        yes: z
          .boolean()
          .default(false)
          .describe("Skip confirmation")
          .meta({ alias: "y" }),
        keepSkill: z
          .boolean()
          .default(false)
          .describe("Keep installed skill files"),
        dryRun: z.boolean().default(false).describe("Show what would be done"),
      })
    )
    .meta({
      description: "Remove a cloned repository and its analysis",
      aliases: { command: "remove" },
    })
    .handler(async ({ input }) => {
      return rmHandler({
        repo: input.repo,
        yes: input.yes,
        keepSkill: input.keepSkill,
        dryRun: input.dryRun,
      });
    }),

  // Auth subcommands
  auth: os.router({
    login: os
      .input(z.object({}))
      .meta({ description: "Login to offworld.sh" })
      .handler(async () => {
        // Stub - will be implemented in PRD 4.8
        console.log("Opening browser for login...");
        return { success: true };
      }),

    logout: os
      .input(z.object({}))
      .meta({ description: "Logout from offworld.sh" })
      .handler(async () => {
        // Stub - will be implemented in PRD 4.8
        console.log("Logged out");
        return { success: true };
      }),

    status: os
      .input(z.object({}))
      .meta({ description: "Show authentication status" })
      .handler(async () => {
        // Stub - will be implemented in PRD 4.8
        console.log("Not logged in");
        return { loggedIn: false };
      }),
  }),

  // Config subcommands
  config: os.router({
    show: os
      .input(
        z.object({
          json: z.boolean().default(false).describe("Output as JSON"),
        })
      )
      .meta({ description: "Show all config settings", default: true })
      .handler(async ({ input }) => {
        return configShowHandler({ json: input.json });
      }),

    set: os
      .input(
        z.object({
          key: z.string().describe("Config key"),
          value: z.string().describe("Config value"),
        })
      )
      .meta({ description: "Set a config value" })
      .handler(async ({ input }) => {
        return configSetHandler({ key: input.key, value: input.value });
      }),

    get: os
      .input(
        z.object({
          key: z.string().describe("Config key"),
        })
      )
      .meta({ description: "Get a config value" })
      .handler(async ({ input }) => {
        return configGetHandler({ key: input.key });
      }),

    reset: os
      .input(z.object({}))
      .meta({ description: "Reset config to defaults" })
      .handler(async () => {
        return configResetHandler();
      }),

    path: os
      .input(z.object({}))
      .meta({ description: "Show config file location" })
      .handler(async () => {
        return configPathHandler();
      }),
  }),
});

/**
 * Create the CLI instance from the router
 */
export function createOwCli() {
  return createCli({
    router,
    name: "ow",
    version,
  });
}
