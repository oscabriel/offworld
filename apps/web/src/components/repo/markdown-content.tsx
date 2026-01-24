import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
	content: string;
}

function stripFrontmatter(content: string): string {
	if (!content.startsWith("---")) return content;
	const endIndex = content.indexOf("---", 3);
	if (endIndex === -1) return content;
	return content.slice(endIndex + 3).trim();
}

export function MarkdownContent({ content }: MarkdownContentProps) {
	const cleanContent = stripFrontmatter(content);

	return (
		<div className="prose prose-invert max-w-none font-mono text-sm leading-relaxed text-zinc-300">
			<ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanContent}</ReactMarkdown>
		</div>
	);
}
