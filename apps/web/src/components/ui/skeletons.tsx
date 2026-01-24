import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
	return <div className={cn("bg-muted animate-pulse", className)} />;
}

export function TableSkeleton({ rows = 3 }: { rows?: number }) {
	return (
		<div className="border-primary/10 border">
			<div className="border-primary/10 flex gap-5 border-b px-5 py-3">
				<Skeleton className="h-4 w-32" />
				<Skeleton className="h-4 w-48" />
				<Skeleton className="h-4 w-20" />
			</div>
			{Array.from({ length: rows }).map((_, i) => (
				<div key={i} className="border-primary/5 flex gap-5 border-b px-5 py-3 last:border-0">
					<Skeleton className="h-5 w-32" />
					<Skeleton className="h-5 w-48" />
					<Skeleton className="h-5 w-20" />
				</div>
			))}
		</div>
	);
}

export function CardSkeleton() {
	return (
		<div className="border-primary/10 space-y-3 border p-5">
			<Skeleton className="h-6 w-3/4" />
			<Skeleton className="h-4 w-full" />
			<Skeleton className="h-4 w-2/3" />
		</div>
	);
}

export function OwnerHeaderSkeleton() {
	return (
		<div className="flex items-start gap-8">
			<Skeleton className="size-21 shrink-0" />
			<div className="space-y-3">
				<Skeleton className="h-13 w-48" />
				<Skeleton className="h-5 w-64" />
			</div>
		</div>
	);
}

export function RepoGridSkeleton({ count = 6 }: { count?: number }) {
	return (
		<div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
			{Array.from({ length: count }).map((_, i) => (
				<CardSkeleton key={i} />
			))}
		</div>
	);
}
