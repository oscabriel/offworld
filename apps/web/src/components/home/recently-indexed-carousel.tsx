import { Link } from "@tanstack/react-router";
import { RepoCard } from "@/components/repo/repo-card";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@/components/ui/carousel";

interface Analysis {
	fullName: string;
	pullCount: number;
}

interface RecentlyIndexedCarouselProps {
	analyses: Analysis[];
}

export function RecentlyIndexedCarousel({ analyses }: RecentlyIndexedCarouselProps) {
	if (analyses.length === 0) return null;

	return (
		<div className="relative border-primary/10 border-y bg-background/30 py-16 backdrop-blur-sm">
			<div className="container mx-auto px-4 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<div className="mb-8 flex items-baseline justify-between">
					<h2 className="font-mono text-muted-foreground text-sm uppercase tracking-[0.3em]">
						Recently Indexed
					</h2>
					<Link
						to="/browse"
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
							{analyses.slice(0, 10).map((analysis) => (
								<CarouselItem
									key={analysis.fullName}
									className="pl-2 md:basis-1/2 lg:basis-1/2 xl:basis-1/3"
								>
									<RepoCard fullName={analysis.fullName} pullCount={analysis.pullCount} />
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
