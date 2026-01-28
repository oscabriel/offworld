import { cn } from "@/lib/utils";
import type { TocSection } from "@/lib/cli-data";

interface TableOfContentsProps {
	sections: TocSection[];
	activeSection: string;
	className?: string;
}

export function TableOfContents({ sections, activeSection, className }: TableOfContentsProps) {
	const renderTocItem = (section: TocSection, isChild = false) => {
		const isActive = activeSection === section.id;
		const hasActiveChild = section.children?.some((child) => activeSection === child.id);

		return (
			<div key={section.id}>
				<a
					href={section.id === "overview" ? "#" : `#${section.id}`}
					className={cn(
						"block py-1.5 font-mono transition-colors",
						isChild && "pl-3 text-sm",
						isActive || hasActiveChild
							? "text-primary"
							: "text-muted-foreground hover:text-foreground",
					)}
				>
					{section.label}
				</a>
				{section.children && (
					<div className="border-primary/10 ml-1 border-l">
						{section.children.map((child) => renderTocItem(child, true))}
					</div>
				)}
			</div>
		);
	};

	return (
		<nav className={cn("space-y-1", className)}>
			<p className="text-muted-foreground mb-4 font-mono text-xs tracking-widest uppercase">
				On this page
			</p>
			{sections.map((section) => renderTocItem(section))}
		</nav>
	);
}
