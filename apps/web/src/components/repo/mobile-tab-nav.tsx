import { Link, useParams } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface MobileTabNavProps {
	className?: string;
}

export function MobileTabNav({ className }: MobileTabNavProps) {
	const { owner, repo } = useParams({ from: "/_github/$owner_/$repo" });
	const basePath = `/${owner}/${repo}`;

	return (
		<div className={cn("border-b", className)}>
			<div className="flex overflow-x-auto">
				<TabLink to={basePath}>Summary</TabLink>
				<TabLink to={`${basePath}/arch`}>Architecture</TabLink>
				<TabLink to={`${basePath}/issues`}>Issues</TabLink>
				<TabLink to={`${basePath}/pr`}>PRs</TabLink>
			</div>
		</div>
	);
}

interface TabLinkProps {
	to: string;
	children: React.ReactNode;
}

function TabLink({ to, children }: TabLinkProps) {
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
					!to.includes("/pr"),
			}}
		>
			{children}
		</Link>
	);
}
