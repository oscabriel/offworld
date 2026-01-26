import { convexAction } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ChevronRight, Copy, Terminal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { RepoHeader } from "@/components/repo/repo-header";
import { Card } from "@/components/ui/card";

import { repoSkillsQuery } from "./route";

export const Route = createFileRoute("/_github/$owner/$repo/")({
	component: RepoReferencesPage,
});

function CopyableCommand({ command }: { command: string }) {
	const [copied, setCopied] = useState(false);

	const copyCommand = () => {
		navigator.clipboard.writeText(command);
		setCopied(true);
		toast.success("Copied to clipboard");
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<button
			type="button"
			onClick={copyCommand}
			className="group flex cursor-pointer items-center gap-2 font-mono text-sm transition-colors"
		>
			<span className="text-foreground group-hover:text-muted-foreground transition-colors">
				{command}
			</span>
			{copied ? (
				<Check className="size-4 text-green-500" />
			) : (
				<Copy className="text-muted-foreground size-4 opacity-0 transition-opacity group-hover:opacity-100" />
			)}
		</button>
	);
}

function EmptyState({ owner, repo }: { owner: string; repo: string }) {
	const repoPath = `${owner}/${repo}`;
	return (
		<div className="bg-background border-primary/10 border p-8">
			<div className="flex items-start gap-5">
				<div className="bg-muted/50 border-primary/10 flex size-13 shrink-0 items-center justify-center border">
					<Terminal className="text-muted-foreground size-5" />
				</div>
				<div className="space-y-3">
					<h3 className="font-serif text-xl">No References Generated</h3>
					<p className="text-muted-foreground font-mono leading-relaxed">
						This repository doesn&apos;t have any references yet. Generate and share a reference with the
						commands below:
					</p>
					<div className="space-y-2">
						<CopyableCommand command={`ow generate ${repoPath}`} />
						<CopyableCommand command={`ow push ${repoPath}`} />
					</div>
				</div>
			</div>
		</div>
	);
}

function RepoReferencesPage() {
	const { owner, repo } = Route.useParams();
	const { data: references, isLoading: referencesLoading } = useSuspenseQuery(repoSkillsQuery(owner, repo));

	const primaryReference = references[0] ?? null;
	const analysisData = primaryReference
		? {
				commitSha: primaryReference.commitSha,
				pullCount: primaryReference.pullCount,
				isVerified: primaryReference.isVerified,
			}
		: null;

	const { data: githubMetadata = null, isLoading: metadataLoading } = useQuery(
		convexAction(api.github.fetchRepoMetadata, { owner, name: repo }),
	);

	if (references.length === 0) {
		return (
			<div className="flex flex-1 flex-col">
				<RepoHeader
					owner={owner}
					repo={repo}
					analysisData={null}
					githubMetadata={githubMetadata}
					loading={metadataLoading}
				/>
				<div className="container mx-auto max-w-7xl flex-1 px-5 py-8 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
					<EmptyState owner={owner} repo={repo} />
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col">
			<RepoHeader
				owner={owner}
				repo={repo}
				analysisData={analysisData}
				githubMetadata={githubMetadata}
				loading={referencesLoading || metadataLoading}
			/>
			<div className="container mx-auto max-w-7xl flex-1 px-5 py-8 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<Card className="border-primary/10 border p-0">
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-primary/10 border-b">
									<th className="text-muted-foreground px-5 py-3 text-left font-mono text-xs">
										Reference
									</th>
									<th className="text-muted-foreground px-5 py-3 text-left font-mono text-xs">
										Description
									</th>
									<th className="text-muted-foreground px-5 py-3 text-left font-mono text-xs">
										Pulls
									</th>
								</tr>
							</thead>
							<tbody>
								{references.map((reference) => (
									<tr key={reference.referenceName} className="border-primary/5 border-b last:border-0">
										<td className="px-5 py-3">
											<Link
												to="/$owner/$repo/$reference"
												params={{ owner, repo, reference: reference.referenceName }}
												className="group/link hover:text-muted-foreground inline-flex items-center gap-1 font-serif text-lg transition-colors"
											>
												{reference.referenceName}
												<ChevronRight className="size-4 opacity-0 transition-opacity group-hover/link:opacity-100" />
											</Link>
										</td>
										<td className="text-muted-foreground max-w-md truncate px-5 py-3 font-mono text-sm">
											{reference.referenceDescription || "—"}
										</td>
										<td className="px-5 py-3 font-mono text-sm">
											{typeof reference.pullCount === "number" ? reference.pullCount.toLocaleString() : "—"}
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
