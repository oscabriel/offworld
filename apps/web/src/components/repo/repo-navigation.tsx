import { Link, useParams } from "@tanstack/react-router";
import {
	AlertCircle,
	FileText,
	GitBranch,
	GitPullRequest,
	MessageSquare,
} from "lucide-react";

interface RepoNavigationProps {
	disabled?: boolean;
}

export function RepoNavigation({ disabled = false }: RepoNavigationProps) {
	const { owner, repo } = useParams({ from: "/_github/$owner_/$repo" });
	const basePath = `/${owner}/${repo}`;

	return (
		<nav className="space-y-1">
			<NavLink to={basePath} icon={FileText} disabled={disabled}>
				Summary
			</NavLink>
			<NavLink to={`${basePath}/arch`} icon={GitBranch} disabled={disabled}>
				Architecture
			</NavLink>
			<NavLink to={`${basePath}/issues`} icon={AlertCircle} disabled={disabled}>
				Issues
			</NavLink>
			<NavLink to={`${basePath}/pr`} icon={GitPullRequest} disabled={disabled}>
				PRs
			</NavLink>
			<NavLink to={`${basePath}/chat`} icon={MessageSquare} disabled={disabled}>
				Chat
			</NavLink>
		</nav>
	);
}

interface NavLinkProps {
	to: string;
	icon: React.ComponentType<{ className?: string }>;
	children: React.ReactNode;
	disabled?: boolean;
}

function NavLink({ to, icon: Icon, children, disabled = false }: NavLinkProps) {
	if (disabled) {
		return (
			<div className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 opacity-50">
				<Icon className="h-4 w-4" />
				<span className="font-mono text-sm">{children}</span>
			</div>
		);
	}

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
					!to.includes("/pr") &&
					!to.includes("/chat"),
			}}
		>
			<Icon className="h-4 w-4" />
			<span className="font-mono text-sm">{children}</span>
		</Link>
	);
}
