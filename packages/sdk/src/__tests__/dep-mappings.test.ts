/**
 * Unit tests for dep-mappings.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addFetchRoute, installFetchMock, resetFetchMock } from "./mocks/fetch";
import { resolveDependencyRepo } from "../dep-mappings.js";

describe("dep-mappings", () => {
	const fetchMock = installFetchMock();

	beforeEach(() => {
		resetFetchMock();
		fetchMock.mockClear();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	it("resolves repo from github: spec without npm", async () => {
		const result = await resolveDependencyRepo("mypkg", "github:owner/repo", {
			allowNpm: false,
		});

		expect(result.repo).toBe("owner/repo");
		expect(result.source).toBe("spec");
	});

	it("resolves repo from git+https spec with tree path", async () => {
		const result = await resolveDependencyRepo(
			"mypkg",
			"git+https://github.com/owner/repo/tree/main#readme",
			{ allowNpm: false },
		);

		expect(result.repo).toBe("owner/repo");
		expect(result.source).toBe("spec");
	});

	it("strips .git suffix from spec repo", async () => {
		const result = await resolveDependencyRepo("mypkg", "git+https://github.com/owner/repo.git", {
			allowNpm: false,
		});

		expect(result.repo).toBe("owner/repo");
		expect(result.source).toBe("spec");
	});

	it("skips npm resolution when allowNpm is false", async () => {
		const result = await resolveDependencyRepo("zod", "^3.0.0", { allowNpm: false });

		expect(result.repo).toBeNull();
		expect(result.source).toBe("unknown");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("falls back when npm registry request times out", async () => {
		addFetchRoute({
			url: "https://registry.npmjs.org/@opencode-ai/sdk",
			response: (_url, init) =>
				new Promise((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => {
						reject(new Error("aborted"));
					});
				}),
		});

		const result = await resolveDependencyRepo("@opencode-ai/sdk", "^1.0.0", {
			npmTimeoutMs: 1,
		});

		expect(result.repo).toBe("anomalyco/opencode-sdk-js");
		expect(result.source).toBe("fallback");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
