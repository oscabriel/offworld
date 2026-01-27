import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, Terminal } from "lucide-react";
import { InstallCommandBox } from "@/components/repo/install-command-box";
import { StatusBadge } from "@/components/repo/status-badge";
import { CopyableBlock } from "@/components/ui/copyable-block";
import { formatShortDate } from "@/lib/format";

export const Route = createFileRoute("/_github/$owner/$repo/$reference")({
	staticData: {
		crumbs: (params) => [
			{
				label: params.reference ?? "",
				to: "/$owner/$repo/$reference",
				params: {
					owner: params.owner ?? "",
					repo: params.repo ?? "",
					reference: params.reference ?? "",
				},
			},
		],
	},
	component: ReferenceDetailPage,
	loader: async ({ context, params }) => {
		const fullName = `${params.owner}/${params.repo}`;
		await context.queryClient.ensureQueryData(
			convexQuery(api.references.getByName, { fullName, referenceName: params.reference }),
		);
	},
});

function ReferenceHeader({
	referenceName,
	referenceDescription,
	generatedAt,
	commitSha,
	pullCount,
	isVerified,
}: {
	referenceName: string;
	referenceDescription?: string;
	generatedAt?: string;
	commitSha?: string;
	pullCount?: number;
	isVerified?: boolean;
}) {
	return (
		<header>
			<div className="container mx-auto max-w-7xl px-5 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<div className="space-y-5">
					<div className="space-y-3">
						<h1 className="font-serif text-6xl tracking-tight md:text-7xl">{referenceName}</h1>
						<div className="text-muted-foreground flex flex-wrap items-center gap-5 font-mono text-sm">
							<StatusBadge status="indexed" variant="compact" />
							{commitSha && <span>Commit: {commitSha.slice(0, 7)}</span>}
							{typeof pullCount === "number" && <span>{pullCount.toLocaleString()} pulls</span>}
							{isVerified && <BadgeCheck className="size-4 text-blue-500" />}
							{generatedAt && <span>Updated {formatShortDate(generatedAt)}</span>}
						</div>
						{referenceDescription && (
							<p className="text-muted-foreground font-mono text-base">{referenceDescription}</p>
						)}
					</div>
				</div>
			</div>
		</header>
	);
}

function NotFoundState() {
	return (
		<div className="border-primary/10 border p-8">
			<div className="flex items-start gap-5">
				<div className="bg-muted/50 border-primary/10 flex size-13 shrink-0 items-center justify-center border">
					<Terminal className="text-muted-foreground size-5" />
				</div>
				<div className="space-y-3">
					<h3 className="font-serif text-xl">Reference Not Found</h3>
					<p className="text-muted-foreground max-w-lg font-serif leading-relaxed">
						This reference doesn&apos;t exist or hasn&apos;t been generated yet.
					</p>
				</div>
			</div>
		</div>
	);
}

function ReferenceDetailPage() {
	const { owner, repo, reference } = Route.useParams();
	const fullName = `${owner}/${repo}`;

	const { data: referenceData } = useSuspenseQuery(
		convexQuery(api.references.getByName, { fullName, referenceName: reference }),
	);

	if (!referenceData) {
		return (
			<div className="flex flex-1 flex-col">
				<div className="container mx-auto max-w-7xl flex-1 px-5 py-8 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
					<NotFoundState />
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col">
			<ReferenceHeader
				referenceName={referenceData.referenceName}
				referenceDescription={referenceData.referenceDescription}
				generatedAt={referenceData.generatedAt}
				commitSha={referenceData.commitSha}
				pullCount={referenceData.pullCount}
				isVerified={referenceData.isVerified}
			/>
			<div className="container mx-auto max-w-7xl flex-1 px-5 py-8 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<div className="space-y-5">
					<InstallCommandBox fullName={fullName} />
					<CopyableBlock
						title="Reference"
						content={referenceData.referenceContent}
						stripFrontmatter
					/>
				</div>
			</div>
		</div>
	);
}
