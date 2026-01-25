import { Link } from "@tanstack/react-router";
import { RepoCard } from "@/components/repo/repo-card";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@/components/ui/carousel";

interface Repository {
	fullName: string;
	stars: number;
	description?: string;
	language?: string;
}

interface RecentlyIndexedCarouselProps {
	repositories: Repository[];
}

export function RecentlyIndexedCarousel({ repositories }: RecentlyIndexedCarouselProps) {
	if (repositories.length === 0) return null;

	return (
		<div className="border-primary/10 bg-background/30 relative border-y py-8 backdrop-blur-sm">
			<div className="container mx-auto px-5 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<div className="mb-8 flex items-baseline justify-between">
					<h2 className="text-primary font-serif text-xl tracking-tight md:text-2xl">
						Recently Indexed
					</h2>
					<Link
						to="/explore"
						className="text-primary font-mono text-sm tracking-wider uppercase hover:underline"
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
						<CarouselContent className="-ml-2 pt-1 pb-1">
							{repositories.slice(0, 10).map((repo) => (
								<CarouselItem
									key={repo.fullName}
									className="pl-2 md:basis-1/2 lg:basis-1/2 xl:basis-1/3"
								>
									<RepoCard
										fullName={repo.fullName}
										stars={repo.stars}
										description={repo.description}
										language={repo.language}
									/>
								</CarouselItem>
							))}
						</CarouselContent>
						<CarouselPrevious className="bg-background/80 md:bg-background/90 lg:bg-background -left-13 backdrop-blur-sm" />
						<CarouselNext className="bg-background/80 md:bg-background/90 lg:bg-background -right-13 backdrop-blur-sm" />
					</Carousel>
				</div>
			</div>
		</div>
	);
}
