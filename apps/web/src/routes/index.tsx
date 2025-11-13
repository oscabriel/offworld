import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/")({
	component: HomeComponent,
});

function HomeComponent() {
	const [repoUrl, setRepoUrl] = useState("");
	const navigate = useNavigate();

	const handleAnalyze = () => {
		// Parse GitHub URL to extract owner/name
		const match = repoUrl.match(
			/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/,
		);

		if (match) {
			const [, owner, name] = match;
			navigate({ to: "/repo/$owner/$name", params: { owner, name } });
		} else {
			// Try parsing as just "owner/repo" format
			const simpleMatch = repoUrl.match(/^([^/]+)\/([^/]+)$/);
			if (simpleMatch) {
				const [, owner, name] = simpleMatch;
				navigate({ to: "/repo/$owner/$name", params: { owner, name } });
			}
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			handleAnalyze();
		}
	};

	return (
		<div className="relative min-h-screen w-full bg-background">
			{/* Background image */}
			<div
				className="absolute inset-0 z-0 bg-center bg-cover opacity-10 dark:opacity-10"
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

				{/* Get Started input section */}
				<div className="mt-16 w-full max-w-2xl px-4">
					<label
						htmlFor="repo-url"
						className="mb-3 block font-mono text-muted-foreground text-sm uppercase tracking-wide"
					>
						Get Started
					</label>
					<div className="flex gap-2">
						<input
							id="repo-url"
							type="text"
							value={repoUrl}
							onChange={(e) => setRepoUrl(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="github.com/owner/repo"
							className="flex-1 border border-primary/20 bg-background px-4 py-3 font-mono text-foreground text-lg focus:border-primary focus:outline-none"
						/>
						<button
							type="button"
							onClick={handleAnalyze}
							disabled={!repoUrl}
							className="border border-primary bg-primary px-8 py-3 font-mono text-lg text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Analyze
						</button>
					</div>
				</div>

				{/* Spacer pushing footer down */}
				<div className="flex-1" />

				{/* Footer text at bottom */}
				<div className="flex flex-col items-center gap-3 pb-8 text-center">
					<Link
						to="/"
						className="font-serif text-2xl text-primary hover:underline"
					>
						offworld.sh
					</Link>
					<p className="font-serif text-primary text-xl italic">
						"Explore distant code."
					</p>
				</div>
			</div>
		</div>
	);
}
