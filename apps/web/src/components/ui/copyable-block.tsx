"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CopyableBlockProps {
	/** Title displayed in the top-left of the header */
	title: string;
	/** Content to display and copy (markdown supported) */
	content: string;
	/** Optional className for the container */
	className?: string;
	/** Optional max height with scroll (e.g. "max-h-96") */
	maxHeight?: string;
	/** Whether to render content as markdown (default: true) */
	markdown?: boolean;
	/** Whether to strip YAML frontmatter from display (default: false) */
	stripFrontmatter?: boolean;
}

/** Strip YAML frontmatter from markdown content for display */
function stripYamlFrontmatter(content: string): string {
	if (!content.startsWith("---")) return content;
	const endIndex = content.indexOf("---", 3);
	if (endIndex === -1) return content;
	return content.slice(endIndex + 3).trim();
}

export function CopyableBlock({
	title,
	content,
	className,
	maxHeight,
	markdown = true,
	stripFrontmatter = false,
}: CopyableBlockProps) {
	const [copied, setCopied] = useState(false);

	// Strip frontmatter for display only, but copy the original content
	const displayContent = stripFrontmatter ? stripYamlFrontmatter(content) : content;

	const copyContent = () => {
		navigator.clipboard.writeText(content);
		setCopied(true);
		toast.success("Copied to clipboard");
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className={cn("bg-card border-primary/10 border", className)}>
			<div className="border-primary/10 flex items-center justify-between border-b px-5 py-3">
				<span className="text-muted-foreground font-mono text-xs">{title}</span>
				<button
					type="button"
					onClick={copyContent}
					className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-2 font-mono text-xs transition-colors"
				>
					{copied ? (
						<>
							<Check className="size-3 text-green-500" />
							Copied
						</>
					) : (
						<>
							<Copy className="size-3" />
							Copy
						</>
					)}
				</button>
			</div>
			<div className={cn("overflow-y-auto px-5 py-5", maxHeight)}>
				{markdown ? (
					<div className="prose prose-invert prose-sm max-w-none font-mono text-sm leading-relaxed *:first:mt-0!">
						<ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
					</div>
				) : (
					<pre className="text-primary font-mono text-sm leading-relaxed whitespace-pre-wrap">
						{displayContent}
					</pre>
				)}
			</div>
		</div>
	);
}
