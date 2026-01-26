/**
 * XDG-based directory paths for offworld CLI
 * Uses xdg-basedir package for cross-platform compatibility (Linux/macOS)
 */

import { xdgConfig, xdgData, xdgState } from "xdg-basedir";
import { join } from "node:path";
import { homedir } from "node:os";

const APP_NAME = "offworld";

/**
 * Main namespace for all XDG-compliant paths
 */
export const Paths = {
	/**
	 * XDG_CONFIG_HOME/offworld
	 * Fallback: ~/.config/offworld
	 */
	get config(): string {
		return join(xdgConfig ?? join(homedir(), ".config"), APP_NAME);
	},

	/**
	 * XDG_DATA_HOME/offworld
	 * Fallback: ~/.local/share/offworld
	 */
	get data(): string {
		return join(xdgData ?? join(homedir(), ".local", "share"), APP_NAME);
	},

	/**
	 * XDG_STATE_HOME/offworld
	 * Fallback: ~/.local/state/offworld
	 */
	get state(): string {
		return join(xdgState ?? join(homedir(), ".local", "state"), APP_NAME);
	},

	/**
	 * Configuration file path: ~/.config/offworld/offworld.json
	 */
	get configFile(): string {
		return join(this.config, "offworld.json");
	},

	/**
	 * Auth file path: ~/.local/share/offworld/auth.json
	 */
	get authFile(): string {
		return join(this.data, "auth.json");
	},

	/**
	 * Single-skill directory (legacy alias): ~/.local/share/offworld/skill/offworld
	 */
	get skillsDir(): string {
		return join(this.data, "skill", "offworld");
	},

	/**
	 * Meta directory: ~/.local/share/offworld/meta
	 */
	get metaDir(): string {
		return join(this.data, "meta");
	},

	/**
	 * Default repo root: ~/ow
	 */
	get defaultRepoRoot(): string {
		return join(homedir(), "ow");
	},

	/**
	 * Offworld single-skill directory: ~/.local/share/offworld/skill/offworld
	 */
	get offworldSkillDir(): string {
		return join(this.data, "skill", "offworld");
	},

	/**
	 * Offworld references directory: ~/.local/share/offworld/skill/offworld/references
	 */
	get offworldReferencesDir(): string {
		return join(this.offworldSkillDir, "references");
	},

	/**
	 * Offworld assets directory: ~/.local/share/offworld/skill/offworld/assets
	 */
	get offworldAssetsDir(): string {
		return join(this.offworldSkillDir, "assets");
	},

	/**
	 * Global map path: ~/.local/share/offworld/skill/offworld/assets/map.json
	 */
	get offworldGlobalMapPath(): string {
		return join(this.offworldAssetsDir, "map.json");
	},
};

/**
 * Expands ~ to user's home directory (for backward compatibility)
 */
export function expandTilde(path: string): string {
	if (path.startsWith("~/")) {
		return join(homedir(), path.slice(2));
	}
	return path;
}
