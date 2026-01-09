/**
 * Unit tests for AI provider detection
 * PRD T3.7
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock node:child_process
vi.mock("node:child_process", () => ({
	execSync: vi.fn(),
}));

// Mock config loading
vi.mock("../config.js", () => ({
	loadConfig: vi.fn(),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { execSync } from "node:child_process";
import { loadConfig } from "../config.js";
import {
	detectProvider,
	isClaudeCodeAvailable,
	isOpenCodeAvailable,
	isProviderAvailable,
	getProviderDisplayName,
	AIProviderNotFoundError,
} from "../ai/provider.js";
import type { Config } from "@offworld/types";

describe("ai/provider.ts", () => {
	const mockExecSync = execSync as ReturnType<typeof vi.fn>;
	const mockLoadConfig = loadConfig as ReturnType<typeof vi.fn>;

	const defaultConfig: Config = {
		repoRoot: "~/ow",
		metaRoot: "~/.ow",
		skillDir: "~/.config/opencode/skill",
		defaultShallow: true,
		autoAnalyze: true,
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockLoadConfig.mockReturnValue(defaultConfig);
		mockFetch.mockReset();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	// =========================================================================
	// isClaudeCodeAvailable tests
	// =========================================================================
	describe("isClaudeCodeAvailable", () => {
		it("returns true when claude --version succeeds (mocked)", async () => {
			mockExecSync.mockReturnValue("Claude Code v1.0.0");

			const result = await isClaudeCodeAvailable();

			expect(result).toBe(true);
			expect(mockExecSync).toHaveBeenCalledWith(
				"claude --version",
				expect.objectContaining({ stdio: "pipe" })
			);
		});

		it("returns false when claude --version fails (mocked)", async () => {
			mockExecSync.mockImplementation(() => {
				throw new Error("command not found");
			});

			const result = await isClaudeCodeAvailable();

			expect(result).toBe(false);
		});
	});

	// =========================================================================
	// isOpenCodeAvailable tests
	// =========================================================================
	describe("isOpenCodeAvailable", () => {
		it("returns true when localhost:4096/health responds OK (mocked fetch)", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
			});

			const result = await isOpenCodeAvailable();

			expect(result).toBe(true);
			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:4096/health",
				expect.objectContaining({ method: "GET" })
			);
		});

		it("returns false when localhost:4096/health fails (mocked fetch)", async () => {
			mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

			const result = await isOpenCodeAvailable();

			expect(result).toBe(false);
		});

		it("returns false when response is not ok", async () => {
			mockFetch.mockResolvedValue({
				ok: false,
			});

			const result = await isOpenCodeAvailable();

			expect(result).toBe(false);
		});
	});

	// =========================================================================
	// isProviderAvailable tests
	// =========================================================================
	describe("isProviderAvailable", () => {
		it("routes to isClaudeCodeAvailable for claude-code", async () => {
			mockExecSync.mockReturnValue("v1.0.0");

			const result = await isProviderAvailable("claude-code");

			expect(result).toBe(true);
		});

		it("routes to isOpenCodeAvailable for opencode", async () => {
			mockFetch.mockResolvedValue({ ok: true });

			const result = await isProviderAvailable("opencode");

			expect(result).toBe(true);
		});

		it("returns false for unknown provider", async () => {
			const result = await isProviderAvailable("unknown" as any);

			expect(result).toBe(false);
		});
	});

	// =========================================================================
	// detectProvider tests
	// =========================================================================
	describe("detectProvider", () => {
		it("returns config preference if set and available", async () => {
			const configWithPref: Config = {
				...defaultConfig,
				preferredProvider: "opencode",
			};
			mockLoadConfig.mockReturnValue(configWithPref);
			mockFetch.mockResolvedValue({ ok: true });

			const result = await detectProvider();

			expect(result.provider).toBe("opencode");
			expect(result.isPreferred).toBe(true);
		});

		it("falls back to claude-code if claude-code available", async () => {
			mockExecSync.mockReturnValue("v1.0.0");
			mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

			const result = await detectProvider();

			expect(result.provider).toBe("claude-code");
			expect(result.isPreferred).toBe(false);
		});

		it("falls back to opencode if claude-code unavailable", async () => {
			mockExecSync.mockImplementation(() => {
				throw new Error("not found");
			});
			mockFetch.mockResolvedValue({ ok: true });

			const result = await detectProvider();

			expect(result.provider).toBe("opencode");
			expect(result.isPreferred).toBe(false);
		});

		it("throws AIProviderNotFoundError if neither available", async () => {
			mockExecSync.mockImplementation(() => {
				throw new Error("not found");
			});
			mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

			await expect(detectProvider()).rejects.toThrow(AIProviderNotFoundError);
		});

		it("falls back if preferred provider not available", async () => {
			const configWithPref: Config = {
				...defaultConfig,
				preferredProvider: "opencode",
			};
			mockLoadConfig.mockReturnValue(configWithPref);

			// OpenCode not available
			mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));
			// Claude Code is available
			mockExecSync.mockReturnValue("v1.0.0");

			const result = await detectProvider();

			// Falls back to claude-code
			expect(result.provider).toBe("claude-code");
			expect(result.isPreferred).toBe(false);
		});

		it("accepts config parameter", async () => {
			const customConfig: Config = {
				...defaultConfig,
				preferredProvider: "claude-code",
			};
			mockExecSync.mockReturnValue("v1.0.0");

			const result = await detectProvider(customConfig);

			expect(result.provider).toBe("claude-code");
			expect(result.isPreferred).toBe(true);
			// Should not call loadConfig when config is provided
			expect(mockLoadConfig).not.toHaveBeenCalled();
		});
	});

	// =========================================================================
	// getProviderDisplayName tests
	// =========================================================================
	describe("getProviderDisplayName", () => {
		it("returns Claude Code for claude-code", () => {
			expect(getProviderDisplayName("claude-code")).toBe("Claude Code");
		});

		it("returns OpenCode for opencode", () => {
			expect(getProviderDisplayName("opencode")).toBe("OpenCode");
		});

		it("returns provider string for unknown", () => {
			expect(getProviderDisplayName("unknown" as any)).toBe("unknown");
		});
	});

	// =========================================================================
	// Error types tests
	// =========================================================================
	describe("error types", () => {
		it("AIProviderNotFoundError includes install instructions", () => {
			const error = new AIProviderNotFoundError();

			expect(error.message).toContain("Claude Code");
			expect(error.message).toContain("OpenCode");
			expect(error.message).toContain("npm install");
		});
	});
});
