import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const installCommands = [
	{ id: "curl", label: "curl", command: "curl -fsSL https://offworld.sh/install | bash" },
	{ id: "npm", label: "npm", command: "npm i -g offworld" },
	{ id: "bun", label: "bun", command: "bun add -g offworld" },
	{ id: "brew", label: "brew", command: "brew install oscabriel/tap/offworld" },
] as const;

interface InstallTabsProps {
	className?: string;
	variant?: "default" | "compact";
}

export function InstallTabs({ className, variant = "default" }: InstallTabsProps) {
	const [copied, setCopied] = useState(false);
	const [activeTab, setActiveTab] = useState<string>("curl");

	const activeCommand = installCommands.find((c) => c.id === activeTab)?.command ?? "";

	const copyCommand = () => {
		navigator.clipboard.writeText(activeCommand);
		setCopied(true);
		toast.success("Copied to clipboard");
		setTimeout(() => setCopied(false), 2000);
	};

	const isCompact = variant === "compact";

	return (
		<div className={cn("w-full", className)}>
			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<div className="border-primary/20 bg-background/50 flex items-stretch border-x border-t backdrop-blur-sm">
					<TabsList variant="line" className="h-auto flex-1 justify-start gap-0 bg-transparent p-0">
						{installCommands.map((cmd) => (
							<TabsTrigger
								key={cmd.id}
								value={cmd.id}
								className={cn(
									"border-primary/20 data-[state=active]:bg-primary/5 data-[state=active]:text-primary h-full border-r px-5 py-3 font-mono text-sm transition-colors",
									"hover:bg-primary/5",
								)}
							>
								{cmd.label}
							</TabsTrigger>
						))}
					</TabsList>

					<button
						type="button"
						onClick={copyCommand}
						className="text-muted-foreground hover:text-primary hover:bg-primary/5 flex items-center gap-2 px-5 font-mono text-sm transition-colors"
					>
						{copied ? (
							<>
								<Check className="size-4 text-green-500" />
								<span className="hidden text-green-500 sm:inline">Copied</span>
							</>
						) : (
							<>
								<Copy className="size-4" />
								<span className="hidden sm:inline">Copy</span>
							</>
						)}
					</button>
				</div>

				{installCommands.map((cmd) => (
					<TabsContent
						key={cmd.id}
						value={cmd.id}
						className={cn(
							"border-primary/20 bg-card/50 mt-0 border border-t-0",
							isCompact ? "px-3 py-2" : "px-5 py-3",
						)}
					>
						<code className="text-primary block overflow-x-auto font-mono text-sm">
							<span className="text-muted-foreground select-none">$ </span>
							{cmd.command}
						</code>
					</TabsContent>
				))}
			</Tabs>
		</div>
	);
}
