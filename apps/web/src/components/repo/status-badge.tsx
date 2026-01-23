interface StatusBadgeProps {
	status: "queued" | "processing" | "completed" | "failed" | "indexed" | "not-indexed" | string;
	variant?: "default" | "compact";
}

export function StatusBadge({ status, variant = "default" }: StatusBadgeProps) {
	const isIndexed = status === "completed" || status === "indexed";
	const isNotIndexed = status === "not-indexed";

	const styles = isIndexed
		? "bg-green-500/10 text-green-600"
		: isNotIndexed
			? "bg-yellow-500/10 text-yellow-600"
			: "bg-gray-500/10 text-gray-600";

	const label = isIndexed ? "Indexed" : "Not Indexed";

	return (
		<span
			className={`inline-flex ${variant === "compact" ? "shrink-0" : ""} items-center px-2 py-0.5 font-mono text-xs ${styles}`}
		>
			{label}
		</span>
	);
}
