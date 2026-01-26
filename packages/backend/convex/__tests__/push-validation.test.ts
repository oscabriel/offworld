import { describe, it, expect } from "vitest";
import { validatePushArgs } from "../validation/push";
import { validateSkillContent } from "../validation/skillContent";

describe("Push Input Validation", () => {
	describe("validatePushArgs", () => {
		const validArgs = {
			fullName: "owner/repo",
			skillName: "my-skill",
			skillDescription: "A test skill",
			skillContent: "a".repeat(500),
			commitSha: "a".repeat(40),
			analyzedAt: new Date().toISOString(),
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

		it("rejects invalid skillName format", () => {
			const result = validatePushArgs({ ...validArgs, skillName: "Invalid-Name" });
			expect(result.valid).toBe(false);
			expect(result.field).toBe("skillName");
		});

		it("rejects short content", () => {
			const result = validatePushArgs({ ...validArgs, skillContent: "short" });
			expect(result.valid).toBe(false);
			expect(result.field).toBe("skillContent");
		});

		it("rejects oversized content", () => {
			const result = validatePushArgs({ ...validArgs, skillContent: "a".repeat(200_001) });
			expect(result.valid).toBe(false);
			expect(result.field).toBe("skillContent");
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

		it("rejects future-dated analyzedAt", () => {
			const future = new Date(Date.now() + 10 * 60_000).toISOString();
			const result = validatePushArgs({ ...validArgs, analyzedAt: future });
			expect(result.valid).toBe(false);
			expect(result.field).toBe("analyzedAt");
		});

		it("accepts analyzedAt within 5 min of now", () => {
			const nearFuture = new Date(Date.now() + 3 * 60_000).toISOString();
			const result = validatePushArgs({ ...validArgs, analyzedAt: nearFuture });
			expect(result.valid).toBe(true);
		});
	});
});

describe("Skill Content Validation", () => {
	const validContent = `---
name: Test Skill
description: A test skill for testing
---

# Test Skill

This is a test skill with enough content to pass validation.

${"Lorem ipsum ".repeat(50)}
`;

	it("accepts valid content", () => {
		const result = validateSkillContent(validContent);
		expect(result.valid).toBe(true);
		expect(result.name).toBe("Test Skill");
		expect(result.description).toBe("A test skill for testing");
	});

	it("rejects content without frontmatter", () => {
		const result = validateSkillContent("a".repeat(500));
		expect(result.valid).toBe(false);
		expect(result.error).toContain("frontmatter");
	});

	it("rejects content with HTML tags", () => {
		const htmlContent = `---
name: Test
description: Test
---

<script>alert('xss')</script>

${"a".repeat(500)}
`;
		const result = validateSkillContent(htmlContent);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("HTML");
	});

	it("rejects javascript: links", () => {
		const jsContent = `---
name: Test
description: Test
---

[Click me](javascript:alert('xss'))

${"a".repeat(500)}
`;
		const result = validateSkillContent(jsContent);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Unsafe link");
	});

	it("rejects data: links", () => {
		const dataContent = `---
name: Test
description: Test
---

[Image](data:text/plain,hello)

${"a".repeat(500)}
`;
		const result = validateSkillContent(dataContent);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Unsafe link");
	});

	it("rejects content too short", () => {
		const result = validateSkillContent("short");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("too short");
	});

	it("rejects content too large", () => {
		const largeContent = `---
name: Test
description: Test
---

${"a".repeat(200_001)}
`;
		const result = validateSkillContent(largeContent);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("too large");
	});

	it("rejects missing name in frontmatter", () => {
		const content = `---
description: A test
---

${"a".repeat(500)}
`;
		const result = validateSkillContent(content);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("name");
	});

	it("rejects missing description in frontmatter", () => {
		const content = `---
name: Test
---

${"a".repeat(500)}
`;
		const result = validateSkillContent(content);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("description");
	});

	it("rejects name too long in frontmatter", () => {
		const content = `---
name: ${"a".repeat(101)}
description: Test
---

${"a".repeat(500)}
`;
		const result = validateSkillContent(content);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("name");
		expect(result.error).toContain("too long");
	});

	it("rejects description too long in frontmatter", () => {
		const content = `---
name: Test
description: ${"a".repeat(201)}
---

${"a".repeat(500)}
`;
		const result = validateSkillContent(content);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("description");
		expect(result.error).toContain("too long");
	});
});
