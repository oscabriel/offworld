import ReactMarkdown from "react-markdown";

interface MarkdownContentProps {
	content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
	return (
		<div className="prose prose-lg dark:prose-invert max-w-none font-serif leading-relaxed">
			<ReactMarkdown>{content}</ReactMarkdown>
		</div>
	);
}
