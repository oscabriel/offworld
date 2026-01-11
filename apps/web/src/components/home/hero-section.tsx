import { useEffect, useRef, useState } from "react";
import { RepoUrlInput } from "@/components/home/repo-url-input";

export function HeroSection() {
	const heroRef = useRef<HTMLDivElement>(null);
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		setIsVisible(true);
	}, []);

	return (
		<div
			ref={heroRef}
			className="relative flex min-h-[85vh] flex-col items-center justify-center px-4 pt-20 pb-32"
		>
			<div
				className={`mx-auto w-full max-w-7xl transition-all duration-1000 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl ${
					isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
				}`}
				style={{ transitionDelay: "100ms" }}
			>
				<img src="/logotype-mobile.svg" alt="OFFWORLD" className="w-full md:hidden" />
				<img src="/logotype.svg" alt="OFFWORLD" className="hidden w-full px-4 md:block" />
			</div>

			<div
				className={`mx-auto mt-16 w-full max-w-3xl px-4 transition-all duration-1000 md:mt-32 ${
					isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
				}`}
				style={{ transitionDelay: "500ms" }}
			>
				<RepoUrlInput labelText="A New Codebase Awaits You" variant="hero" buttonText="Analyze" />
			</div>
		</div>
	);
}
