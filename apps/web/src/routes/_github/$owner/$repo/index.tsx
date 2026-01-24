import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, ChevronRight, Terminal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatShortDate } from "@/lib/format";
import { repoSkillsQuery } from "./route";

export const Route = createFileRoute("/_github/$owner/$repo/")({
	component: RepoSkillsPage,
});

function EmptyState() {
	return (
		<div className="border-primary/10 border p-8">
			<div className="flex items-start gap-5">
				<div className="bg-muted/50 border-primary/10 flex size-13 shrink-0 items-center justify-center border">
					<Terminal className="text-muted-foreground size-5" />
				</div>
				<div className="space-y-3">
					<h3 className="font-serif text-xl">No Skills Generated</h3>
					<p className="text-muted-foreground max-w-lg font-serif leading-relaxed">
						This repository doesn&apos;t have any skills yet. Use the install command above to
						analyze the codebase and generate skills for AI coding agents.
					</p>
				</div>
			</div>
		</div>
	);
}

function RepoSkillsPage() {
	const { owner, repo } = Route.useParams();
	const { data: skills } = useSuspenseQuery(repoSkillsQuery(owner, repo));

	if (skills.length === 0) {
		return (
			<div className="flex flex-1 flex-col">
				<div className="container mx-auto max-w-7xl flex-1 px-5 py-8 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
					<EmptyState />
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col">
			<div className="container mx-auto max-w-7xl flex-1 px-5 py-8 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<Card className="border-primary/10 border p-0">
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-primary/10 border-b">
									<th className="text-muted-foreground px-5 py-3 text-left font-mono text-xs">
										Skill
									</th>
									<th className="text-muted-foreground px-5 py-3 text-left font-mono text-xs">
										Description
									</th>
									<th className="text-muted-foreground px-5 py-3 text-left font-mono text-xs">
										Updated
									</th>
									<th className="text-muted-foreground px-5 py-3 text-left font-mono text-xs">
										Pulls
									</th>
									<th className="text-muted-foreground px-5 py-3 text-left font-mono text-xs">
										Verified
									</th>
									<th className="text-muted-foreground px-5 py-3 text-right font-mono text-xs">
										Action
									</th>
								</tr>
							</thead>
							<tbody>
								{skills.map((skill) => (
									<tr key={skill.skillName} className="border-primary/5 border-b last:border-0">
										<td className="px-5 py-3">
											<span className="font-serif">{skill.skillName}</span>
										</td>
										<td className="text-muted-foreground px-5 py-3 font-mono text-sm">
											{skill.skillDescription || "—"}
										</td>
										<td className="text-muted-foreground px-5 py-3 font-mono text-sm">
											{skill.analyzedAt ? formatShortDate(skill.analyzedAt) : "—"}
										</td>
										<td className="px-5 py-3 font-mono text-sm">
											{typeof skill.pullCount === "number" ? skill.pullCount.toLocaleString() : "—"}
										</td>
										<td className="px-5 py-3">
											{skill.isVerified ? (
												<BadgeCheck className="size-4 text-blue-500" />
											) : (
												<span className="text-muted-foreground font-mono text-sm">—</span>
											)}
										</td>
										<td className="px-5 py-3 text-right">
											<Link
												to="/$owner/$repo/$skill"
												params={{ owner, repo, skill: skill.skillName }}
												className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-mono text-xs transition-colors"
											>
												View
												<ChevronRight className="size-3" />
											</Link>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</Card>
			</div>
		</div>
	);
}
