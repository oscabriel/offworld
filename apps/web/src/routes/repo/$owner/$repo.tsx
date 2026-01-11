import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ContentCard } from "@/components/repo/content-card";
import { MarkdownContent } from "@/components/repo/markdown-content";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/repo/$owner/$repo")({
	component: RepoAnalysisPage,
});

function RepoAnalysisPage() {
	const { owner, repo } = Route.useParams();
	const fullName = `${owner}/${repo}`;

	const analysisQuery = useQuery(convexQuery(api.analyses.get, { fullName }));
	const analysis = analysisQuery.data;
	const isLoading = analysisQuery.isLoading;

	const [copied, setCopied] = useState(false);

	const copyCommand = () => {
		const command = `bunx offworld pull ${fullName}`;
		navigator.clipboard.writeText(command);
		setCopied(true);
		toast.success("Command copied to clipboard!");
		setTimeout(() => setCopied(false), 2000);
	};

	if (isLoading) {
		return (
			<div className="relative flex min-h-screen flex-col">
				<div className="container mx-auto max-w-7xl flex-1 px-4 py-24 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
					<ContentCard>
						<div className="h-12 w-48 animate-pulse rounded bg-muted" />
						<div className="mt-4 h-6 w-32 animate-pulse rounded bg-muted" />
					</ContentCard>
				</div>
				<Footer />
			</div>
		);
	}

	if (!analysis) {
		return (
			<div className="relative flex min-h-screen flex-col">
				<div className="container mx-auto max-w-7xl flex-1 px-4 py-24 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
					<ContentCard title="Analysis Not Found">
						<p className="mb-4 font-serif text-lg text-muted-foreground leading-relaxed">
							No analysis exists for{" "}
							<code className="rounded bg-muted px-2 py-1 font-mono text-foreground">
								{fullName}
							</code>
						</p>
						<p className="mb-6 font-serif text-lg text-muted-foreground leading-relaxed">
							You can generate an analysis locally using the offworld CLI:
						</p>
						<div className="mb-4 border border-primary/20 bg-background/50 p-4 font-mono text-sm">
							bunx offworld pull {fullName}
						</div>
						<Button onClick={copyCommand}>
							{copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
							{copied ? "Copied!" : "Copy command"}
						</Button>
					</ContentCard>
				</div>
				<Footer />
			</div>
		);
	}

	return (
		<div className="relative flex min-h-screen flex-col">
			<div className="container mx-auto max-w-7xl flex-1 px-4 py-24 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<div className="space-y-8">
					{/* Header */}
					<div className="flex items-start justify-between">
						<div className="space-y-2">
							<h1 className="font-serif text-5xl tracking-tight md:text-6xl">{fullName}</h1>
							<div className="flex items-center gap-4 font-mono text-muted-foreground text-sm">
								<span>Commit: {analysis.commitSha.slice(0, 7)}</span>
								<span>{analysis.pullCount} pulls</span>
								{analysis.isVerified && <span className="text-green-500">Verified</span>}
							</div>
						</div>
						<a
							href={`https://github.com/${fullName}`}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2 border border-primary/20 bg-background px-4 py-2 font-mono text-sm transition-colors hover:bg-muted"
						>
							<ExternalLink className="h-4 w-4" />
							GitHub
						</a>
					</div>

					{/* Summary */}
					<ContentCard title="Summary">
						<MarkdownContent content={analysis.summary} />
					</ContentCard>

					{/* Install Command */}
					<ContentCard title="Install Skill">
						<p className="mb-4 font-serif text-lg text-muted-foreground leading-relaxed">
							Use this command to install the skill to your AI coding assistant:
						</p>
						<div className="mb-4 border border-primary/20 bg-background/50 p-4 font-mono text-sm">
							bunx offworld pull {fullName}
						</div>
						<Button onClick={copyCommand}>
							{copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
							{copied ? "Copied!" : "Copy command"}
						</Button>
					</ContentCard>
				</div>
			</div>
			<Footer />
		</div>
	);
}
