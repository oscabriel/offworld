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
		<div className="border-primary/10 bg-background/30 relative border-y py-13 backdrop-blur-sm">
			<div className="container mx-auto px-5 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<div className="mb-8 flex items-baseline justify-between">
					<h2 className="text-primary font-serif text-2xl tracking-tight md:text-3xl">
						Recently Pushed
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
							{analyses.slice(0, 10).map((analysis) => (
								<CarouselItem
									key={analysis.fullName}
									className="pl-2 md:basis-1/2 lg:basis-1/2 xl:basis-1/3"
								>
									<RepoCard fullName={analysis.fullName} pullCount={analysis.pullCount} />
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
