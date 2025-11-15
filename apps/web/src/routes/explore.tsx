import { api } from "@offworld/backend/convex/_generated/api";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useState } from "react";

export const Route = createFileRoute("/explore")({
	component: ExploreComponent,
});

function ExploreComponent() {
	const [repoUrl, setRepoUrl] = useState("");
	const [error, setError] = useState<string | null>(null);
	const navigate = useNavigate();

	// Fetch pre-indexed repositories
	const repos = useQuery(api.repos.list);

	const handleAnalyze = () => {
		setError(null);

		// Parse GitHub URL to extract owner/name
		const match = repoUrl.match(
			/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/,
		);

		if (match) {
			const [, owner, name] = match;
			navigate({ to: "/$owner/$repo", params: { owner, repo: name } });
		} else {
			// Try parsing as just "owner/repo" format
			const simpleMatch = repoUrl.match(/^([^/]+)\/([^/]+)$/);
			if (simpleMatch) {
				const [, owner, name] = simpleMatch;
				navigate({ to: "/$owner/$repo", params: { owner, repo: name } });
			} else {
				setError("Please enter a valid GitHub repository URL");
			}
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			handleAnalyze();
		}
	};

	return (
		<div className="container mx-auto max-w-7xl px-4 py-24">
			<div className="space-y-14">
				{/* Header */}
				<div className="space-y-6">
					<h1 className="font-serif text-6xl tracking-tight md:text-7xl">
						A new codebase awaits you...
					</h1>
					<p className="max-w-2xl font-serif text-muted-foreground text-xl">
						Search for a repo to begin again in a golden land of opportunity and
						adventure!
					</p>
				</div>

				{/* URL Input Section */}
				<div className="space-y-4">
					<label
						htmlFor="repo-url"
						className="block font-mono text-muted-foreground text-sm uppercase tracking-wide"
					>
						Github Repo URL
					</label>
					<div className="flex gap-3">
						<input
							id="repo-url"
							type="text"
							value={repoUrl}
							onChange={(e) => setRepoUrl(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder={`"https://github.com/owner/repo" or "owner/repo"`}
							className="flex-1 border border-primary/20 bg-background px-6 py-4 font-mono text-foreground text-lg focus:border-primary focus:outline-none"
							aria-describedby={error ? "url-error" : undefined}
						/>
						<button
							type="button"
							onClick={handleAnalyze}
							disabled={!repoUrl}
							className="border border-primary bg-primary px-8 py-4 font-mono text-lg text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Analyze
						</button>
					</div>
					{error && (
						<p id="url-error" className="font-mono text-red-500 text-sm">
							{error}
						</p>
					)}
				</div>

				{/* Pre-Indexed Repositories Grid */}
				<div className="space-y-8">
					<div className="border-primary/10 border-t pt-8">
						<h2 className="font-serif text-4xl">Recently Indexed Repos</h2>
					</div>

					{repos === undefined ? (
						// Loading state
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
							{[...Array(6)].map((_, i) => (
								<div
									key={i}
									className="space-y-4 rounded-lg border border-primary/10 bg-card p-6"
								>
									<div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
									<div className="h-4 w-full animate-pulse rounded bg-muted" />
									<div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
									<div className="flex gap-4">
										<div className="h-4 w-16 animate-pulse rounded bg-muted" />
										<div className="h-4 w-12 animate-pulse rounded bg-muted" />
									</div>
								</div>
							))}
						</div>
					) : repos.length === 0 ? (
						// Empty state
						<div className="rounded-lg border border-primary/10 bg-card p-12 text-center">
							<p className="font-serif text-lg text-muted-foreground">
								No repositories have been analyzed yet. Be the first!
							</p>
						</div>
					) : (
						// Repos grid
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
							{repos.map((repo) => (
								<Link
									key={repo._id}
									to="/$owner/$repo"
									params={{ owner: repo.owner, repo: repo.name }}
									className="group space-y-4 rounded-lg border border-primary/10 bg-card p-6 transition-colors hover:border-primary/30"
								>
									{/* Repo name and status */}
									<div className="flex items-start justify-between gap-2">
										<h3 className="font-semibold font-serif text-xl group-hover:text-primary">
											{repo.owner}/{repo.name}
										</h3>
										{repo.indexingStatus === "completed" && (
											<span className="inline-flex shrink-0 items-center rounded-full bg-green-500/10 px-2 py-1 font-mono text-green-600 text-xs">
												Indexed
											</span>
										)}
									</div>

									{/* Description */}
									{repo.description && (
										<p className="line-clamp-2 font-mono text-muted-foreground text-sm">
											{repo.description}
										</p>
									)}

									{/* Stats */}
									<div className="flex flex-wrap items-center gap-4 pt-2">
										{repo.language && (
											<span className="font-mono text-muted-foreground text-xs">
												{repo.language}
											</span>
										)}
										<span className="font-mono text-muted-foreground text-xs">
											⭐ {repo.stars.toLocaleString()}
										</span>
									</div>
								</Link>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
