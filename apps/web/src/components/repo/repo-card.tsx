import { StarIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/repo/status-badge";
import { formatCompactNumber } from "@/lib/format";

interface RepoCardProps {
	fullName: string;
	stars: number;
	description?: string;
	language?: string;
	/** Display name override (e.g., just repo name instead of fullName) */
	displayName?: string;
	/** Whether this repo has a reference indexed */
	indexed?: boolean;
}

export function RepoCard({
	fullName,
	stars,
	description,
	language,
	displayName,
	indexed = true,
}: RepoCardProps) {
	const [owner, repo] = fullName.split("/");

	return (
		<Link to="/$owner/$repo" params={{ owner, repo }} className="block h-full">
			<Card className="group border-primary/10 bg-card hover:border-primary/50 flex h-full min-h-48 w-full flex-col gap-3 border py-5 transition-all duration-200 hover:-translate-y-0.5">
				<CardHeader className="gap-0 px-5 py-0">
					<div className="flex items-start justify-between gap-2">
						<CardTitle className="group-hover:text-primary font-serif text-xl font-semibold">
							{displayName ?? fullName}
						</CardTitle>
						{indexed && <StatusBadge status="indexed" variant="compact" />}
					</div>
				</CardHeader>

				{description && (
					<p className="text-muted-foreground line-clamp-2 px-5 font-mono text-sm leading-relaxed">
						{description}
					</p>
				)}

				<CardContent className="mt-auto flex flex-wrap items-center gap-5 px-5 py-0">
					{language && <span className="text-muted-foreground font-mono text-xs">{language}</span>}
					<span className="text-muted-foreground flex items-center gap-1 font-mono text-xs">
						<StarIcon className="size-3" />
						{formatCompactNumber(stars)}
					</span>
				</CardContent>
			</Card>
		</Link>
	);
}
