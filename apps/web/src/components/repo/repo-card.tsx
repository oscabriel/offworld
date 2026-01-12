import { DownloadIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RepoCardProps {
	fullName: string;
	pullCount: number;
}

function formatPullCount(count: number): string {
	if (count < 10) return count.toString();
	if (count < 100) return `${Math.floor(count / 10) * 10}+`;
	if (count < 1000) return `${Math.floor(count / 100) * 100}+`;
	if (count < 10000) return `${Math.floor(count / 1000)}K+`;
	return `${Math.floor(count / 10000) * 10}K+`;
}

export function RepoCard({ fullName, pullCount }: RepoCardProps) {
	const [owner, repo] = fullName.split("/");

	return (
		<Link to="/$owner/$repo" params={{ owner, repo }} className="block h-full">
			<Card className="group flex h-full min-h-48 w-full flex-col gap-4 border border-primary/10 bg-card py-4 shadow-none transition-colors hover:border-primary/30">
				<CardHeader className="gap-0 px-4 py-0 pt-4">
					<div className="flex items-start justify-between gap-2">
						<CardTitle className="font-semibold font-serif text-xl group-hover:text-primary">
							{fullName}
						</CardTitle>
						<Badge
							variant="secondary"
							className="shrink-0 rounded-none border-0 bg-green-500/10 font-mono text-green-600 text-xs"
						>
							Indexed
						</Badge>
					</div>
				</CardHeader>

				<CardContent className="mt-auto flex flex-wrap items-center gap-4 px-4 py-0 pb-4">
					<span className="flex items-center gap-1 font-mono text-muted-foreground text-xs">
						<DownloadIcon className="size-3" />
						{formatPullCount(pullCount)}
					</span>
				</CardContent>
			</Card>
		</Link>
	);
}
