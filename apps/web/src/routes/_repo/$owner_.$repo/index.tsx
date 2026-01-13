import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ContentCard } from "@/components/repo/content-card";
import { MarkdownContent } from "@/components/repo/markdown-content";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_repo/$owner_/$repo/")({
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
			<div className="flex flex-1 flex-col">
				<div className="container mx-auto max-w-7xl flex-1 px-4 py-8 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
					<ContentCard>
						<div className="bg-muted h-12 w-48 animate-pulse rounded" />
						<div className="bg-muted mt-4 h-6 w-32 animate-pulse rounded" />
					</ContentCard>
				</div>
			</div>
		);
	}

	if (!analysis) {
		return (
			<div className="flex flex-1 flex-col">
				<div className="container mx-auto max-w-7xl flex-1 px-4 py-8 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
					<ContentCard title="Repository Not Analyzed">
						<p className="text-muted-foreground mb-6 font-serif text-lg leading-relaxed">
							This repository hasn't been analyzed yet. Generate an analysis locally using the
							offworld CLI:
						</p>
						<div className="border-primary/20 bg-background/50 mb-4 border p-4 font-mono text-sm">
							bunx offworld pull {fullName}
						</div>
						<Button onClick={copyCommand}>
							{copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
							{copied ? "Copied!" : "Copy command"}
						</Button>
					</ContentCard>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col">
			<div className="container mx-auto max-w-7xl flex-1 px-4 py-8 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<div className="space-y-8">
					<ContentCard title="Summary">
						<MarkdownContent content={analysis.summary} />
					</ContentCard>

					<ContentCard title="Install Skill">
						<p className="text-muted-foreground mb-4 font-serif text-lg leading-relaxed">
							Use this command to install the skill to your AI coding assistant:
						</p>
						<div className="border-primary/20 bg-background/50 mb-4 border p-4 font-mono text-sm">
							bunx offworld pull {fullName}
						</div>
						<Button onClick={copyCommand}>
							{copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
							{copied ? "Copied!" : "Copy command"}
						</Button>
					</ContentCard>
				</div>
			</div>
		</div>
	);
}
