import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { HeroSection } from "@/components/home/hero-section";
import { HowItWorks } from "@/components/home/how-it-works";
import { InfoSection } from "@/components/home/info-section";
import { RecentlyIndexedCarousel } from "@/components/home/recently-indexed-carousel";
import { BackgroundImage } from "@/components/layout/background-image";
import { Footer } from "@/components/layout/footer";

export const Route = createFileRoute("/")({
	component: HomeComponent,
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(convexQuery(api.repos.list, {}));
	},
});

function HomeComponent() {
	const { data: repos } = useSuspenseQuery(convexQuery(api.repos.list, {}));

	const completedRepos =
		repos?.filter((r) => r.indexingStatus === "completed") || [];

	return (
		<div className="relative min-h-screen overflow-x-hidden bg-background">
			<BackgroundImage />

			<div className="pointer-events-none fixed inset-0 bg-linear-to-b from-transparent via-transparent to-background/60" />

			<HeroSection />

			<RecentlyIndexedCarousel repos={completedRepos} />

			<div className="relative border-primary/10 border-b py-32">
				<div className="container mx-auto max-w-7xl px-4 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
					<div className="grid gap-16 md:grid-cols-2 md:gap-20">
						<InfoSection />
						<HowItWorks />
					</div>
				</div>
			</div>
			<Footer />
		</div>
	);
}
