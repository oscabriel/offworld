import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ChevronRight,
	FileCode,
	Layers,
	Package,
	Settings,
} from "lucide-react";
import { ContentCard } from "@/components/repo/content-card";
import { MarkdownContent } from "@/components/repo/markdown-content";
import { MermaidDiagram } from "@/components/repo/mermaid-diagram";

export const Route = createFileRoute("/_github/$owner_/$repo/arch/")({
	component: ArchitecturePage,
	// Note: Parent layout ($owner_.$repo/route.tsx) already preloads repo data
	// No additional loader needed here - avoids redundant preloading
});

function ArchitecturePage() {
	const { owner, repo } = Route.useParams();
	const fullName = `${owner}/${repo}`;

	// Use TanStack Query with convexQuery for proper auth handling with expectAuth: true
	const { data: repoStatus } = useSuspenseQuery(
		convexQuery(api.repos.getByFullName, { fullName }),
	);

	// Use non-suspense query for dependent data that may not exist
	const { data: entities } = useQuery({
		...convexQuery(
			api.architectureEntities.listByRepo,
			repoStatus?._id ? { repoId: repoStatus._id } : "skip",
		),
		enabled: !!repoStatus?._id,
	});

	const isProcessing = repoStatus?.indexingStatus === "processing";
	const isNotIndexed = repoStatus === null;

	// Show "Repository Not Indexed" for unindexed repos
	if (isNotIndexed) {
		return (
			<ContentCard title="Repository Not Indexed">
				<p className="mb-4 font-serif text-lg text-muted-foreground leading-relaxed">
					This repository hasn't been analyzed yet. Please index the repository
					first to view architecture.
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

	// Show analyzing state while processing
	if (isProcessing) {
		return (
			<ContentCard variant="warning">
				<h3 className="mb-2 font-mono font-semibold text-lg">
					⚡ Analyzing Architecture
				</h3>
				<p className="font-mono text-muted-foreground text-sm">
					Architecture analysis is in progress. Results will appear when ready.
				</p>
				{repoStatus?.architectureMetadata && (
					<div className="mt-4 font-mono text-muted-foreground text-xs">
						Progress: {repoStatus.architectureMetadata.completedIterations}/
						{repoStatus.architectureMetadata.totalIterations} iterations
						completed
					</div>
				)}
			</ContentCard>
		);
	}

	// No architecture yet
	if (!repoStatus?.architectureNarrative && !repoStatus?.architecture) {
		return (
			<div className="space-y-8">
				<ContentCard title="Architecture Overview">
					<p className="mt-4 font-serif text-lg text-muted-foreground">
						No architecture analysis available yet. Index this repository to
						generate architecture documentation.
					</p>
				</ContentCard>
			</div>
		);
	}

	// Group entities by type
	const packages =
		entities?.filter((e) => e.type === "package" || e.type === "directory") ||
		[];
	const modules = entities?.filter((e) => e.type === "module") || [];
	const components = entities?.filter((e) => e.type === "component") || [];
	const services = entities?.filter((e) => e.type === "service") || [];

	const allEntities = [...packages, ...modules, ...components, ...services];

	return (
		<div className="space-y-8">
			{/* Architecture Overview Text - Use narrative (clean) over raw architecture (internal) */}
			<ContentCard title="Architecture Overview">
				<MarkdownContent
					content={
						repoStatus.architectureNarrative ||
						repoStatus.architecture ||
						"No architecture overview available."
					}
				/>
			</ContentCard>

			{/* Diagrams */}
			{repoStatus.diagrams?.architecture && (
				<ContentCard title="Architecture Diagram">
					<MermaidDiagram chart={repoStatus.diagrams.architecture} />
				</ContentCard>
			)}

			{repoStatus.diagrams?.dataFlow && (
				<ContentCard title="Data Flow">
					<MermaidDiagram chart={repoStatus.diagrams.dataFlow} />
				</ContentCard>
			)}

			{repoStatus.diagrams?.routing && (
				<ContentCard title="Routing">
					<MermaidDiagram chart={repoStatus.diagrams.routing} />
				</ContentCard>
			)}

			{/* Discovered Entities */}
			{allEntities.length > 0 && (
				<ContentCard title="Discovered Architecture Entities">
					<div className="grid gap-4 md:grid-cols-2">
						{/* Packages/Directories */}
						{packages.length > 0 && (
							<div>
								<h4 className="mb-3 flex items-center gap-2 font-mono font-semibold text-muted-foreground text-sm">
									<Package className="h-4 w-4" />
									Packages & Directories ({packages.length})
								</h4>
								<div className="space-y-2">
									{packages.map((entity) => (
										<EntityCard
											key={entity._id}
											entity={entity}
											owner={owner}
											repo={repo}
										/>
									))}
								</div>
							</div>
						)}

						{/* Modules */}
						{modules.length > 0 && (
							<div>
								<h4 className="mb-3 flex items-center gap-2 font-mono font-semibold text-muted-foreground text-sm">
									<Layers className="h-4 w-4" />
									Modules ({modules.length})
								</h4>
								<div className="space-y-2">
									{modules.map((entity) => (
										<EntityCard
											key={entity._id}
											entity={entity}
											owner={owner}
											repo={repo}
										/>
									))}
								</div>
							</div>
						)}

						{/* Components */}
						{components.length > 0 && (
							<div>
								<h4 className="mb-3 flex items-center gap-2 font-mono font-semibold text-muted-foreground text-sm">
									<FileCode className="h-4 w-4" />
									Components ({components.length})
								</h4>
								<div className="space-y-2">
									{components.map((entity) => (
										<EntityCard
											key={entity._id}
											entity={entity}
											owner={owner}
											repo={repo}
										/>
									))}
								</div>
							</div>
						)}

						{/* Services */}
						{services.length > 0 && (
							<div>
								<h4 className="mb-3 flex items-center gap-2 font-mono font-semibold text-muted-foreground text-sm">
									<Settings className="h-4 w-4" />
									Services ({services.length})
								</h4>
								<div className="space-y-2">
									{services.map((entity) => (
										<EntityCard
											key={entity._id}
											entity={entity}
											owner={owner}
											repo={repo}
										/>
									))}
								</div>
							</div>
						)}
					</div>
				</ContentCard>
			)}

			{/* Metadata */}
			{repoStatus.architectureMetadata && (
				<div className="rounded-md border border-primary/10 bg-card/50 p-4">
					<div className="font-mono text-muted-foreground text-xs">
						Analysis completed in{" "}
						{repoStatus.architectureMetadata.totalIterations} iterations •
						Discovered {repoStatus.architectureMetadata.discoveredPackages}{" "}
						packages, {repoStatus.architectureMetadata.discoveredModules}{" "}
						modules, {repoStatus.architectureMetadata.discoveredComponents}{" "}
						components
					</div>
				</div>
			)}
		</div>
	);
}

interface EntityCardProps {
	entity: {
		_id: string;
		name: string;
		slug: string;
		description: string;
		complexity: "low" | "medium" | "high";
		type: "package" | "module" | "component" | "service" | "directory";
	};
	owner: string;
	repo: string;
}

function EntityCard({ entity, owner, repo }: EntityCardProps) {
	const complexityColor = {
		low: "bg-green-500/10 text-green-500",
		medium: "bg-yellow-500/10 text-yellow-500",
		high: "bg-red-500/10 text-red-500",
	}[entity.complexity];

	return (
		<Link
			to="/$owner/$repo/arch/$slug"
			params={{ owner, repo, slug: entity.slug }}
			className="group block rounded-md border border-primary/10 bg-card p-4 transition-colors hover:border-primary/30 hover:bg-card/80"
			preload="intent" // Prefetch on hover
		>
			<div className="flex items-start justify-between">
				<div className="flex-1">
					<div className="flex items-center gap-2">
						<h5 className="font-mono font-semibold text-sm">{entity.name}</h5>
						<span
							className={`rounded-full px-2 py-0.5 font-mono text-xs ${complexityColor}`}
						>
							{entity.complexity}
						</span>
					</div>
					<p className="mt-1 line-clamp-2 font-serif text-muted-foreground text-xs">
						{entity.description}
					</p>
				</div>
				<ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
			</div>
		</Link>
	);
}
