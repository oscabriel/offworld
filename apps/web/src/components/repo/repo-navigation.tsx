import { Link, useParams } from "@tanstack/react-router";
import { AlertCircle, FileText, GitBranch, GitPullRequest } from "lucide-react";

export function RepoNavigation() {
	const { owner, repo } = useParams({ from: "/_github/$owner_/$repo" });
	const basePath = `/${owner}/${repo}`;

	return (
		<nav className="space-y-1">
			<NavLink to={basePath} icon={FileText}>
				Summary
			</NavLink>
			<NavLink to={`${basePath}/arch`} icon={GitBranch}>
				Architecture
			</NavLink>
			<NavLink to={`${basePath}/issues`} icon={AlertCircle}>
				Issues
			</NavLink>
			<NavLink to={`${basePath}/pr`} icon={GitPullRequest}>
				PRs
			</NavLink>
		</nav>
	);
}

interface NavLinkProps {
	to: string;
	icon: React.ComponentType<{ className?: string }>;
	children: React.ReactNode;
}

function NavLink({ to, icon: Icon, children }: NavLinkProps) {
	return (
		<Link
			to={to}
			className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent"
			activeProps={{
				className: "bg-accent font-medium",
			}}
			activeOptions={{
				exact:
					!to.includes("/arch") &&
					!to.includes("/issues") &&
					!to.includes("/pr"),
			}}
		>
			<Icon className="h-4 w-4" />
			<span className="font-mono text-sm">{children}</span>
		</Link>
	);
}
