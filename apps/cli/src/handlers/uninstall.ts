/**
 * Uninstall command handler
 */

import * as p from "@clack/prompts";
import {
  detectInstallMethod,
  executeUninstall,
  getShellConfigFiles,
  cleanShellConfig,
  Paths,
} from "@offworld/sdk";
import { existsSync, rmSync } from "node:fs";
import { createSpinner } from "../utils/spinner.js";

export interface UninstallOptions {
  keepConfig?: boolean;
  keepData?: boolean;
  dryRun?: boolean;
  force?: boolean;
}

export interface UninstallResult {
  success: boolean;
  removed?: {
    binary?: boolean;
    config?: boolean;
    data?: boolean;
    state?: boolean;
    shellConfigs?: string[];
  };
  message?: string;
}

interface RemovalTarget {
  path: string;
  label: string;
  keep: boolean;
}

export async function uninstallHandler(
  options: UninstallOptions,
): Promise<UninstallResult> {
  const {
    keepConfig = false,
    keepData = false,
    dryRun = false,
    force = false,
  } = options;

  try {
    // Detect installation method
    const method = detectInstallMethod();
    p.log.info(`Installation method: ${method}`);

    // Gather directories to remove
    const directories: RemovalTarget[] = [
      { path: Paths.data, label: "Data", keep: keepData },
      { path: Paths.config, label: "Config", keep: keepConfig },
      { path: Paths.state, label: "State", keep: false },
    ];

    // Filter to existing directories that aren't being kept
    const toRemove = directories.filter((d) => !d.keep && existsSync(d.path));

    // Show what will be removed
    if (dryRun || !force) {
      p.log.info("The following will be removed:");
      console.log("");

      if (method === "curl") {
        console.log("  Binary: ~/.local/bin/ow");
      } else {
        console.log(`  Package: offworld (via ${method})`);
      }

      for (const dir of toRemove) {
        console.log(`  ${dir.label}: ${dir.path}`);
      }

      if (keepConfig) {
        console.log(`  [kept] Config: ${Paths.config}`);
      }
      if (keepData) {
        console.log(`  [kept] Data: ${Paths.data}`);
      }

      console.log("");
    }

    if (dryRun) {
      p.log.info("Dry run - nothing was removed.");
      return {
        success: true,
        removed: {
          binary: method === "curl",
          config: !keepConfig && existsSync(Paths.config),
          data: !keepData && existsSync(Paths.data),
          state: existsSync(Paths.state),
        },
      };
    }

    // Confirm
    if (!force) {
      const confirm = await p.confirm({
        message: "Are you sure you want to uninstall offworld?",
        initialValue: false,
      });

      if (p.isCancel(confirm) || !confirm) {
        p.log.info("Aborted.");
        return { success: false, message: "Aborted by user" };
      }
    }

    const s = createSpinner();
    const removed: UninstallResult["removed"] = {};

    // Remove binary/package
    s.start("Removing offworld...");
    try {
      await executeUninstall(method);
      removed.binary = true;
      s.stop("Removed offworld binary/package");
    } catch (err) {
      s.stop("Failed to remove binary/package");
      p.log.warn(err instanceof Error ? err.message : "Unknown error");
    }

    // Remove directories
    for (const dir of toRemove) {
      s.start(`Removing ${dir.label.toLowerCase()}...`);
      try {
        rmSync(dir.path, { recursive: true, force: true });
        s.stop(`Removed ${dir.label.toLowerCase()}`);
        if (dir.label === "Config") removed.config = true;
        if (dir.label === "Data") removed.data = true;
        if (dir.label === "State") removed.state = true;
      } catch (err) {
        s.stop(`Failed to remove ${dir.label.toLowerCase()}`);
        p.log.warn(err instanceof Error ? err.message : "Unknown error");
      }
    }

    // Clean shell configs (only for curl installs)
    if (method === "curl") {
      const shellConfigs = getShellConfigFiles();
      const cleaned: string[] = [];

      for (const config of shellConfigs) {
        if (cleanShellConfig(config)) {
          cleaned.push(config);
        }
      }

      if (cleaned.length > 0) {
        p.log.info(`Cleaned PATH from: ${cleaned.join(", ")}`);
        removed.shellConfigs = cleaned;
      }
    }

    p.log.success("Uninstall complete!");

    if (method === "curl") {
      p.log.info("You may need to restart your terminal.");
    }

    return { success: true, removed };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    p.log.error(message);
    return { success: false, message };
  }
}
