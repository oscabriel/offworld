import { describe, it, expect } from "vitest";
import { validatePushArgs } from "../validation/push";
import { validateReferenceContent } from "../validation/referenceContent";

describe("Push Input Validation", () => {
	describe("validatePushArgs", () => {
		const validArgs = {
			fullName: "owner/repo",
			referenceName: "my-reference",
			referenceDescription: "A test reference",
			referenceContent: "# Heading\n\n" + "a".repeat(500),
			commitSha: "a".repeat(40),
			generatedAt: new Date().toISOString(),
		};

		it("accepts valid args", () => {
			expect(validatePushArgs(validArgs)).toEqual({ valid: true });
		});

		it("rejects short fullName", () => {
			const result = validatePushArgs({ ...validArgs, fullName: "a" }); // 1 char < 3 min
			expect(result.valid).toBe(false);
			expect(result.field).toBe("fullName");
		});

		it("rejects invalid fullName format", () => {
			const result = validatePushArgs({ ...validArgs, fullName: "invalid" });
			expect(result.valid).toBe(false);
			expect(result.error).toContain("owner/repo");
		});

		it("rejects invalid referenceName format", () => {
			const result = validatePushArgs({ ...validArgs, referenceName: "Invalid-Name" });
			expect(result.valid).toBe(false);
			expect(result.field).toBe("referenceName");
		});

		it("rejects short content", () => {
			const result = validatePushArgs({ ...validArgs, referenceContent: "short" });
			expect(result.valid).toBe(false);
			expect(result.field).toBe("referenceContent");
		});

		it("rejects oversized content", () => {
			const result = validatePushArgs({ ...validArgs, referenceContent: "a".repeat(200_001) });
			expect(result.valid).toBe(false);
			expect(result.field).toBe("referenceContent");
		});

		it("rejects invalid commit SHA length", () => {
			const result = validatePushArgs({ ...validArgs, commitSha: "invalid" });
			expect(result.valid).toBe(false);
			expect(result.field).toBe("commitSha");
		});

		it("rejects invalid commit SHA format", () => {
			const result = validatePushArgs({ ...validArgs, commitSha: "G".repeat(40) });
			expect(result.valid).toBe(false);
			expect(result.field).toBe("commitSha");
		});

		it("rejects future-dated generatedAt", () => {
			const future = new Date(Date.now() + 10 * 60_000).toISOString();
			const result = validatePushArgs({ ...validArgs, generatedAt: future });
			expect(result.valid).toBe(false);
			expect(result.field).toBe("generatedAt");
		});

		it("accepts generatedAt within 5 min of now", () => {
			const nearFuture = new Date(Date.now() + 3 * 60_000).toISOString();
			const result = validatePushArgs({ ...validArgs, generatedAt: nearFuture });
			expect(result.valid).toBe(true);
		});
	});
});

describe("Reference Content Validation", () => {
	const validContent = `# Test Reference

This is a test reference with enough content to pass validation.

${"Lorem ipsum ".repeat(50)}
`;

	it("accepts valid content", () => {
		const result = validateReferenceContent(validContent);
		expect(result.valid).toBe(true);
	});

	it("rejects content without heading", () => {
		const result = validateReferenceContent("a".repeat(500));
		expect(result.valid).toBe(false);
		expect(result.error).toContain("heading");
	});

	it("rejects content with HTML tags", () => {
		const htmlContent = `# Test

<script>alert('xss')</script>

${"a".repeat(500)}
`;
		const result = validateReferenceContent(htmlContent);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("HTML");
	});

	it("rejects javascript: links", () => {
		const jsContent = `# Test

[Click me](javascript:alert('xss'))

${"a".repeat(500)}
`;
		const result = validateReferenceContent(jsContent);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Unsafe link");
	});

	it("rejects data: links", () => {
		const dataContent = `# Test

[Image](data:text/plain,hello)

${"a".repeat(500)}
`;
		const result = validateReferenceContent(dataContent);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Unsafe link");
	});

	it("rejects content too short", () => {
		const result = validateReferenceContent("short");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("too short");
	});

	it("rejects content too large", () => {
		const largeContent = `# Test

${"a".repeat(200_001)}
`;
		const result = validateReferenceContent(largeContent);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("too large");
	});
});
