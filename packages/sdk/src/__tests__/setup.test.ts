import { describe, expect, it } from "vitest";

describe("Test Setup", () => {
	it("should run vitest correctly", () => {
		expect(1 + 1).toBe(2);
	});

	it("should have access to environment", () => {
		expect(typeof process.env).toBe("object");
	});
});
