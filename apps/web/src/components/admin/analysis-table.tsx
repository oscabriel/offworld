import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { BadgeCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function formatDate(isoString: string): string {
	return new Date(isoString).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function AnalysisTable() {
	const { data: analyses } = useSuspenseQuery(convexQuery(api.admin.listAllAnalyses, {}));
	const deleteAnalysis = useMutation(api.admin.deleteAnalysis);
	const toggleVerified = useMutation(api.admin.toggleVerified);
	const [loadingAnalysis, setLoadingAnalysis] = useState<string | null>(null);

	const handleDelete = async (fullName: string) => {
		setLoadingAnalysis(fullName);
		try {
			await deleteAnalysis({ fullName });
		} finally {
			setLoadingAnalysis(null);
		}
	};

	const handleToggleVerified = async (fullName: string) => {
		setLoadingAnalysis(fullName);
		try {
			await toggleVerified({ fullName });
		} finally {
			setLoadingAnalysis(null);
		}
	};

	if (!analyses) return null;

	return (
		<Card className="border border-primary/10 p-0 shadow-none">
			<div className="overflow-x-auto">
				<table className="w-full">
					<thead>
						<tr className="border-primary/10 border-b">
							<th className="px-4 py-3 text-left font-mono text-muted-foreground text-xs">
								Repository
							</th>
							<th className="px-4 py-3 text-left font-mono text-muted-foreground text-xs">
								Pull Count
							</th>
							<th className="px-4 py-3 text-left font-mono text-muted-foreground text-xs">
								Analyzed
							</th>
							<th className="px-4 py-3 text-left font-mono text-muted-foreground text-xs">
								Version
							</th>
							<th className="px-4 py-3 text-right font-mono text-muted-foreground text-xs">
								Actions
							</th>
						</tr>
					</thead>
					<tbody>
						{analyses.map((analysis) => (
							<tr key={analysis._id} className="border-primary/5 border-b last:border-0">
								<td className="px-4 py-3">
									<div className="flex items-center gap-2">
										<span className="font-serif">{analysis.fullName}</span>
										{analysis.isVerified && <BadgeCheck className="h-4 w-4 text-blue-500" />}
									</div>
								</td>
								<td className="px-4 py-3 font-mono text-sm">
									{analysis.pullCount.toLocaleString()}
								</td>
								<td className="px-4 py-3 font-mono text-muted-foreground text-sm">
									{formatDate(analysis.analyzedAt)}
								</td>
								<td className="px-4 py-3 font-mono text-muted-foreground text-sm">
									{analysis.version}
								</td>
								<td className="px-4 py-3 text-right">
									<div className="flex justify-end gap-2">
										<Button
											variant="outline"
											size="sm"
											onClick={() => handleToggleVerified(analysis.fullName)}
											disabled={loadingAnalysis === analysis.fullName}
											className="font-mono text-xs"
										>
											{analysis.isVerified ? "Unverify" : "Verify"}
										</Button>
										<AlertDialog>
											<AlertDialogTrigger
												render={
													<Button
														variant="outline"
														size="sm"
														className="font-mono text-red-600 text-xs hover:bg-red-600/10 hover:text-red-600"
														disabled={loadingAnalysis === analysis.fullName}
													>
														<Trash2 className="h-3 w-3" />
													</Button>
												}
											/>
											<AlertDialogContent>
												<AlertDialogHeader>
													<AlertDialogTitle className="font-serif">
														Delete {analysis.fullName}?
													</AlertDialogTitle>
													<AlertDialogDescription className="font-mono text-sm">
														This will permanently delete this analysis. Users will need to
														re-generate it with the CLI.
													</AlertDialogDescription>
												</AlertDialogHeader>
												<AlertDialogFooter>
													<AlertDialogCancel className="font-mono">Cancel</AlertDialogCancel>
													<AlertDialogAction
														onClick={() => handleDelete(analysis.fullName)}
														className="bg-red-600 font-mono hover:bg-red-700"
													>
														Delete
													</AlertDialogAction>
												</AlertDialogFooter>
											</AlertDialogContent>
										</AlertDialog>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</Card>
	);
}
