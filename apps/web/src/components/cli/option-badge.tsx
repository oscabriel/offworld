interface OptionBadgeProps {
	children: React.ReactNode;
}

export function OptionBadge({ children }: OptionBadgeProps) {
	return (
		<code className="bg-background border-primary/20 text-primary border px-2 py-1 font-mono whitespace-nowrap">
			{children}
		</code>
	);
}
