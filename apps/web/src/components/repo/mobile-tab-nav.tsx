import { Link, useParams } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface MobileTabNavProps {
	className?: string;
	disabled?: boolean;
}

export function MobileTabNav({
	className,
	disabled = false,
}: MobileTabNavProps) {
	const { owner, repo } = useParams({ from: "/_github/$owner_/$repo" });
	const basePath = `/${owner}/${repo}`;

	return (
		<div className={cn("border-b", className)}>
			<div className="flex overflow-x-auto">
				<TabLink to={basePath} disabled={disabled}>
					Summary
				</TabLink>
				<TabLink to={`${basePath}/arch`} disabled={disabled}>
					Architecture
				</TabLink>
				<TabLink to={`${basePath}/issues`} disabled={disabled}>
					Issues
				</TabLink>
				<TabLink to={`${basePath}/pr`} disabled={disabled}>
					PRs
				</TabLink>
				<TabLink to={`${basePath}/chat`} disabled={disabled}>
					Chat
				</TabLink>
			</div>
		</div>
	);
}

interface TabLinkProps {
	to: string;
	children: React.ReactNode;
	disabled?: boolean;
}

function TabLink({ to, children, disabled = false }: TabLinkProps) {
	if (disabled) {
		return (
			<div className="cursor-not-allowed whitespace-nowrap border-transparent border-b-2 px-4 py-3 font-mono text-muted-foreground text-sm opacity-50">
				{children}
			</div>
		);
	}

	return (
		<Link
			to={to}
			className="whitespace-nowrap border-transparent border-b-2 px-4 py-3 font-mono text-muted-foreground text-sm hover:text-foreground"
			activeProps={{
				className: "text-foreground border-primary font-medium",
			}}
			activeOptions={{
				exact:
					!to.includes("/arch") &&
					!to.includes("/issues") &&
					!to.includes("/pr") &&
					!to.includes("/chat"),
			}}
		>
			{children}
		</Link>
	);
}
