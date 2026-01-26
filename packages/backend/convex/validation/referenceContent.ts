export interface ContentValidationResult {
	valid: boolean;
	error?: string;
	name?: string;
	description?: string;
}

export function validateReferenceContent(content: string): ContentValidationResult {
	// Length bounds (defense in depth)
	if (content.length < 500) {
		return { valid: false, error: "Content too short (min 500 chars)" };
	}
	if (content.length > 200_000) {
		return { valid: false, error: "Content too large (max 200KB)" };
	}

	// Reject raw HTML tags (simple, conservative scan)
	if (/<\s*\/?\s*[a-zA-Z][\s\S]*?>/m.test(content)) {
		return { valid: false, error: "Raw HTML not allowed in reference content" };
	}

	// Reject unsafe link protocols (simple scan)
	if (/\]\(\s*(javascript:|data:|vbscript:)/i.test(content)) {
		return { valid: false, error: "Unsafe link protocol" };
	}

	// Validate markdown structure (no frontmatter required for references)
	// Expect at least one heading
	if (!/^#\s+.+/m.test(content)) {
		return { valid: false, error: "Reference must contain at least one markdown heading" };
	}

	return {
		valid: true,
	};
}
