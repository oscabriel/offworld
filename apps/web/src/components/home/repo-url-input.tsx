import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RepoUrlInputProps {
	labelText: string;
	placeholder?: string;
	buttonText?: string;
	onError?: (error: string) => void;
	variant?: "hero" | "standard";
}

export function RepoUrlInput({
	labelText,
	placeholder = "github.com/username/repo",
	buttonText = "Get Started",
	onError,
	variant = "standard",
}: RepoUrlInputProps) {
	const [repoUrl, setRepoUrl] = useState("");
	const [error, setError] = useState<string>("");
	const navigate = useNavigate();

	const handleAnalyze = () => {
		setError("");

		// Parse GitHub URL to extract owner/name
		const match = repoUrl.match(
			/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/,
		);

		let owner: string;
		let name: string;

		if (match) {
			[, owner, name] = match;
		} else {
			// Try parsing as just "owner/repo" format
			const simpleMatch = repoUrl.match(/^([^/]+)\/([^/]+)$/);
			if (simpleMatch) {
				[, owner, name] = simpleMatch;
			} else {
				const errorMsg = "Please enter a valid GitHub repository URL (e.g., owner/repo)";
				setError(errorMsg);
				if (onError) onError(errorMsg);
				return;
			}
		}

		// Navigate directly to repo page - route handles "not found" state
		navigate({ to: "/repo/$owner/$repo", params: { owner, repo: name } });
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			handleAnalyze();
		}
	};

	const isHero = variant === "hero";

	return (
		<div className={isHero ? "w-full" : "space-y-4"}>
			<Label
				htmlFor="repo-url"
				className={
					isHero
						? "mb-4 block text-center font-mono text-base text-muted-foreground uppercase tracking-[0.3em]"
						: "block font-mono text-muted-foreground text-sm uppercase tracking-wide"
				}
			>
				{labelText}
			</Label>
			<div className="flex flex-col gap-3 sm:flex-row">
				<Input
					id="repo-url"
					type="text"
					value={repoUrl}
					onChange={(e) => {
						setRepoUrl(e.target.value);
						setError(""); // Clear error on input change
					}}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					className="h-auto flex-1 rounded-none border-2 border-primary/20 bg-background/50 px-4 py-3 font-mono text-base text-foreground backdrop-blur-sm transition-all duration-300 focus-visible:border-primary focus-visible:bg-background focus-visible:ring-0 sm:px-6 sm:py-4 sm:text-xl"
				/>
				<Button
					onClick={handleAnalyze}
					disabled={!repoUrl}
					size="lg"
					className="h-auto rounded-none border-2 border-primary bg-primary px-6 py-3 font-mono text-base text-primary-foreground transition-all duration-300 hover:bg-background hover:text-primary disabled:cursor-not-allowed sm:px-10 sm:py-4 sm:text-lg"
				>
					{buttonText}
				</Button>
			</div>
			{error && (
				<div className="mt-3 border-2 border-red-500/20 bg-red-500/10 p-3">
					<p className="font-mono text-red-600 text-sm dark:text-red-400">{error}</p>
				</div>
			)}
		</div>
	);
}
