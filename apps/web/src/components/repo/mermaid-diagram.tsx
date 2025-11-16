import { useEffect, useRef, useState } from "react";

interface MermaidDiagramProps {
	chart: string;
	title?: string;
}

export function MermaidDiagram({ chart, title }: MermaidDiagramProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const renderDiagram = async () => {
			if (!containerRef.current || !chart) return;

			try {
				setIsLoading(true);
				setError(null);

				// Dynamically import mermaid (lazy load)
				const mermaid = (await import("mermaid")).default;

				// Initialize mermaid with configuration
				mermaid.initialize({
					startOnLoad: false,
					theme: "neutral",
					securityLevel: "loose",
					fontFamily: "monospace",
					flowchart: {
						htmlLabels: true,
						curve: "basis",
					},
				});

				// Clear previous content
				containerRef.current.innerHTML = "";

				// Generate unique ID for this diagram
				const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;

				// Render the diagram
				const { svg } = await mermaid.render(id, chart);

				// Insert the SVG
				if (containerRef.current) {
					containerRef.current.innerHTML = svg;
					setIsLoading(false);
				}
			} catch (err) {
				console.error("Mermaid rendering error:", err);
				setError(
					err instanceof Error ? err.message : "Failed to render diagram",
				);
				setIsLoading(false);
			}
		};

		renderDiagram();
	}, [chart]);

	if (error) {
		return (
			<div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
				<h4 className="mb-2 font-mono font-semibold text-destructive text-sm">
					Diagram Rendering Error
				</h4>
				<p className="font-mono text-destructive/80 text-xs">{error}</p>
				<details className="mt-4">
					<summary className="cursor-pointer font-mono text-muted-foreground text-xs">
						View diagram code
					</summary>
					<pre className="mt-2 overflow-x-auto rounded bg-muted/50 p-2 font-mono text-xs">
						{chart}
					</pre>
				</details>
			</div>
		);
	}

	return (
		<div className="relative">
			{title && (
				<h3 className="mb-4 font-mono font-semibold text-lg">{title}</h3>
			)}
			{isLoading && (
				<div className="flex items-center justify-center p-8">
					<div className="font-mono text-muted-foreground text-sm">
						Rendering diagram...
					</div>
				</div>
			)}
			<div
				ref={containerRef}
				className="overflow-x-auto rounded-md border border-primary/10 bg-card p-4"
			/>
		</div>
	);
}
