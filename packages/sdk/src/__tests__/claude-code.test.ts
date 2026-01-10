/**
 * Unit tests for Claude Code SDK wrapper
 * PRD T3.1
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Mock the Claude Agent SDK
const mockQuery = vi.fn();
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
	query: (...args: unknown[]) => mockQuery(...args),
}));

import {
	analyzeWithClaudeCode,
	ClaudeCodeAnalysisError,
	type ClaudeCodeAnalysisOptions,
} from "../ai/claude-code.js";

describe("ai/claude-code.ts", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	// Helper to create async generator from messages
	async function* createMessageStream(
		messages: Array<Record<string, unknown>>,
	): AsyncGenerator<Record<string, unknown>> {
		for (const msg of messages) {
			yield msg;
		}
	}

	// Test schema for structured output
	const testSchema = z.object({
		summary: z.string(),
		files: z.array(z.string()),
		score: z.number(),
	});

	type TestOutput = z.infer<typeof testSchema>;

	const defaultOptions: ClaudeCodeAnalysisOptions<typeof testSchema> = {
		prompt: "Analyze this repository",
		cwd: "/test/repo",
		schema: testSchema,
	};

	// =========================================================================
	// Successful analysis tests
	// =========================================================================
	describe("successful analysis with valid structured output", () => {
		it("returns parsed output on success", async () => {
			const structuredOutput: TestOutput = {
				summary: "A test repository",
				files: ["index.ts", "package.json"],
				score: 85,
			};

			mockQuery.mockReturnValue(
				createMessageStream([
					{
						type: "result",
						subtype: "success",
						structured_output: structuredOutput,
						total_cost_usd: 0.05,
						duration_ms: 1500,
						usage: {
							input_tokens: 1000,
							output_tokens: 500,
							cache_read_input_tokens: 200,
							cache_creation_input_tokens: 100,
						},
					},
				]),
			);

			const result = await analyzeWithClaudeCode(defaultOptions);

			expect(result.output).toEqual(structuredOutput);
			expect(result.costUsd).toBe(0.05);
			expect(result.durationMs).toBe(1500);
			expect(result.usage.inputTokens).toBe(1000);
			expect(result.usage.outputTokens).toBe(500);
			expect(result.usage.cacheReadInputTokens).toBe(200);
			expect(result.usage.cacheCreationInputTokens).toBe(100);
		});

		it("passes correct query options", async () => {
			const structuredOutput: TestOutput = {
				summary: "Test",
				files: [],
				score: 0,
			};

			mockQuery.mockReturnValue(
				createMessageStream([
					{
						type: "result",
						subtype: "success",
						structured_output: structuredOutput,
						total_cost_usd: 0,
						duration_ms: 0,
						usage: {},
					},
				]),
			);

			await analyzeWithClaudeCode(defaultOptions);

			expect(mockQuery).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: "Analyze this repository",
					options: expect.objectContaining({
						cwd: "/test/repo",
						allowedTools: ["Read", "Glob", "Grep"],
						permissionMode: "bypassPermissions",
						allowDangerouslySkipPermissions: true,
						maxTurns: 50,
						outputFormat: expect.objectContaining({
							type: "json_schema",
						}),
					}),
				}),
			);
		});

		it("uses custom maxTurns when provided", async () => {
			const structuredOutput: TestOutput = {
				summary: "Test",
				files: [],
				score: 0,
			};

			mockQuery.mockReturnValue(
				createMessageStream([
					{
						type: "result",
						subtype: "success",
						structured_output: structuredOutput,
						total_cost_usd: 0,
						duration_ms: 0,
						usage: {},
					},
				]),
			);

			await analyzeWithClaudeCode({ ...defaultOptions, maxTurns: 100 });

			expect(mockQuery).toHaveBeenCalledWith(
				expect.objectContaining({
					options: expect.objectContaining({
						maxTurns: 100,
					}),
				}),
			);
		});

		it("includes system prompt when provided", async () => {
			const structuredOutput: TestOutput = {
				summary: "Test",
				files: [],
				score: 0,
			};

			mockQuery.mockReturnValue(
				createMessageStream([
					{
						type: "result",
						subtype: "success",
						structured_output: structuredOutput,
						total_cost_usd: 0,
						duration_ms: 0,
						usage: {},
					},
				]),
			);

			await analyzeWithClaudeCode({
				...defaultOptions,
				systemPrompt: "Focus on TypeScript files only",
			});

			expect(mockQuery).toHaveBeenCalledWith(
				expect.objectContaining({
					options: expect.objectContaining({
						systemPrompt: {
							type: "preset",
							preset: "claude_code",
							append: "Focus on TypeScript files only",
						},
					}),
				}),
			);
		});

		it("handles missing usage fields with defaults", async () => {
			const structuredOutput: TestOutput = {
				summary: "Test",
				files: [],
				score: 0,
			};

			mockQuery.mockReturnValue(
				createMessageStream([
					{
						type: "result",
						subtype: "success",
						structured_output: structuredOutput,
						total_cost_usd: 0.01,
						duration_ms: 100,
						usage: {
							// Missing all fields
						},
					},
				]),
			);

			const result = await analyzeWithClaudeCode(defaultOptions);

			expect(result.usage.inputTokens).toBe(0);
			expect(result.usage.outputTokens).toBe(0);
			expect(result.usage.cacheReadInputTokens).toBe(0);
			expect(result.usage.cacheCreationInputTokens).toBe(0);
		});

		it("passes abortController when provided", async () => {
			const structuredOutput: TestOutput = {
				summary: "Test",
				files: [],
				score: 0,
			};

			mockQuery.mockReturnValue(
				createMessageStream([
					{
						type: "result",
						subtype: "success",
						structured_output: structuredOutput,
						total_cost_usd: 0,
						duration_ms: 0,
						usage: {},
					},
				]),
			);

			const abortController = new AbortController();
			await analyzeWithClaudeCode({ ...defaultOptions, abortController });

			expect(mockQuery).toHaveBeenCalledWith(
				expect.objectContaining({
					options: expect.objectContaining({
						abortController,
					}),
				}),
			);
		});
	});

	// =========================================================================
	// Error: max turns exceeded
	// =========================================================================
	describe("error when max_turns exceeded", () => {
		it("throws ClaudeCodeAnalysisError on error_max_turns", async () => {
			mockQuery.mockReturnValue(
				createMessageStream([
					{
						type: "result",
						subtype: "error_max_turns",
					},
				]),
			);

			await expect(analyzeWithClaudeCode(defaultOptions)).rejects.toThrow(ClaudeCodeAnalysisError);
		});

		it("includes max turns message in error", async () => {
			mockQuery.mockReturnValue(
				createMessageStream([
					{
						type: "result",
						subtype: "error_max_turns",
					},
				]),
			);

			await expect(analyzeWithClaudeCode(defaultOptions)).rejects.toThrow(
				"Analysis exceeded maximum turns",
			);
		});

		it("includes errors array for max turns", async () => {
			mockQuery.mockReturnValue(
				createMessageStream([
					{
						type: "result",
						subtype: "error_max_turns",
					},
				]),
			);

			try {
				await analyzeWithClaudeCode(defaultOptions);
				expect.fail("Should have thrown");
			} catch (error) {
				expect(error).toBeInstanceOf(ClaudeCodeAnalysisError);
				expect((error as ClaudeCodeAnalysisError).errors).toEqual(["Max turns reached"]);
			}
		});
	});

	// =========================================================================
	// Error: budget exceeded
	// =========================================================================
	describe("error when budget exceeded", () => {
		it("throws ClaudeCodeAnalysisError on error_max_budget_usd", async () => {
			mockQuery.mockReturnValue(
				createMessageStream([
					{
						type: "result",
						subtype: "error_max_budget_usd",
					},
				]),
			);

			await expect(analyzeWithClaudeCode(defaultOptions)).rejects.toThrow(ClaudeCodeAnalysisError);
		});

		it("includes budget message in error", async () => {
			mockQuery.mockReturnValue(
				createMessageStream([
					{
						type: "result",
						subtype: "error_max_budget_usd",
					},
				]),
			);

			await expect(analyzeWithClaudeCode(defaultOptions)).rejects.toThrow(
				"Analysis exceeded budget",
			);
		});

		it("includes errors array for budget exceeded", async () => {
			mockQuery.mockReturnValue(
				createMessageStream([
					{
						type: "result",
						subtype: "error_max_budget_usd",
					},
				]),
			);

			try {
				await analyzeWithClaudeCode(defaultOptions);
				expect.fail("Should have thrown");
			} catch (error) {
				expect(error).toBeInstanceOf(ClaudeCodeAnalysisError);
				expect((error as ClaudeCodeAnalysisError).errors).toEqual(["Budget limit reached"]);
			}
		});
	});

	// =========================================================================
	// Execution error handling
	// =========================================================================
	describe("execution error handling", () => {
		it("throws ClaudeCodeAnalysisError on error_during_execution", async () => {
			mockQuery.mockReturnValue(
				createMessageStream([
					{
						type: "result",
						subtype: "error_during_execution",
					},
				]),
			);

			await expect(analyzeWithClaudeCode(defaultOptions)).rejects.toThrow(ClaudeCodeAnalysisError);
		});

		it("includes execution error message", async () => {
			mockQuery.mockReturnValue(
				createMessageStream([
					{
						type: "result",
						subtype: "error_during_execution",
					},
				]),
			);

			await expect(analyzeWithClaudeCode(defaultOptions)).rejects.toThrow(
				"Analysis failed during execution",
			);
		});

		it("includes errors from message when available", async () => {
			mockQuery.mockReturnValue(
				createMessageStream([
					{
						type: "result",
						subtype: "error_during_execution",
						errors: ["File not found", "Permission denied"],
					},
				]),
			);

			try {
				await analyzeWithClaudeCode(defaultOptions);
				expect.fail("Should have thrown");
			} catch (error) {
				expect(error).toBeInstanceOf(ClaudeCodeAnalysisError);
				expect((error as ClaudeCodeAnalysisError).errors).toEqual([
					"File not found",
					"Permission denied",
				]);
			}
		});

		it("handles execution error without errors array", async () => {
			mockQuery.mockReturnValue(
				createMessageStream([
					{
						type: "result",
						subtype: "error_during_execution",
						// No errors field
					},
				]),
			);

			try {
				await analyzeWithClaudeCode(defaultOptions);
				expect.fail("Should have thrown");
			} catch (error) {
				expect(error).toBeInstanceOf(ClaudeCodeAnalysisError);
				expect((error as ClaudeCodeAnalysisError).errors).toBeUndefined();
			}
		});
	});

	// =========================================================================
	// Schema validation failure
	// =========================================================================
	describe("schema validation failure", () => {
		it("throws ClaudeCodeAnalysisError on invalid output", async () => {
			// Output missing required 'score' field
			mockQuery.mockReturnValue(
				createMessageStream([
					{
						type: "result",
						subtype: "success",
						structured_output: {
							summary: "Test",
							files: [],
							// Missing score
						},
						total_cost_usd: 0,
						duration_ms: 0,
						usage: {},
					},
				]),
			);

			await expect(analyzeWithClaudeCode(defaultOptions)).rejects.toThrow(ClaudeCodeAnalysisError);
		});

		it("includes validation error message", async () => {
			mockQuery.mockReturnValue(
				createMessageStream([
					{
						type: "result",
						subtype: "success",
						structured_output: {
							summary: "Test",
							files: "not-an-array", // Wrong type
							score: 50,
						},
						total_cost_usd: 0,
						duration_ms: 0,
						usage: {},
					},
				]),
			);

			await expect(analyzeWithClaudeCode(defaultOptions)).rejects.toThrow(
				"Failed to validate output against schema",
			);
		});

		it("throws on error_max_structured_output_retries", async () => {
			mockQuery.mockReturnValue(
				createMessageStream([
					{
						type: "result",
						subtype: "error_max_structured_output_retries",
					},
				]),
			);

			await expect(analyzeWithClaudeCode(defaultOptions)).rejects.toThrow(
				"Failed to produce valid structured output after maximum retries",
			);
		});

		it("includes structured output error message", async () => {
			mockQuery.mockReturnValue(
				createMessageStream([
					{
						type: "result",
						subtype: "error_max_structured_output_retries",
					},
				]),
			);

			try {
				await analyzeWithClaudeCode(defaultOptions);
				expect.fail("Should have thrown");
			} catch (error) {
				expect(error).toBeInstanceOf(ClaudeCodeAnalysisError);
				expect((error as ClaudeCodeAnalysisError).errors).toEqual([
					"Structured output validation failed",
				]);
			}
		});
	});

	// =========================================================================
	// Empty result handling
	// =========================================================================
	describe("empty result handling", () => {
		it("throws ClaudeCodeAnalysisError when no result produced", async () => {
			// Stream ends without a result message
			mockQuery.mockReturnValue(createMessageStream([]));

			await expect(analyzeWithClaudeCode(defaultOptions)).rejects.toThrow(ClaudeCodeAnalysisError);
		});

		it("includes empty result message", async () => {
			mockQuery.mockReturnValue(createMessageStream([]));

			await expect(analyzeWithClaudeCode(defaultOptions)).rejects.toThrow(
				"Analysis completed without producing a result",
			);
		});

		it("ignores non-result messages", async () => {
			// Stream has messages but no result
			mockQuery.mockReturnValue(
				createMessageStream([
					{ type: "assistant", content: "Working..." },
					{ type: "tool_use", name: "Read" },
					{ type: "tool_result", content: "file contents" },
					// No result message
				]),
			);

			await expect(analyzeWithClaudeCode(defaultOptions)).rejects.toThrow(
				"Analysis completed without producing a result",
			);
		});

		it("throws when success result has undefined structured_output", async () => {
			mockQuery.mockReturnValue(
				createMessageStream([
					{
						type: "result",
						subtype: "success",
						structured_output: undefined,
						total_cost_usd: 0,
						duration_ms: 0,
						usage: {},
					},
				]),
			);

			await expect(analyzeWithClaudeCode(defaultOptions)).rejects.toThrow(
				"Analysis completed without producing a result",
			);
		});
	});

	// =========================================================================
	// ClaudeCodeAnalysisError tests
	// =========================================================================
	describe("ClaudeCodeAnalysisError", () => {
		it("has correct name property", () => {
			const error = new ClaudeCodeAnalysisError("Test error");
			expect(error.name).toBe("ClaudeCodeAnalysisError");
		});

		it("stores message correctly", () => {
			const error = new ClaudeCodeAnalysisError("Custom message");
			expect(error.message).toBe("Custom message");
		});

		it("stores errors array when provided", () => {
			const error = new ClaudeCodeAnalysisError("Test", ["err1", "err2"]);
			expect(error.errors).toEqual(["err1", "err2"]);
		});

		it("has undefined errors when not provided", () => {
			const error = new ClaudeCodeAnalysisError("Test");
			expect(error.errors).toBeUndefined();
		});

		it("is instanceof Error", () => {
			const error = new ClaudeCodeAnalysisError("Test");
			expect(error).toBeInstanceOf(Error);
		});
	});
});
