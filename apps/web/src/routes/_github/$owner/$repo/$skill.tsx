import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, Terminal } from "lucide-react";
import { MarkdownContent } from "@/components/repo/markdown-content";
import { InstallCommandBox } from "@/components/repo/install-command-box";
import { formatShortDate } from "@/lib/format";
import { StatusBadge } from "@/components/repo/status-badge";

export const Route = createFileRoute("/_github/$owner/$repo/$skill")({
	staticData: {
		crumbs: (params) => [
			{
				label: params.skill,
				to: "/$owner/$repo/$skill",
				params: { owner: params.owner, repo: params.repo, skill: params.skill },
			},
		],
	},
	component: SkillDetailPage,
	loader: async ({ context, params }) => {
		const fullName = `${params.owner}/${params.repo}`.toLowerCase();
		await context.queryClient.ensureQueryData(
			convexQuery(api.analyses.getByName, { fullName, skillName: params.skill }),
		);
	},
});

function SkillHeader({
	skillName,
	skillDescription,
	analyzedAt,
	commitSha,
	pullCount,
	isVerified,
}: {
	skillName: string;
	skillDescription?: string;
	analyzedAt?: string;
	commitSha?: string;
	pullCount?: number;
	isVerified?: boolean;
}) {
	return (
		<header>
			<div className="container mx-auto max-w-7xl px-5 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<div className="space-y-5">
					<div className="space-y-3">
						<h1 className="font-serif text-6xl tracking-tight md:text-7xl">{skillName}</h1>
						<div className="text-muted-foreground flex flex-wrap items-center gap-5 font-mono text-sm">
							<StatusBadge status="indexed" variant="compact" />
							{commitSha && <span>Commit: {commitSha.slice(0, 7)}</span>}
							{typeof pullCount === "number" && <span>{pullCount.toLocaleString()} pulls</span>}
							{isVerified && <BadgeCheck className="size-4 text-blue-500" />}
							{analyzedAt && <span>Updated {formatShortDate(analyzedAt)}</span>}
						</div>
						{skillDescription && (
							<p className="text-muted-foreground font-mono text-base">{skillDescription}</p>
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
					<h3 className="font-serif text-xl">Skill Not Found</h3>
					<p className="text-muted-foreground max-w-lg font-serif leading-relaxed">
						This skill doesn&apos;t exist or hasn&apos;t been generated yet.
					</p>
				</div>
			</div>
		</div>
	);
}

function SkillDetailPage() {
	const { owner, repo, skill } = Route.useParams();
	const fullName = `${owner}/${repo}`.toLowerCase();

	const { data: skillData } = useSuspenseQuery(
		convexQuery(api.analyses.getByName, { fullName, skillName: skill }),
	);

	if (!skillData) {
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
			<SkillHeader
				skillName={skillData.skillName}
				skillDescription={skillData.skillDescription}
				analyzedAt={skillData.analyzedAt}
				commitSha={skillData.commitSha}
				pullCount={skillData.pullCount}
				isVerified={skillData.isVerified}
			/>
			<div className="container mx-auto max-w-7xl flex-1 px-5 py-8 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<div className="space-y-5">
					<InstallCommandBox fullName={fullName} />
					<article className="bg-card border-primary/10 border p-8">
						<MarkdownContent content={skillData.skillContent} />
					</article>
				</div>
			</div>
		</div>
	);
}
