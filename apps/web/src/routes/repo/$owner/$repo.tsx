import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, ExternalLink, GitBranch, Star, Clock, Download } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function useGitHubStars(owner: string, repo: string) {
	const [stars, setStars] = useState<number | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		async function fetchStars() {
			try {
				const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
				if (response.ok) {
					const data = await response.json();
					setStars(data.stargazers_count);
				}
			} catch {
				// Silently fail - stars are nice-to-have
			} finally {
				setIsLoading(false);
			}
		}
		fetchStars();
	}, [owner, repo]);

	return { stars, isLoading };
}

export const Route = createFileRoute("/repo/$owner/$repo")({
	component: RepoAnalysisPage,
});

function RepoAnalysisPage() {
	const { owner, repo } = Route.useParams();
	const fullName = `${owner}/${repo}`;

	const analysisQuery = useQuery(convexQuery(api.analyses.get, { fullName }));
	const analysis = analysisQuery.data;
	const isLoading = analysisQuery.isLoading;

	const { stars } = useGitHubStars(owner, repo);
	const [copied, setCopied] = useState(false);

	const copyCommand = () => {
		const command = `bunx offworld pull ${fullName}`;
		navigator.clipboard.writeText(command);
		setCopied(true);
		toast.success("Command copied to clipboard!");
		setTimeout(() => setCopied(false), 2000);
	};

	if (isLoading) {
		return <AnalysisSkeleton />;
	}

	if (!analysis) {
		return (
			<div className="container mx-auto max-w-4xl py-10">
				<Card>
					<CardHeader>
						<CardTitle>Analysis Not Found</CardTitle>
						<CardDescription>
							No analysis exists for <code className="bg-muted rounded px-1">{fullName}</code>
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground">
							You can generate an analysis locally using the offworld CLI:
						</p>
						<div className="bg-muted rounded-lg p-4 font-mono text-sm">
							bunx offworld pull {fullName}
						</div>
						<Button variant="outline" onClick={copyCommand}>
							{copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
							{copied ? "Copied!" : "Copy command"}
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	const formattedDate = new Date(analysis.analyzedAt).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});

	return (
		<div className="container mx-auto max-w-4xl py-10">
			<div className="mb-8 flex items-start justify-between">
				<div>
					<h1 className="mb-2 text-3xl font-bold">{fullName}</h1>
					<div className="text-muted-foreground flex items-center gap-4 text-sm">
						<span className="flex items-center gap-1">
							<GitBranch className="h-4 w-4" />
							{analysis.commitSha.slice(0, 7)}
						</span>
						<span className="flex items-center gap-1">
							<Clock className="h-4 w-4" />
							{formattedDate}
						</span>
						<span className="flex items-center gap-1">
							<Download className="h-4 w-4" />
							{analysis.pullCount} pulls
						</span>
						{stars !== null && (
							<span className="flex items-center gap-1">
								<Star className="h-4 w-4 text-yellow-500" />
								{stars.toLocaleString()} stars
							</span>
						)}
						{analysis.isVerified && (
							<span className="flex items-center gap-1 text-green-500">
								<Check className="h-4 w-4" />
								Verified
							</span>
						)}
					</div>
				</div>
				<div className="flex gap-2">
					<Button variant="outline" onClick={copyCommand}>
						{copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
						{copied ? "Copied!" : "Copy command"}
					</Button>
					<a
						href={`https://github.com/${fullName}`}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex h-8 items-center justify-center gap-1.5 rounded-none border border-border bg-background px-2.5 text-xs font-medium transition-all hover:bg-muted hover:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
					>
						<ExternalLink className="mr-2 h-4 w-4" />
						GitHub
					</a>
				</div>
			</div>

			<div className="space-y-6">
				<Card>
					<CardHeader>
						<CardTitle>Summary</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="prose prose-invert max-w-none">
							<SummaryContent summary={analysis.summary} />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Architecture</CardTitle>
						<CardDescription>Project type: {analysis.architecture.projectType}</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<h4 className="mb-2 font-semibold">Entities</h4>
							<div className="grid gap-2">
								{analysis.architecture.entities.slice(0, 10).map((entity) => (
									<div key={entity.name} className="bg-muted rounded-lg p-3">
										<div className="flex items-center justify-between">
											<span className="font-medium">{entity.name}</span>
											<span className="bg-background text-muted-foreground rounded px-2 py-0.5 text-xs">
												{entity.type}
											</span>
										</div>
										<p className="text-muted-foreground mt-1 text-sm">{entity.description}</p>
										<p className="mt-1 font-mono text-xs text-blue-400">{entity.path}</p>
									</div>
								))}
								{analysis.architecture.entities.length > 10 && (
									<p className="text-muted-foreground text-sm">
										+{analysis.architecture.entities.length - 10} more entities
									</p>
								)}
							</div>
						</div>

						{analysis.architecture.patterns && (
							<div>
								<h4 className="mb-2 font-semibold">Patterns</h4>
								<div className="flex flex-wrap gap-2">
									{analysis.architecture.patterns.framework && (
										<PatternBadge
											label="Framework"
											value={analysis.architecture.patterns.framework}
										/>
									)}
									{analysis.architecture.patterns.buildTool && (
										<PatternBadge label="Build" value={analysis.architecture.patterns.buildTool} />
									)}
									{analysis.architecture.patterns.testFramework && (
										<PatternBadge
											label="Test"
											value={analysis.architecture.patterns.testFramework}
										/>
									)}
									{analysis.architecture.patterns.stateManagement && (
										<PatternBadge
											label="State"
											value={analysis.architecture.patterns.stateManagement}
										/>
									)}
									{analysis.architecture.patterns.styling && (
										<PatternBadge label="Styling" value={analysis.architecture.patterns.styling} />
									)}
								</div>
							</div>
						)}

						{analysis.architecture.keyFiles.length > 0 && (
							<div>
								<h4 className="mb-2 font-semibold">Key Files</h4>
								<div className="bg-muted rounded-lg p-3">
									<table className="w-full text-sm">
										<thead>
											<tr className="text-muted-foreground border-b">
												<th className="pb-2 text-left font-medium">Path</th>
												<th className="pb-2 text-left font-medium">Role</th>
											</tr>
										</thead>
										<tbody>
											{analysis.architecture.keyFiles.slice(0, 10).map((file) => (
												<tr key={file.path} className="border-b border-dashed last:border-0">
													<td className="py-1.5 font-mono text-blue-400">{file.path}</td>
													<td className="py-1.5">{file.role}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Install Skill</CardTitle>
						<CardDescription>
							Use this command to install the skill to your AI coding assistant
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="bg-muted rounded-lg p-4 font-mono text-sm">
							bunx offworld pull {fullName}
						</div>
						<p className="text-muted-foreground mt-2 text-sm">
							This command will clone the repository and install the SKILL.md file to your Claude
							Code and OpenCode skill directories.
						</p>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

function SummaryContent({ summary }: { summary: string }) {
	const lines = summary.split("\n");
	return (
		<div className="space-y-2">
			{lines.map((line, i) => {
				if (line.startsWith("# ")) {
					return (
						<h1 key={i} className="text-2xl font-bold">
							{line.slice(2)}
						</h1>
					);
				}
				if (line.startsWith("## ")) {
					return (
						<h2 key={i} className="text-xl font-semibold">
							{line.slice(3)}
						</h2>
					);
				}
				if (line.startsWith("### ")) {
					return (
						<h3 key={i} className="text-lg font-medium">
							{line.slice(4)}
						</h3>
					);
				}
				if (line.startsWith("- ") || line.startsWith("* ")) {
					return (
						<li key={i} className="ml-4">
							{line.slice(2)}
						</li>
					);
				}
				if (line.trim() === "") {
					return <br key={i} />;
				}
				return <p key={i}>{line}</p>;
			})}
		</div>
	);
}

function PatternBadge({ label, value }: { label: string; value: string }) {
	return (
		<div className="bg-muted rounded-lg px-3 py-1">
			<span className="text-muted-foreground text-xs">{label}:</span>{" "}
			<span className="text-sm font-medium">{value}</span>
		</div>
	);
}

function AnalysisSkeleton() {
	return (
		<div className="container mx-auto max-w-4xl py-10">
			<div className="mb-8">
				<Skeleton className="mb-2 h-9 w-64" />
				<Skeleton className="h-5 w-48" />
			</div>
			<div className="space-y-6">
				<Card>
					<CardHeader>
						<Skeleton className="h-6 w-24" />
					</CardHeader>
					<CardContent className="space-y-2">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-3/4" />
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<Skeleton className="h-6 w-32" />
					</CardHeader>
					<CardContent className="space-y-2">
						<Skeleton className="h-20 w-full" />
						<Skeleton className="h-20 w-full" />
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
