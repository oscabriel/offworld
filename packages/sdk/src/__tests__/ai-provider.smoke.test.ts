/**
 * AI Provider Smoke Tests
 * Run with: SMOKE_TESTS=1 bun run test:smoke
 */

import { describe, it, expect } from "vitest";
import {
	isClaudeCodeAvailable,
	isOpenCodeAvailable,
	detectProvider,
	AIProviderNotFoundError,
} from "../ai/provider.js";

const SMOKE_ENABLED = process.env.SMOKE_TESTS === "1";

describe.skipIf(!SMOKE_ENABLED)("AI Provider Smoke Tests", () => {
	describe("isClaudeCodeAvailable", () => {
		it("should return boolean without throwing", { timeout: 10_000 }, async () => {
			const result = await isClaudeCodeAvailable();
			expect(typeof result).toBe("boolean");
		});
	});

	describe("isOpenCodeAvailable", () => {
		it("should return boolean without throwing", { timeout: 10_000 }, async () => {
			const result = await isOpenCodeAvailable();
			expect(typeof result).toBe("boolean");
		});
	});

	describe("detectProvider", () => {
		it(
			"should return valid result or throw AIProviderNotFoundError",
			{ timeout: 10_000 },
			async () => {
				try {
					const result = await detectProvider();
					expect(result).toHaveProperty("provider");
					expect(result).toHaveProperty("isPreferred");
					expect(["claude-code", "opencode"]).toContain(result.provider);
					expect(typeof result.isPreferred).toBe("boolean");
				} catch (error) {
					expect(error).toBeInstanceOf(AIProviderNotFoundError);
				}
			},
		);
	});
});
