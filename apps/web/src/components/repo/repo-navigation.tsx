import { api } from "@offworld/backend/convex/_generated/api";
import { Link, useLocation, useParams } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
	AlertCircle,
	FileCode,
	FileText,
	GitBranch,
	GitPullRequest,
	Layers,
	MessageSquare,
	Package,
	RefreshCw,
	Settings,
} from "lucide-react";

interface RepoNavigationProps {
	disabled?: boolean;
}

export function RepoNavigation({ disabled = false }: RepoNavigationProps) {
	const { owner, repo } = useParams({ from: "/_github/$owner_/$repo" });
	const location = useLocation();
	const basePath = `/${owner}/${repo}`;
	const fullName = `${owner}/${repo}`;

	// Query repository data to get entities
	const repoData = useQuery(
		api.repos.getByFullName,
		fullName && !disabled ? { fullName } : "skip",
	);

	const entities = useQuery(
		api.architectureEntities.listByRepo,
		repoData?._id && !disabled ? { repoId: repoData._id } : "skip",
	);

	// Check if we're on an arch route
	const isArchRoute = location.pathname.includes("/arch");

	return (
		<nav className="space-y-1">
			<NavLink to={basePath} icon={FileText} disabled={disabled}>
				Summary
			</NavLink>
			<NavLink to={`${basePath}/arch`} icon={GitBranch} disabled={disabled}>
				Architecture
			</NavLink>

			{/* Architecture Subroutes - Show when on arch page and entities exist */}
			{isArchRoute && entities && entities.length > 0 && (
				<div className="ml-6 space-y-1 border-primary/10 border-l pl-3">
					{/* Show top entities by rank (limit to 15 total) */}
					{entities
						.sort((a, b) => (a.rank || 999) - (b.rank || 999))
						.slice(0, 15)
						.map((entity) => {
							const Icon = {
								package: Package,
								directory: Package,
								module: Layers,
								component: FileCode,
								service: Settings,
							}[entity.type];

							return (
								<SubNavLink
									key={entity._id}
									to={`${basePath}/arch/${entity.slug}`}
									icon={Icon}
								>
									{entity.name}
								</SubNavLink>
							);
						})}
					{entities.length > 15 && (
						<div className="px-2 py-1 font-mono text-muted-foreground text-xs">
							+{entities.length - 15} more
						</div>
					)}
				</div>
			)}

			<NavLink to={`${basePath}/issues`} icon={AlertCircle} disabled={disabled}>
				Issues
			</NavLink>
			<NavLink to={`${basePath}/pr`} icon={GitPullRequest} disabled={disabled}>
				PRs
			</NavLink>
			<NavLink to={`${basePath}/chat`} icon={MessageSquare} disabled={disabled}>
				Chat
			</NavLink>
			<NavLink to={`${basePath}/refresh`} icon={RefreshCw} disabled={disabled}>
				Refresh
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
					!to.includes("/chat") &&
					!to.includes("/refresh"),
			}}
		>
			<Icon className="h-4 w-4" />
			<span className="font-mono text-sm">{children}</span>
		</Link>
	);
}

interface SubNavLinkProps {
	to: string;
	icon: React.ComponentType<{ className?: string }>;
	children: React.ReactNode;
}

function SubNavLink({ to, icon: Icon, children }: SubNavLinkProps) {
	return (
		<Link
			to={to}
			className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/50"
			activeProps={{
				className: "bg-accent/70 font-medium",
			}}
			preload="intent" // Prefetch on hover for instant navigation
		>
			<Icon className="h-3.5 w-3.5 text-muted-foreground" />
			<span className="truncate font-mono text-xs">{children}</span>
		</Link>
	);
}
