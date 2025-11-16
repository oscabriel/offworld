interface StatusBadgeProps {
	status: "queued" | "processing" | "completed" | "failed" | string;
	variant?: "default" | "compact";
}

export function StatusBadge({ status, variant = "default" }: StatusBadgeProps) {
	const getStatusStyles = () => {
		switch (status) {
			case "completed":
				return "bg-green-500/10 text-green-600";
			case "processing":
				return "bg-yellow-500/10 text-yellow-600";
			case "failed":
				return "bg-red-500/10 text-red-600";
			case "queued":
				return "bg-blue-500/10 text-blue-600";
			default:
				return "bg-gray-500/10 text-gray-600";
		}
	};

	return (
		<span
			className={`inline-flex ${variant === "compact" ? "shrink-0" : ""} items-center ${variant === "compact" ? "px-2 py-1" : "px-3 py-1"} font-medium font-mono text-xs ${getStatusStyles()}`}
		>
			{status === "completed"
				? "Indexed"
				: status.charAt(0).toUpperCase() + status.slice(1)}
		</span>
	);
}
