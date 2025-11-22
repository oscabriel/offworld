import { Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface MermaidDiagramProps {
	chart: string;
	title?: string;
}

export function MermaidDiagram({ chart, title }: MermaidDiagramProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const modalContainerRef = useRef<HTMLDivElement>(null);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [modalScale, setModalScale] = useState(1);

	useEffect(() => {
		const renderDiagram = async () => {
			if (!containerRef.current || !chart) return;

			try {
				setIsLoading(true);
				setError(null);

				// Dynamically import mermaid (lazy load)
				const mermaid = (await import("mermaid")).default;

				// Detect if dark mode is active
				const isDark = document.documentElement.classList.contains("dark");

				// Initialize mermaid with theme-aware configuration
				mermaid.initialize({
					startOnLoad: false,
					theme: isDark ? "dark" : "neutral",
					securityLevel: "loose",
					fontFamily: "Geist Mono, monospace",
					flowchart: {
						htmlLabels: true,
						curve: "basis",
					},
					themeVariables: isDark
						? {
								primaryColor: "#2c2c2e",
								primaryTextColor: "#e8e8ea",
								primaryBorderColor: "#636366",
								lineColor: "#636366",
								secondaryColor: "#3a3a3c",
								tertiaryColor: "#48484a",
								background: "#1c1c1e",
								mainBkg: "#2c2c2e",
								secondBkg: "#3a3a3c",
								textColor: "#e8e8ea",
								border1: "#636366",
								border2: "#48484a",
								nodeBorder: "#636366",
								clusterBkg: "#2c2c2e",
								clusterBorder: "#636366",
								defaultLinkColor: "#636366",
								titleColor: "#e8e8ea",
								edgeLabelBackground: "#2c2c2e",
								actorBorder: "#636366",
								actorBkg: "#2c2c2e",
								actorTextColor: "#e8e8ea",
								actorLineColor: "#636366",
								signalColor: "#e8e8ea",
								signalTextColor: "#e8e8ea",
								labelBoxBkgColor: "#2c2c2e",
								labelBoxBorderColor: "#636366",
								labelTextColor: "#e8e8ea",
							}
						: {
								primaryColor: "#f5f5f7",
								primaryTextColor: "#1c1c1e",
								primaryBorderColor: "#d1d1d6",
								lineColor: "#8e8e93",
								secondaryColor: "#ffffff",
								tertiaryColor: "#f5f5f7",
								background: "#ffffff",
								mainBkg: "#f5f5f7",
								secondBkg: "#ffffff",
								textColor: "#1c1c1e",
								border1: "#d1d1d6",
								border2: "#e5e5ea",
								nodeBorder: "#d1d1d6",
								clusterBkg: "#f5f5f7",
								clusterBorder: "#d1d1d6",
								defaultLinkColor: "#8e8e93",
								titleColor: "#1c1c1e",
								edgeLabelBackground: "#ffffff",
								actorBorder: "#d1d1d6",
								actorBkg: "#f5f5f7",
								actorTextColor: "#1c1c1e",
								actorLineColor: "#8e8e93",
								signalColor: "#1c1c1e",
								signalTextColor: "#1c1c1e",
								labelBoxBkgColor: "#f5f5f7",
								labelBoxBorderColor: "#d1d1d6",
								labelTextColor: "#1c1c1e",
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
				setError(
					err instanceof Error ? err.message : "Failed to render diagram",
				);
				setIsLoading(false);
			}
		};

		renderDiagram();
	}, [chart]);

	// Render diagram in modal when opened
	useEffect(() => {
		if (!isModalOpen || !modalContainerRef.current) return;

		const renderModalDiagram = async () => {
			try {
				const mermaid = (await import("mermaid")).default;
				const isDark = document.documentElement.classList.contains("dark");

				mermaid.initialize({
					startOnLoad: false,
					theme: isDark ? "dark" : "neutral",
					securityLevel: "loose",
					fontFamily: "Geist Mono, monospace",
					flowchart: {
						htmlLabels: true,
						curve: "basis",
					},
					themeVariables: isDark
						? {
								primaryColor: "#2c2c2e",
								primaryTextColor: "#e8e8ea",
								primaryBorderColor: "#636366",
								lineColor: "#636366",
								secondaryColor: "#3a3a3c",
								tertiaryColor: "#48484a",
								background: "#1c1c1e",
								mainBkg: "#2c2c2e",
								secondBkg: "#3a3a3c",
								textColor: "#e8e8ea",
								border1: "#636366",
								border2: "#48484a",
								nodeBorder: "#636366",
								clusterBkg: "#2c2c2e",
								clusterBorder: "#636366",
								defaultLinkColor: "#636366",
								titleColor: "#e8e8ea",
								edgeLabelBackground: "#2c2c2e",
								actorBorder: "#636366",
								actorBkg: "#2c2c2e",
								actorTextColor: "#e8e8ea",
								actorLineColor: "#636366",
								signalColor: "#e8e8ea",
								signalTextColor: "#e8e8ea",
								labelBoxBkgColor: "#2c2c2e",
								labelBoxBorderColor: "#636366",
								labelTextColor: "#e8e8ea",
							}
						: {
								primaryColor: "#f5f5f7",
								primaryTextColor: "#1c1c1e",
								primaryBorderColor: "#d1d1d6",
								lineColor: "#8e8e93",
								secondaryColor: "#ffffff",
								tertiaryColor: "#f5f5f7",
								background: "#ffffff",
								mainBkg: "#f5f5f7",
								secondBkg: "#ffffff",
								textColor: "#1c1c1e",
								border1: "#d1d1d6",
								border2: "#e5e5ea",
								nodeBorder: "#d1d1d6",
								clusterBkg: "#f5f5f7",
								clusterBorder: "#d1d1d6",
								defaultLinkColor: "#8e8e93",
								titleColor: "#1c1c1e",
								edgeLabelBackground: "#ffffff",
								actorBorder: "#d1d1d6",
								actorBkg: "#f5f5f7",
								actorTextColor: "#1c1c1e",
								actorLineColor: "#8e8e93",
								signalColor: "#1c1c1e",
								signalTextColor: "#1c1c1e",
								labelBoxBkgColor: "#f5f5f7",
								labelBoxBorderColor: "#d1d1d6",
								labelTextColor: "#1c1c1e",
							},
				});

				if (!modalContainerRef.current) return;

				modalContainerRef.current.innerHTML = "";
				const id = `mermaid-modal-${Math.random().toString(36).substr(2, 9)}`;
				const { svg } = await mermaid.render(id, chart);

				if (modalContainerRef.current) {
					modalContainerRef.current.innerHTML = svg;
				}
			} catch (err) {
				console.error("Mermaid render error:", err);
			}
		};

		renderModalDiagram();
	}, [isModalOpen, chart]);

	// Close modal on Escape key
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape" && isModalOpen) {
				setIsModalOpen(false);
				setModalScale(1);
			}
		};

		window.addEventListener("keydown", handleEscape);
		return () => window.removeEventListener("keydown", handleEscape);
	}, [isModalOpen]);

	// Prevent body scroll when modal is open
	useEffect(() => {
		if (isModalOpen) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "";
		}
		return () => {
			document.body.style.overflow = "";
		};
	}, [isModalOpen]);

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
		<>
			<div className="relative space-y-4">
				{/* Zoom controls - always visible */}
				<div className="flex items-center justify-between">
					{title && (
						<h3 className="font-mono font-semibold text-lg">{title}</h3>
					)}
					<Button
						variant="outline"
						size="sm"
						onClick={() => setIsModalOpen(true)}
						className="ml-auto gap-2"
					>
						<Maximize2 className="size-4" />
						<span className="hidden sm:inline">Expand</span>
					</Button>
				</div>

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

			{/* Full-screen modal */}
			{isModalOpen && (
				<div
					role="dialog"
					aria-modal="true"
					aria-label="Diagram viewer"
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
					onClick={() => {
						setIsModalOpen(false);
						setModalScale(1);
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							setIsModalOpen(false);
							setModalScale(1);
						}
					}}
				>
					{/* Modal content */}
					<div
						role="document"
						className="relative h-full w-full overflow-auto p-8"
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => e.stopPropagation()}
					>
						{/* Controls */}
						<div className="fixed top-8 right-8 z-10 flex gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => setModalScale(Math.max(0.5, modalScale - 0.25))}
								className="gap-2 bg-background/95 backdrop-blur"
							>
								<ZoomOut className="size-4" />
								<span className="hidden sm:inline">Zoom Out</span>
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setModalScale(Math.min(3, modalScale + 0.25))}
								className="gap-2 bg-background/95 backdrop-blur"
							>
								<ZoomIn className="size-4" />
								<span className="hidden sm:inline">Zoom In</span>
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									setIsModalOpen(false);
									setModalScale(1);
								}}
								className="gap-2 bg-background/95 backdrop-blur"
							>
								<X className="size-4" />
								<span className="hidden sm:inline">Close</span>
							</Button>
						</div>

						{/* Diagram */}
						<div
							ref={modalContainerRef}
							className="inline-block min-w-full bg-background p-8 transition-transform duration-200"
							style={{
								transform: `scale(${modalScale})`,
								transformOrigin: "center top",
							}}
						/>
					</div>
				</div>
			)}
		</>
	);
}
