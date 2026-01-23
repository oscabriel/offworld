import { ExternalLink } from "lucide-react";

interface SkillSidebarProps {
	pullCount?: number;
	owner: string;
	repo: string;
	commitSha?: string;
}

function formatNumber(n: number): string {
	if (n < 1000) return n.toString();
	if (n < 10000) return `${(n / 1000).toFixed(1)}K`;
	return `${Math.floor(n / 1000)}K`;
}

const agentBreakdown = [
	{ name: "claude-code", percentage: 45 },
	{ name: "cursor", percentage: 30 },
	{ name: "opencode", percentage: 15 },
	{ name: "windsurf", percentage: 10 },
] as const;

export function SkillSidebar({ pullCount = 0, owner, repo, commitSha }: SkillSidebarProps) {
	return (
		<aside className="space-y-8">
			<div>
				<h3 className="text-muted-foreground mb-2 font-mono text-xs tracking-[0.2em] uppercase">
					Total Installs
				</h3>
				<p className="text-primary font-mono text-4xl font-bold">{formatNumber(pullCount)}</p>
			</div>

			<div>
				<h3 className="text-muted-foreground mb-3 font-mono text-xs tracking-[0.2em] uppercase">
					Repository
				</h3>
				<a
					href={`https://github.com/${owner}/${repo}`}
					target="_blank"
					rel="noopener noreferrer"
					className="text-primary hover:text-primary/80 group inline-flex items-center gap-2 font-mono text-sm transition-colors"
				>
					github.com/{owner}/{repo}
					<ExternalLink className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
				</a>
				{commitSha && (
					<p className="text-muted-foreground mt-1 font-mono text-xs">@ {commitSha.slice(0, 7)}</p>
				)}
			</div>

			<div>
				<h3 className="text-muted-foreground mb-3 font-mono text-xs tracking-[0.2em] uppercase">
					Installed On
				</h3>
				<div className="space-y-2">
					{agentBreakdown.map((agent) => {
						const count = Math.round(pullCount * (agent.percentage / 100));
						return (
							<div key={agent.name} className="flex items-center justify-between">
								<span className="text-muted-foreground font-mono text-sm">{agent.name}</span>
								<span className="text-primary font-mono text-sm">{formatNumber(count)}</span>
							</div>
						);
					})}
				</div>
			</div>
		</aside>
	);
}
