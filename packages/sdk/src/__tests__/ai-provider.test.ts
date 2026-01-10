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
				expect.objectContaining({ stdio: "pipe" }),
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
				expect.objectContaining({ method: "GET" }),
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

		// T2.3: Provider priority tests - claude-code preferred when both available
		describe("provider priority logic", () => {
			it("chooses claude-code when both providers are available (no preference set)", async () => {
				// Both providers available
				mockExecSync.mockReturnValue("Claude Code v1.0.23");
				mockFetch.mockResolvedValue({ ok: true, status: 200 });

				const result = await detectProvider();

				// Claude Code should be chosen as it has higher priority
				expect(result.provider).toBe("claude-code");
				expect(result.isPreferred).toBe(false);
			});

			it("respects opencode preference even when claude-code is available", async () => {
				const configWithPref: Config = {
					...defaultConfig,
					preferredProvider: "opencode",
				};
				mockLoadConfig.mockReturnValue(configWithPref);

				// Both providers available
				mockExecSync.mockReturnValue("Claude Code v1.0.23");
				mockFetch.mockResolvedValue({ ok: true, status: 200 });

				const result = await detectProvider();

				// OpenCode should be chosen because it's preferred
				expect(result.provider).toBe("opencode");
				expect(result.isPreferred).toBe(true);
			});

			it("respects claude-code preference when both are available", async () => {
				const configWithPref: Config = {
					...defaultConfig,
					preferredProvider: "claude-code",
				};
				mockLoadConfig.mockReturnValue(configWithPref);

				// Both providers available
				mockExecSync.mockReturnValue("Claude Code v1.0.23");
				mockFetch.mockResolvedValue({ ok: true, status: 200 });

				const result = await detectProvider();

				expect(result.provider).toBe("claude-code");
				expect(result.isPreferred).toBe(true);
			});

			it("falls back from preferred opencode to claude-code when opencode unavailable", async () => {
				const configWithPref: Config = {
					...defaultConfig,
					preferredProvider: "opencode",
				};
				mockLoadConfig.mockReturnValue(configWithPref);

				// Claude available, OpenCode down
				mockExecSync.mockReturnValue("Claude Code v1.0.23");
				mockFetch.mockResolvedValue({ ok: false, status: 503 });

				const result = await detectProvider();

				// Falls back to claude-code
				expect(result.provider).toBe("claude-code");
				expect(result.isPreferred).toBe(false);
			});

			it("falls back from preferred claude-code to opencode when claude-code unavailable", async () => {
				const configWithPref: Config = {
					...defaultConfig,
					preferredProvider: "claude-code",
				};
				mockLoadConfig.mockReturnValue(configWithPref);

				// Claude unavailable, OpenCode available
				mockExecSync.mockImplementation(() => {
					throw new Error("command not found: claude");
				});
				mockFetch.mockResolvedValue({ ok: true, status: 200 });

				const result = await detectProvider();

				// Falls back to opencode
				expect(result.provider).toBe("opencode");
				expect(result.isPreferred).toBe(false);
			});
		});

		// T2.3: Realistic mock response tests
		describe("realistic detection scenarios", () => {
			it("handles realistic claude --version output", async () => {
				// Real-world claude --version output
				mockExecSync.mockReturnValue(
					"Claude Code v1.0.23\n@anthropic-ai/claude-code@1.0.23",
				);
				mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

				const result = await detectProvider();

				expect(result.provider).toBe("claude-code");
			});

			it("handles opencode health check with realistic response", async () => {
				mockExecSync.mockImplementation(() => {
					throw new Error("command not found: claude");
				});
				mockFetch.mockResolvedValue({
					ok: true,
					status: 200,
					json: async () => ({ status: "healthy", version: "0.5.2" }),
				});

				const result = await detectProvider();

				expect(result.provider).toBe("opencode");
			});

			it("handles opencode server error (500)", async () => {
				mockExecSync.mockImplementation(() => {
					throw new Error("command not found");
				});
				mockFetch.mockResolvedValue({
					ok: false,
					status: 500,
				});

				await expect(detectProvider()).rejects.toThrow(AIProviderNotFoundError);
			});

			it("handles network timeout scenario", async () => {
				mockExecSync.mockImplementation(() => {
					throw new Error("command not found");
				});
				mockFetch.mockRejectedValue(new Error("AbortError: The operation was aborted"));

				await expect(detectProvider()).rejects.toThrow(AIProviderNotFoundError);
			});

			it("handles claude permission denied error", async () => {
				mockExecSync.mockImplementation(() => {
					const error = new Error("EACCES: permission denied") as any;
					error.code = "EACCES";
					throw error;
				});
				mockFetch.mockResolvedValue({ ok: true, status: 200 });

				const result = await detectProvider();

				// Falls back to opencode since claude failed
				expect(result.provider).toBe("opencode");
			});
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
