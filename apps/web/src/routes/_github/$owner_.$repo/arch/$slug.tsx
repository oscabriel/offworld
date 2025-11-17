import { api } from "@offworld/backend/convex/_generated/api";
import type { Id } from "@offworld/backend/convex/_generated/dataModel";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { FileCode, Layers, Package, Settings } from "lucide-react";
import { ContentCard } from "@/components/repo/content-card";

export const Route = createFileRoute("/_github/$owner_/$repo/arch/$slug")({
	// Loader preloads data before navigation completes
	loader: async ({ context, params }) => {
		const { owner, repo, slug } = params;
		const fullName = `${owner}/${repo}`;

		// Preload repository data
		const repoPromise = context.convexClient.query(api.repos.getByFullName, {
			fullName,
		});

		// Wait for repo to get its ID
		const repoData = await repoPromise;

		// Preload entity data if repo exists
		if (repoData?._id) {
			await context.convexClient.query(api.architectureEntities.getBySlug, {
				repoId: repoData._id,
				slug,
			});
		}

		// Return preloaded data (TanStack Router pattern)
		return { preloaded: true };
	},
	component: EntityDetailPage,
});

function EntityDetailPage() {
	const { owner, repo, slug } = Route.useParams();
	const fullName = `${owner}/${repo}`;

	const repoStatus = useQuery(
		api.repos.getByFullName,
		fullName ? { fullName } : "skip",
	);

	const entity = useQuery(
		api.architectureEntities.getBySlug,
		repoStatus?._id ? { repoId: repoStatus._id, slug } : "skip",
	);

	const isNotIndexed = repoStatus === null;

	// Show "Repository Not Indexed" for unindexed repos
	if (isNotIndexed) {
		return (
			<ContentCard title="Repository Not Indexed">
				<p className="mb-4 font-serif text-lg text-muted-foreground leading-relaxed">
					This repository hasn't been analyzed yet. Please index the repository
					first to view architecture entities.
				</p>
				<Link
					to="/$owner/$repo"
					params={{ owner, repo }}
					className="inline-block border border-primary bg-primary px-6 py-3 font-mono text-primary-foreground hover:bg-primary/90"
				>
					Go to Summary to Index
				</Link>
			</ContentCard>
		);
	}

	// Show minimal loading state instead of "Entity Not Found"
	if (!entity) {
		return (
			<div className="space-y-8">
				{/* Empty space while loading - no visual clutter */}
				<div className="min-h-[400px]" />
			</div>
		);
	}

	const typeIcon = {
		package: <Package className="h-5 w-5" />,
		module: <Layers className="h-5 w-5" />,
		component: <FileCode className="h-5 w-5" />,
		service: <Settings className="h-5 w-5" />,
		directory: <Package className="h-5 w-5" />,
	}[entity.type];

	const complexityColor = {
		low: "text-green-500",
		medium: "text-yellow-500",
		high: "text-red-500",
	}[entity.complexity];

	return (
		<div className="space-y-8">
			{/* Entity header */}
			<div className="border border-primary/10 bg-card p-8">
				<div className="flex items-start justify-between">
					<div>
						<div className="mb-2 flex items-center gap-2">
							{typeIcon}
							<span className="font-mono text-primary/60 text-xs uppercase tracking-wider">
								{entity.type}
							</span>
						</div>
						<h1 className="font-bold font-mono text-3xl">{entity.name}</h1>
						<p className="mt-2 font-mono text-muted-foreground text-sm">
							{entity.path}
						</p>
					</div>
					<div className="text-right">
						<div className="font-mono text-muted-foreground text-xs">
							Complexity
						</div>
						<div
							className={`font-mono font-semibold text-lg ${complexityColor}`}
						>
							{entity.complexity.toUpperCase()}
						</div>
					</div>
				</div>
			</div>

			{/* Description */}
			<ContentCard title="Description">
				<p className="font-serif text-lg leading-relaxed">
					{entity.description}
				</p>
			</ContentCard>

			{/* Purpose */}
			<ContentCard title="Purpose">
				<p className="font-serif text-lg leading-relaxed">{entity.purpose}</p>
			</ContentCard>

			{/* Key Files */}
			{entity.keyFiles.length > 0 && (
				<ContentCard title="Key Files">
					<ul className="space-y-2">
						{entity.keyFiles.map((file) => (
							<li
								key={file}
								className="flex items-center gap-2 font-mono text-sm"
							>
								<FileCode className="h-4 w-4 text-muted-foreground" />
								<a
									href={`https://github.com/${fullName}/blob/${repoStatus?.defaultBranch}/${file}`}
									target="_blank"
									rel="noopener noreferrer"
									className="text-primary hover:underline"
								>
									{file}
								</a>
							</li>
						))}
					</ul>
				</ContentCard>
			)}

			{/* Dependencies */}
			{entity.dependencies.length > 0 && (
				<ContentCard title="Dependencies">
					<ul className="space-y-2">
						{entity.dependencies.map((dep) => (
							<li key={dep} className="font-mono text-sm">
								<EntityLink
									name={dep}
									repoId={repoStatus?._id}
									owner={owner}
									repo={repo}
									prefix="→"
								/>
							</li>
						))}
					</ul>
				</ContentCard>
			)}

			{/* Used By */}
			{entity.usedBy.length > 0 && (
				<ContentCard title="Used By">
					<ul className="space-y-2">
						{entity.usedBy.map((user) => (
							<li key={user} className="font-mono text-sm">
								<EntityLink
									name={user}
									repoId={repoStatus?._id}
									owner={owner}
									repo={repo}
									prefix="←"
								/>
							</li>
						))}
					</ul>
				</ContentCard>
			)}

			{/* Code Snippet */}
			{entity.codeSnippet && (
				<ContentCard title="Code Sample">
					<pre className="overflow-x-auto rounded-md border border-primary/10 bg-muted/50 p-4">
						<code className="font-mono text-sm">{entity.codeSnippet}</code>
					</pre>
				</ContentCard>
			)}
		</div>
	);
}

/**
 * Smart link component that converts entity names to clickable links
 * Falls back to plain text if entity not found
 */
function EntityLink({
	name,
	repoId,
	owner,
	repo,
	prefix,
}: {
	name: string;
	repoId: Id<"repositories"> | undefined;
	owner: string;
	repo: string;
	prefix?: string;
}) {
	// Convert name to slug (lowercase, replace spaces with dashes)
	const slug = name.toLowerCase().replace(/\s+/g, "-");

	// Query to check if entity exists
	const targetEntity = useQuery(
		api.architectureEntities.getBySlug,
		repoId ? { repoId, slug } : "skip",
	);

	// If entity exists, render as link
	if (targetEntity) {
		return (
			<Link
				to="/$owner/$repo/arch/$slug"
				params={{ owner, repo, slug }}
				className="text-primary hover:underline"
			>
				{prefix && <span className="mr-1 text-muted-foreground">{prefix}</span>}
				{name}
			</Link>
		);
	}

	// Fallback: render as plain text
	return (
		<span className="text-muted-foreground">
			{prefix && <span className="mr-1">{prefix}</span>}
			{name}
		</span>
	);
}
