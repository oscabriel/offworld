/**
 * Unit tests for OpenCode SDK wrapper
 * PRD T3.2
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// ============================================================================
// Mock setup
// ============================================================================

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock client methods
const mockSessionCreate = vi.fn();
const mockSessionPrompt = vi.fn();
const mockSessionMessages = vi.fn();
const mockSessionDelete = vi.fn();

// Mock the OpenCode SDK
vi.mock("@opencode-ai/sdk", () => ({
	createOpencodeClient: () => ({
		session: {
			create: mockSessionCreate,
			prompt: mockSessionPrompt,
			messages: mockSessionMessages,
			delete: mockSessionDelete,
		},
	}),
}));

import {
	analyzeWithOpenCode,
	OpenCodeAnalysisError,
	OpenCodeConnectionError,
	type OpenCodeAnalysisOptions,
} from "../ai/opencode.js";

describe("ai/opencode.ts", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Default: health check passes
		mockFetch.mockResolvedValue({ ok: true });
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	// Test schema for structured output
	const testSchema = z.object({
		summary: z.string(),
		files: z.array(z.string()),
		score: z.number(),
	});

	type TestOutput = z.infer<typeof testSchema>;

	const defaultOptions: OpenCodeAnalysisOptions<typeof testSchema> = {
		prompt: "Analyze this repository",
		cwd: "/test/repo",
		schema: testSchema,
	};

	// Helper to create valid structured output
	const validOutput: TestOutput = {
		summary: "A test repository",
		files: ["index.ts", "package.json"],
		score: 85,
	};

	// Helper to setup successful analysis flow
	function setupSuccessfulAnalysis(output: TestOutput = validOutput) {
		mockSessionCreate.mockResolvedValue({ data: { id: "session-123" } });
		mockSessionPrompt.mockResolvedValue({ data: {} });
		mockSessionMessages.mockResolvedValue({
			data: [
				{
					id: "msg-1",
					role: "assistant",
					parts: [{ type: "text", text: JSON.stringify(output) }],
				},
			],
		});
		mockSessionDelete.mockResolvedValue(undefined);
	}

	// =========================================================================
	// Server health check passes -> successful analysis
	// =========================================================================
	describe("server health check passes -> successful analysis", () => {
		it("returns parsed output on success", async () => {
			setupSuccessfulAnalysis();

			const result = await analyzeWithOpenCode(defaultOptions);

			expect(result.output).toEqual(validOutput);
			expect(result.sessionId).toBe("session-123");
			expect(typeof result.durationMs).toBe("number");
		});

		it("calls health check endpoint", async () => {
			setupSuccessfulAnalysis();

			await analyzeWithOpenCode(defaultOptions);

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:4096/health",
				expect.objectContaining({
					method: "GET",
					signal: expect.any(AbortSignal),
				}),
			);
		});

		it("uses custom baseUrl for health check", async () => {
			setupSuccessfulAnalysis();

			await analyzeWithOpenCode({
				...defaultOptions,
				baseUrl: "http://custom:8080",
			});

			expect(mockFetch).toHaveBeenCalledWith("http://custom:8080/health", expect.anything());
		});

		it("creates session with title", async () => {
			setupSuccessfulAnalysis();

			await analyzeWithOpenCode({
				...defaultOptions,
				sessionTitle: "my-analysis",
			});

			expect(mockSessionCreate).toHaveBeenCalledWith({
				body: { title: "my-analysis" },
			});
		});

		it("sends prompt with model configuration", async () => {
			setupSuccessfulAnalysis();

			await analyzeWithOpenCode({
				...defaultOptions,
				model: { providerID: "openai", modelID: "gpt-4" },
			});

			expect(mockSessionPrompt).toHaveBeenCalledWith(
				expect.objectContaining({
					path: { id: "session-123" },
					body: expect.objectContaining({
						model: { providerID: "openai", modelID: "gpt-4" },
					}),
				}),
			);
		});

		it("includes system prompt in instructions when provided", async () => {
			setupSuccessfulAnalysis();

			await analyzeWithOpenCode({
				...defaultOptions,
				systemPrompt: "Focus on TypeScript files",
			});

			expect(mockSessionPrompt).toHaveBeenCalledWith(
				expect.objectContaining({
					body: expect.objectContaining({
						parts: expect.arrayContaining([
							expect.objectContaining({
								text: expect.stringContaining("Focus on TypeScript files"),
							}),
						]),
					}),
				}),
			);
		});

		it("handles markdown-wrapped JSON response", async () => {
			mockSessionCreate.mockResolvedValue({ data: { id: "session-123" } });
			mockSessionPrompt.mockResolvedValue({ data: {} });
			mockSessionMessages.mockResolvedValue({
				data: [
					{
						id: "msg-1",
						role: "assistant",
						parts: [{ type: "text", text: "```json\n" + JSON.stringify(validOutput) + "\n```" }],
					},
				],
			});
			mockSessionDelete.mockResolvedValue(undefined);

			const result = await analyzeWithOpenCode(defaultOptions);

			expect(result.output).toEqual(validOutput);
		});

		it("handles plain markdown code block response", async () => {
			mockSessionCreate.mockResolvedValue({ data: { id: "session-123" } });
			mockSessionPrompt.mockResolvedValue({ data: {} });
			mockSessionMessages.mockResolvedValue({
				data: [
					{
						id: "msg-1",
						role: "assistant",
						parts: [{ type: "text", text: "```\n" + JSON.stringify(validOutput) + "\n```" }],
					},
				],
			});
			mockSessionDelete.mockResolvedValue(undefined);

			const result = await analyzeWithOpenCode(defaultOptions);

			expect(result.output).toEqual(validOutput);
		});

		it("retrieves last assistant message from conversation", async () => {
			mockSessionCreate.mockResolvedValue({ data: { id: "session-123" } });
			mockSessionPrompt.mockResolvedValue({ data: {} });
			mockSessionMessages.mockResolvedValue({
				data: [
					{ id: "msg-1", role: "user", parts: [{ type: "text", text: "prompt" }] },
					{
						id: "msg-2",
						role: "assistant",
						parts: [
							{ type: "text", text: JSON.stringify({ summary: "first", files: [], score: 1 }) },
						],
					},
					{
						id: "msg-3",
						role: "assistant",
						parts: [{ type: "text", text: JSON.stringify(validOutput) }],
					},
				],
			});
			mockSessionDelete.mockResolvedValue(undefined);

			const result = await analyzeWithOpenCode(defaultOptions);

			// Should get the last assistant message
			expect(result.output).toEqual(validOutput);
		});
	});

	// =========================================================================
	// Server health check fails -> OpenCodeConnectionError
	// =========================================================================
	describe("server health check fails -> OpenCodeConnectionError", () => {
		it("throws OpenCodeConnectionError when server returns non-ok", async () => {
			mockFetch.mockResolvedValue({ ok: false, status: 503 });

			await expect(analyzeWithOpenCode(defaultOptions)).rejects.toThrow(OpenCodeConnectionError);
		});

		it("throws OpenCodeConnectionError when fetch throws", async () => {
			mockFetch.mockRejectedValue(new Error("Network error"));

			await expect(analyzeWithOpenCode(defaultOptions)).rejects.toThrow(OpenCodeConnectionError);
		});

		it("includes baseUrl in connection error message", async () => {
			mockFetch.mockResolvedValue({ ok: false });

			await expect(analyzeWithOpenCode(defaultOptions)).rejects.toThrow(
				"Cannot connect to OpenCode server at http://localhost:4096",
			);
		});

		it("includes custom baseUrl in connection error", async () => {
			mockFetch.mockResolvedValue({ ok: false });

			await expect(
				analyzeWithOpenCode({
					...defaultOptions,
					baseUrl: "http://my-server:9000",
				}),
			).rejects.toThrow("Cannot connect to OpenCode server at http://my-server:9000");
		});

		it("suggests running opencode server in error message", async () => {
			mockFetch.mockResolvedValue({ ok: false });

			await expect(analyzeWithOpenCode(defaultOptions)).rejects.toThrow(
				"Ensure OpenCode is running with: opencode server",
			);
		});
	});

	// =========================================================================
	// Session creation failure
	// =========================================================================
	describe("session creation failure", () => {
		it("throws OpenCodeAnalysisError when session creation fails", async () => {
			mockSessionCreate.mockRejectedValue(new Error("Session limit reached"));

			await expect(analyzeWithOpenCode(defaultOptions)).rejects.toThrow(Error);
		});

		it("propagates session creation error message", async () => {
			mockSessionCreate.mockRejectedValue(new Error("Session limit reached"));

			await expect(analyzeWithOpenCode(defaultOptions)).rejects.toThrow("Session limit reached");
		});
	});

	// =========================================================================
	// Invalid JSON response
	// =========================================================================
	describe("invalid JSON response", () => {
		it("throws OpenCodeAnalysisError on invalid JSON", async () => {
			mockSessionCreate.mockResolvedValue({ data: { id: "session-123" } });
			mockSessionPrompt.mockResolvedValue({ data: {} });
			mockSessionMessages.mockResolvedValue({
				data: [
					{
						id: "msg-1",
						role: "assistant",
						parts: [{ type: "text", text: "This is not valid JSON" }],
					},
				],
			});
			mockSessionDelete.mockResolvedValue(undefined);

			await expect(analyzeWithOpenCode(defaultOptions)).rejects.toThrow(OpenCodeAnalysisError);
		});

		it("includes truncated response in parse error", async () => {
			mockSessionCreate.mockResolvedValue({ data: { id: "session-123" } });
			mockSessionPrompt.mockResolvedValue({ data: {} });
			mockSessionMessages.mockResolvedValue({
				data: [
					{
						id: "msg-1",
						role: "assistant",
						parts: [{ type: "text", text: "Invalid JSON content here" }],
					},
				],
			});
			mockSessionDelete.mockResolvedValue(undefined);

			await expect(analyzeWithOpenCode(defaultOptions)).rejects.toThrow(
				"Failed to parse JSON response",
			);
		});

		it("throws OpenCodeAnalysisError on schema validation failure", async () => {
			mockSessionCreate.mockResolvedValue({ data: { id: "session-123" } });
			mockSessionPrompt.mockResolvedValue({ data: {} });
			mockSessionMessages.mockResolvedValue({
				data: [
					{
						id: "msg-1",
						role: "assistant",
						parts: [{ type: "text", text: JSON.stringify({ wrong: "shape" }) }],
					},
				],
			});
			mockSessionDelete.mockResolvedValue(undefined);

			await expect(analyzeWithOpenCode(defaultOptions)).rejects.toThrow(OpenCodeAnalysisError);
		});

		it("includes schema validation message in error", async () => {
			mockSessionCreate.mockResolvedValue({ data: { id: "session-123" } });
			mockSessionPrompt.mockResolvedValue({ data: {} });
			mockSessionMessages.mockResolvedValue({
				data: [
					{
						id: "msg-1",
						role: "assistant",
						parts: [{ type: "text", text: JSON.stringify({ summary: 123 }) }], // Wrong type
					},
				],
			});
			mockSessionDelete.mockResolvedValue(undefined);

			await expect(analyzeWithOpenCode(defaultOptions)).rejects.toThrow(
				"Response did not match expected schema",
			);
		});

		it("throws when no assistant message found", async () => {
			mockSessionCreate.mockResolvedValue({ data: { id: "session-123" } });
			mockSessionPrompt.mockResolvedValue({ data: {} });
			mockSessionMessages.mockResolvedValue({
				data: [{ id: "msg-1", role: "user", parts: [{ type: "text", text: "prompt" }] }],
			});
			mockSessionDelete.mockResolvedValue(undefined);

			await expect(analyzeWithOpenCode(defaultOptions)).rejects.toThrow(
				"No response received from OpenCode",
			);
		});

		it("throws when assistant message has no text part", async () => {
			mockSessionCreate.mockResolvedValue({ data: { id: "session-123" } });
			mockSessionPrompt.mockResolvedValue({ data: {} });
			mockSessionMessages.mockResolvedValue({
				data: [
					{
						id: "msg-1",
						role: "assistant",
						parts: [{ type: "image", url: "http://example.com/img.png" }],
					},
				],
			});
			mockSessionDelete.mockResolvedValue(undefined);

			await expect(analyzeWithOpenCode(defaultOptions)).rejects.toThrow(
				"Response did not contain text content",
			);
		});
	});

	// =========================================================================
	// Session cleanup on error (finally block)
	// =========================================================================
	describe("session cleanup on error (finally block)", () => {
		it("deletes session after successful analysis", async () => {
			setupSuccessfulAnalysis();

			await analyzeWithOpenCode(defaultOptions);

			expect(mockSessionDelete).toHaveBeenCalledWith({ path: { id: "session-123" } });
		});

		it("deletes session when prompt fails", async () => {
			mockSessionCreate.mockResolvedValue({ data: { id: "session-456" } });
			mockSessionPrompt.mockRejectedValue(new Error("Prompt failed"));
			mockSessionDelete.mockResolvedValue(undefined);

			await expect(analyzeWithOpenCode(defaultOptions)).rejects.toThrow("Prompt failed");

			expect(mockSessionDelete).toHaveBeenCalledWith({ path: { id: "session-456" } });
		});

		it("deletes session when messages retrieval fails", async () => {
			mockSessionCreate.mockResolvedValue({ data: { id: "session-789" } });
			mockSessionPrompt.mockResolvedValue({ data: {} });
			mockSessionMessages.mockRejectedValue(new Error("Messages failed"));
			mockSessionDelete.mockResolvedValue(undefined);

			await expect(analyzeWithOpenCode(defaultOptions)).rejects.toThrow("Messages failed");

			expect(mockSessionDelete).toHaveBeenCalledWith({ path: { id: "session-789" } });
		});

		it("deletes session when JSON parsing fails", async () => {
			mockSessionCreate.mockResolvedValue({ data: { id: "session-abc" } });
			mockSessionPrompt.mockResolvedValue({ data: {} });
			mockSessionMessages.mockResolvedValue({
				data: [
					{
						id: "msg-1",
						role: "assistant",
						parts: [{ type: "text", text: "not json" }],
					},
				],
			});
			mockSessionDelete.mockResolvedValue(undefined);

			await expect(analyzeWithOpenCode(defaultOptions)).rejects.toThrow(OpenCodeAnalysisError);

			expect(mockSessionDelete).toHaveBeenCalledWith({ path: { id: "session-abc" } });
		});

		it("ignores session deletion errors", async () => {
			mockSessionCreate.mockResolvedValue({ data: { id: "session-123" } });
			mockSessionPrompt.mockResolvedValue({ data: {} });
			mockSessionMessages.mockResolvedValue({
				data: [
					{
						id: "msg-1",
						role: "assistant",
						parts: [{ type: "text", text: JSON.stringify(validOutput) }],
					},
				],
			});
			mockSessionDelete.mockRejectedValue(new Error("Delete failed"));

			// Should not throw despite delete failing
			const result = await analyzeWithOpenCode(defaultOptions);

			expect(result.output).toEqual(validOutput);
		});
	});

	// =========================================================================
	// Timeout handling
	// =========================================================================
	describe("timeout handling", () => {
		it("uses AbortController for health check timeout", async () => {
			// Verify that fetch is called with an AbortSignal
			setupSuccessfulAnalysis();

			await analyzeWithOpenCode(defaultOptions);

			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					signal: expect.any(AbortSignal),
				}),
			);
		});

		it("handles health check abort/timeout", async () => {
			const abortError = new Error("The operation was aborted");
			abortError.name = "AbortError";
			mockFetch.mockRejectedValue(abortError);

			await expect(analyzeWithOpenCode(defaultOptions)).rejects.toThrow(OpenCodeConnectionError);
		});
	});

	// =========================================================================
	// OpenCodeAnalysisError tests
	// =========================================================================
	describe("OpenCodeAnalysisError", () => {
		it("has correct name property", () => {
			const error = new OpenCodeAnalysisError("Test error");
			expect(error.name).toBe("OpenCodeAnalysisError");
		});

		it("stores message correctly", () => {
			const error = new OpenCodeAnalysisError("Custom message");
			expect(error.message).toBe("Custom message");
		});

		it("stores details when provided", () => {
			const details = { code: "ERR_001", context: { file: "test.ts" } };
			const error = new OpenCodeAnalysisError("Test", details);
			expect(error.details).toEqual(details);
		});

		it("has undefined details when not provided", () => {
			const error = new OpenCodeAnalysisError("Test");
			expect(error.details).toBeUndefined();
		});

		it("is instanceof Error", () => {
			const error = new OpenCodeAnalysisError("Test");
			expect(error).toBeInstanceOf(Error);
		});
	});

	// =========================================================================
	// OpenCodeConnectionError tests
	// =========================================================================
	describe("OpenCodeConnectionError", () => {
		it("has correct name property", () => {
			const error = new OpenCodeConnectionError("http://localhost:4096");
			expect(error.name).toBe("OpenCodeConnectionError");
		});

		it("is instanceof OpenCodeAnalysisError", () => {
			const error = new OpenCodeConnectionError("http://localhost:4096");
			expect(error).toBeInstanceOf(OpenCodeAnalysisError);
		});

		it("is instanceof Error", () => {
			const error = new OpenCodeConnectionError("http://localhost:4096");
			expect(error).toBeInstanceOf(Error);
		});

		it("includes baseUrl in message", () => {
			const error = new OpenCodeConnectionError("http://custom:8080");
			expect(error.message).toContain("http://custom:8080");
		});
	});
});
