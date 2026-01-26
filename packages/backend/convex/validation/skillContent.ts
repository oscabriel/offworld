export interface ContentValidationResult {
	valid: boolean;
	error?: string;
	name?: string;
	description?: string;
}

export function validateSkillContent(content: string): ContentValidationResult {
	// Length bounds (defense in depth)
	if (content.length < 500) {
		return { valid: false, error: "Content too short (min 500 chars)" };
	}
	if (content.length > 200_000) {
		return { valid: false, error: "Content too large (max 200KB)" };
	}

	// Reject raw HTML tags (simple, conservative scan)
	if (/<\s*\/?\s*[a-zA-Z][\s\S]*?>/m.test(content)) {
		return { valid: false, error: "Raw HTML not allowed in skill content" };
	}

	// Reject unsafe link protocols (simple scan)
	if (/\]\(\s*(javascript:|data:|vbscript:)/i.test(content)) {
		return { valid: false, error: "Unsafe link protocol" };
	}

	// Extract YAML frontmatter block (first --- ... --- only)
	const fmMatch = /^---\n([\s\S]*?)\n---\n/m.exec(content);
	if (!fmMatch) {
		return { valid: false, error: "Missing or invalid YAML frontmatter" };
	}

	const fmRaw = fmMatch[1] ?? "";
	const nameMatch = /^name:\s*(.+)$/m.exec(fmRaw);
	const descMatch = /^description:\s*(.+)$/m.exec(fmRaw);

	const name = nameMatch?.[1]?.trim();
	const description = descMatch?.[1]?.trim();

	if (!name) {
		return { valid: false, error: "Frontmatter missing required 'name' field" };
	}
	if (!description) {
		return { valid: false, error: "Frontmatter missing required 'description' field" };
	}
	if (name.length > 100) {
		return { valid: false, error: "Frontmatter 'name' too long (max 100 chars)" };
	}
	if (description.length > 200) {
		return { valid: false, error: "Frontmatter 'description' too long (max 200 chars)" };
	}

	return {
		valid: true,
		name,
		description,
	};
}
