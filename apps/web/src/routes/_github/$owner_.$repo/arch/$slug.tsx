import { api } from "@offworld/backend/convex/_generated/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowLeft, FileCode, Layers, Package, Settings } from "lucide-react";
import { ContentCard } from "@/components/repo/content-card";

export const Route = createFileRoute("/_github/$owner_/$repo/arch/$slug")({
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

	if (!entity) {
		return (
			<div className="space-y-8">
				<Link
					to="/$owner/$repo/arch"
					params={{ owner, repo }}
					className="inline-flex items-center gap-2 font-mono text-muted-foreground text-sm hover:text-foreground"
				>
					<ArrowLeft className="h-4 w-4" />
					Back to Architecture
				</Link>
				<ContentCard>
					<h2 className="font-mono font-semibold text-2xl">Entity not found</h2>
					<p className="mt-4 font-serif text-lg text-muted-foreground">
						No entity found with slug "{slug}". It may not exist or the
						repository hasn't been analyzed yet.
					</p>
				</ContentCard>
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
			{/* Back navigation */}
			<Link
				to="/$owner/$repo/arch"
				params={{ owner, repo }}
				className="inline-flex items-center gap-2 font-mono text-muted-foreground text-sm hover:text-foreground"
			>
				<ArrowLeft className="h-4 w-4" />
				Back to Architecture
			</Link>

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
							<li key={dep} className="font-mono text-muted-foreground text-sm">
								→ {dep}
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
							<li
								key={user}
								className="font-mono text-muted-foreground text-sm"
							>
								← {user}
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
