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

		if (match?.[1] && match[2]) {
			owner = match[1];
			name = match[2];
		} else {
			// Try parsing as just "owner/repo" format
			const simpleMatch = repoUrl.match(/^([^/]+)\/([^/]+)$/);
			if (simpleMatch?.[1] && simpleMatch[2]) {
				owner = simpleMatch[1];
				name = simpleMatch[2];
			} else {
				const errorMsg = "Please enter a valid GitHub repository URL (e.g., owner/repo)";
				setError(errorMsg);
				if (onError) onError(errorMsg);
				return;
			}
		}

		// Navigate directly to repo page - route handles "not found" state
		navigate({ to: "/$owner/$repo", params: { owner, repo: name } });
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			handleAnalyze();
		}
	};

	const isHero = variant === "hero";

	return (
		<div className={isHero ? "w-full" : "space-y-5"}>
			<Label
				htmlFor="repo-url"
				className={
					isHero
						? "text-muted-foreground mb-5 block text-center font-mono text-base tracking-[0.3em] uppercase"
						: "text-muted-foreground block font-mono text-sm tracking-wide uppercase"
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
						setError("");
					}}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					className="border-primary/20 bg-background/50 text-foreground focus-visible:border-primary focus-visible:bg-background h-auto flex-1 border-2 px-5 py-4 font-mono text-lg! backdrop-blur-sm transition-all duration-300 focus-visible:ring-0 sm:px-5 sm:py-4 md:text-lg!"
				/>
				<Button
					onClick={handleAnalyze}
					disabled={!repoUrl}
					size="lg"
					className="border-primary bg-primary text-primary-foreground hover:bg-background hover:text-primary h-auto border-2 px-8 py-4 font-mono text-lg transition-all duration-300 disabled:cursor-not-allowed sm:px-8 sm:py-4 sm:text-lg"
				>
					{buttonText}
				</Button>
			</div>
			{error && (
				<div className="border-destructive/40 bg-destructive/10 mt-3 border-2 p-3">
					<p className="text-destructive font-mono text-sm">{error}</p>
				</div>
			)}
		</div>
	);
}
