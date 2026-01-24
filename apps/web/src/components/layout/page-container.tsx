import { cn } from "@/lib/utils";

interface PageContainerProps {
	children: React.ReactNode;
	className?: string;
	as?: "div" | "section" | "article";
}

export function PageContainer({ children, className, as: Component = "div" }: PageContainerProps) {
	return (
		<Component
			className={cn(
				"container mx-auto max-w-7xl px-5 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl",
				className,
			)}
		>
			{children}
		</Component>
	);
}
