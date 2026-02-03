/**
 * Upgrade command handler
 */

import * as p from "@clack/prompts";
import {
	detectInstallMethod,
	getCurrentVersion,
	fetchLatestVersion,
	executeUpgrade,
	type InstallMethod,
} from "@offworld/sdk/internal";
import { createSpinner } from "../utils/spinner.js";

export interface UpgradeOptions {
	target?: string;
	method?: InstallMethod;
}

export interface UpgradeResult {
	success: boolean;
	from?: string;
	to?: string;
	message?: string;
}

export async function upgradeHandler(options: UpgradeOptions): Promise<UpgradeResult> {
	const { target, method: methodOverride } = options;

	try {
		const s = createSpinner();

		s.start("Detecting installation method...");
		const method = methodOverride ?? detectInstallMethod();
		s.stop(`Installation method: ${method}`);

		if (method === "unknown") {
			const confirm = await p.confirm({
				message: "Could not detect installation method. Attempt curl-based upgrade?",
				initialValue: false,
			});

			if (p.isCancel(confirm) || !confirm) {
				p.log.info("Aborted.");
				return { success: false, message: "Unknown installation method" };
			}
		}

		const effectiveMethod = method === "unknown" ? "curl" : method;

		const currentVersion = getCurrentVersion();
		p.log.info(`Current version: ${currentVersion}`);

		let targetVersion = target;
		if (!targetVersion) {
			s.start("Fetching latest version...");
			const latest = await fetchLatestVersion(effectiveMethod);
			s.stop(latest ? `Latest version: ${latest}` : "Could not fetch latest version");

			if (!latest) {
				p.log.error("Failed to fetch latest version");
				return { success: false, message: "Failed to fetch latest version" };
			}
			targetVersion = latest;
		}

		targetVersion = targetVersion.replace(/^v/, "");

		if (currentVersion === targetVersion) {
			p.log.success(`Already on version ${targetVersion}`);
			return { success: true, from: currentVersion, to: targetVersion };
		}

		p.log.info(`Upgrading from ${currentVersion} to ${targetVersion}...`);

		await executeUpgrade(effectiveMethod, targetVersion);

		p.log.success(`Successfully upgraded to ${targetVersion}`);
		p.log.info("Restart your terminal or run 'ow --version' to verify.");

		return {
			success: true,
			from: currentVersion,
			to: targetVersion,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		p.log.error(message);
		return { success: false, message };
	}
}
