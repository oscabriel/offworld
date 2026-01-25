export function formatShortDate(isoString: string): string {
	return new Date(isoString).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function formatRelativeDate(isoString: string): string {
	const date = new Date(isoString);
	const now = new Date();
	const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

	if (diffDays === 0) return "today";
	if (diffDays === 1) return "yesterday";
	if (diffDays < 7) return `${diffDays} days ago`;
	return formatShortDate(isoString);
}

export function formatCompactNumber(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10000) return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
	if (count < 1000000) return `${Math.floor(count / 1000)}k`;
	return `${(count / 1000000).toFixed(1).replace(/\.0$/, "")}m`;
}
