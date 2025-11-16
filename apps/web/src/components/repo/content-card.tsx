import type { ReactNode } from "react";

interface ContentCardProps {
	title?: string;
	children: ReactNode;
	variant?: "default" | "error" | "warning";
}

export function ContentCard({
	title,
	children,
	variant = "default",
}: ContentCardProps) {
	const borderColor =
		variant === "error"
			? "border-red-500/20"
			: variant === "warning"
				? "border-yellow-500/20"
				: "border-primary/10";

	const bgColor =
		variant === "error"
			? "bg-card"
			: variant === "warning"
				? "bg-yellow-500/5"
				: "bg-card";

	return (
		<div className={`space-y-6 border ${borderColor} ${bgColor} p-8`}>
			{title && <h2 className="font-mono font-semibold text-2xl">{title}</h2>}
			{children}
		</div>
	);
}
