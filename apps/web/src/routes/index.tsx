import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: HomeComponent,
});

function HomeComponent() {
	return (
		<div className="relative min-h-screen w-full bg-background">
			{/* Background image */}
			<div
				className="absolute inset-0 z-0 bg-center bg-cover opacity-10 dark:opacity-5"
				style={{
					backgroundImage: "url(/background-image.png)",
				}}
			/>

			{/* Centered content */}
			<div className="relative z-10 flex min-h-screen flex-col items-center justify-between p-4">
				{/* Spacer for vertical centering of logo */}
				<div className="flex-1" />

				{/* OFFWORLD logotype - responsive */}
				<img
					src="/logotype-mobile.svg"
					alt="OFFWORLD"
					className="w-[80vw] max-w-none md:hidden"
				/>
				<img
					src="/logotype.svg"
					alt="OFFWORLD"
					className="hidden w-[80vw] max-w-none md:block"
				/>

				{/* Spacer pushing footer down */}
				<div className="flex-1" />

				{/* Footer text at bottom */}
				<div className="flex flex-col items-center gap-3 pb-8 text-center">
					<Link
						to="/"
						className="font-sorts-mill text-2xl text-primary hover:underline"
					>
						offworld.sh
					</Link>
					<p className="font-sorts-mill text-primary text-xl italic">
						"Explore distant code."
					</p>
				</div>
			</div>
		</div>
	);
}
