import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { HeroSection } from "@/components/home/hero-section";
import { HowItWorks } from "@/components/home/how-it-works";
import { InfoSection } from "@/components/home/info-section";
import { RecentlyIndexedCarousel } from "@/components/home/recently-indexed-carousel";

export const Route = createFileRoute("/")({
	component: HomeComponent,
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(convexQuery(api.analyses.list, { limit: 10 }));
	},
});

function HomeComponent() {
	const { data: analyses } = useSuspenseQuery(convexQuery(api.analyses.list, { limit: 10 }));

	return (
		<div className="relative flex-1 overflow-x-hidden">
			<HeroSection />

			<RecentlyIndexedCarousel analyses={analyses ?? []} />

			<div className="border-primary/10 relative border-b py-34">
				<div className="container mx-auto max-w-7xl px-5 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
					<div className="grid gap-13 md:grid-cols-2 md:gap-21">
						<InfoSection />
						<HowItWorks />
					</div>
				</div>
			</div>
		</div>
	);
}
