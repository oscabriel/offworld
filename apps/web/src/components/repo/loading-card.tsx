interface LoadingCardProps {
	title?: string;
	message?: string;
}

export function LoadingCard({ title, message }: LoadingCardProps) {
	return (
		<div className="space-y-6 border border-primary/10 bg-card p-8">
			{title && (
				<h2 className="font-mono font-semibold text-2xl text-muted-foreground">
					{title}
				</h2>
			)}
			<div className="space-y-3">
				<div className="h-4 w-full animate-pulse bg-muted" />
				<div className="h-4 w-5/6 animate-pulse bg-muted" />
				<div className="h-4 w-4/6 animate-pulse bg-muted" />
			</div>
			{message && (
				<p className="pt-2 font-mono text-muted-foreground text-sm">
					{message}
				</p>
			)}
		</div>
	);
}
