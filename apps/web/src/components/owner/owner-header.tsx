interface OwnerInfo {
	login: string;
	name: string;
	avatarUrl: string;
	bio?: string;
	type: "user" | "organization";
	publicRepos: number;
	followers?: number;
	following?: number;
	htmlUrl: string;
}

interface OwnerHeaderProps {
	ownerInfo: OwnerInfo;
}

export function OwnerHeader({ ownerInfo }: OwnerHeaderProps) {
	return (
		<div className="flex items-start gap-6">
			<img
				src={ownerInfo.avatarUrl}
				alt={ownerInfo.name}
				className="h-32 w-32 border-2 border-primary/20"
			/>
			<div className="flex-1 space-y-3">
				<h1 className="font-serif text-5xl tracking-tight">{ownerInfo.name}</h1>
				<div className="flex flex-wrap items-center gap-4">
					<span className="font-mono text-muted-foreground text-sm">
						@{ownerInfo.login}
					</span>
					<span className="font-mono text-muted-foreground text-sm capitalize">
						{ownerInfo.type}
					</span>
					<span className="font-mono text-muted-foreground text-sm">
						{ownerInfo.publicRepos} public repos
					</span>
					{ownerInfo.followers !== undefined && (
						<span className="font-mono text-muted-foreground text-sm">
							{ownerInfo.followers.toLocaleString()} followers
						</span>
					)}
				</div>
				{ownerInfo.bio && (
					<p className="max-w-2xl font-serif text-lg text-muted-foreground">
						{ownerInfo.bio}
					</p>
				)}
				<a
					href={ownerInfo.htmlUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-block font-mono text-primary underline hover:no-underline"
				>
					View on GitHub →
				</a>
			</div>
		</div>
	);
}
