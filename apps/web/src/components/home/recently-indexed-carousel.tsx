import type { Doc } from "@offworld/backend/convex/_generated/dataModel";
import { Link } from "@tanstack/react-router";
import { RepoCard } from "@/components/repo/repo-card";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@/components/ui/carousel";

interface RecentlyIndexedCarouselProps {
	repos: Doc<"repositories">[];
}

export function RecentlyIndexedCarousel({
	repos,
}: RecentlyIndexedCarouselProps) {
	if (repos.length === 0) return null;

	return (
		<div className="relative border-primary/10 border-y bg-background/30 py-16 backdrop-blur-sm">
			<div className="container mx-auto px-4 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<div className="mb-8 flex items-baseline justify-between">
					<h2 className="font-mono text-muted-foreground text-sm uppercase tracking-[0.3em]">
						Recently Indexed
					</h2>
					<Link
						to="/explore"
						className="font-mono text-primary text-xs uppercase tracking-wider hover:underline"
					>
						View All →
					</Link>
				</div>

				<div className="mx-auto max-w-[calc(100%-5rem)] md:max-w-full">
					<Carousel
						opts={{
							align: "start",
							loop: false,
						}}
						className="w-full"
					>
						<CarouselContent className="-ml-2">
							{repos.slice(0, 10).map((repo) => (
								<CarouselItem
									key={repo._id}
									className="pl-2 md:basis-1/2 lg:basis-1/2 xl:basis-1/3"
								>
									<RepoCard
										owner={repo.owner}
										name={repo.name}
										description={repo.description}
										language={repo.language}
										stars={repo.stars}
									/>
								</CarouselItem>
							))}
						</CarouselContent>
						<CarouselPrevious className="-left-12 bg-background/80 backdrop-blur-sm md:bg-background/90 lg:bg-background" />
						<CarouselNext className="-right-12 bg-background/80 backdrop-blur-sm md:bg-background/90 lg:bg-background" />
					</Carousel>
				</div>
			</div>
		</div>
	);
}
