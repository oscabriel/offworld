import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RepoCardProps {
	owner: string;
	name: string;
	description?: string;
	language?: string;
	stars: number;
}

export function RepoCard({
	owner,
	name,
	description,
	language,
	stars,
}: RepoCardProps) {
	return (
		<Link
			to="/$owner/$repo"
			params={{ owner, repo: name }}
			className="block h-full"
		>
			<Card className="group flex h-full min-h-[192px] w-full flex-col gap-4 border border-primary/10 bg-card py-4 shadow-none transition-colors hover:border-primary/30">
				<CardHeader className="gap-0 px-4 py-0 pt-4">
					<div className="flex items-start justify-between gap-2">
						<CardTitle className="font-semibold font-serif text-xl group-hover:text-primary">
							{owner}/{name}
						</CardTitle>
						<Badge
							variant="secondary"
							className="shrink-0 rounded-none border-0 bg-green-500/10 font-mono text-green-600 text-xs"
						>
							Indexed
						</Badge>
					</div>
				</CardHeader>

				{description && (
					<CardContent className="px-4 py-0">
						<p className="line-clamp-3 font-mono text-muted-foreground text-sm">
							{description}
						</p>
					</CardContent>
				)}

				<CardContent className="mt-auto flex flex-wrap items-center gap-4 px-4 py-0 pb-4">
					{language && (
						<span className="font-mono text-muted-foreground text-xs">
							{language}
						</span>
					)}
					<span className="font-mono text-muted-foreground text-xs">
						⭐ {stars.toLocaleString()}
					</span>
				</CardContent>
			</Card>
		</Link>
	);
}
