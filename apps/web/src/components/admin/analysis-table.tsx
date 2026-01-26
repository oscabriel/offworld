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
import { formatShortDate } from "@/lib/format";

export function ReferenceTable() {
	const { data: references } = useSuspenseQuery(convexQuery(api.admin.listAllReferences, {}));
	const deleteReference = useMutation(api.admin.deleteReference);
	const toggleVerified = useMutation(api.admin.toggleVerified);
	const [loadingReference, setLoadingReference] = useState<string | null>(null);

	const handleDelete = async (fullName: string) => {
		setLoadingReference(fullName);
		try {
			await deleteReference({ fullName });
		} finally {
			setLoadingReference(null);
		}
	};

	const handleToggleVerified = async (fullName: string) => {
		setLoadingReference(fullName);
		try {
			await toggleVerified({ fullName });
		} finally {
			setLoadingReference(null);
		}
	};

	if (!references) return null;

	return (
		<Card className="border-primary/10 border p-0">
			<div className="overflow-x-auto">
				<table className="w-full">
					<thead>
						<tr className="border-primary/10 border-b">
							<th className="text-muted-foreground px-5 py-3 text-left font-mono text-xs">
								Repository
							</th>
							<th className="text-muted-foreground px-5 py-3 text-left font-mono text-xs">
								Pull Count
							</th>
							<th className="text-muted-foreground px-5 py-3 text-left font-mono text-xs">
								Generated
							</th>
							<th className="text-muted-foreground px-5 py-3 text-left font-mono text-xs">
								Commit
							</th>
							<th className="text-muted-foreground px-5 py-3 text-right font-mono text-xs">
								Actions
							</th>
						</tr>
					</thead>
					<tbody>
						{references.map((reference) => (
							<tr key={reference._id} className="border-primary/5 border-b last:border-0">
								<td className="px-5 py-3">
									<div className="flex items-center gap-2">
										<span className="font-serif">{reference.fullName}</span>
										{reference.isVerified && <BadgeCheck className="h-4 w-4 text-blue-500" />}
									</div>
								</td>
								<td className="px-5 py-3 font-mono text-sm">
									{reference.pullCount.toLocaleString()}
								</td>
								<td className="text-muted-foreground px-5 py-3 font-mono text-sm">
									{formatShortDate(reference.generatedAt)}
								</td>
								<td className="text-muted-foreground px-5 py-3 font-mono text-sm">
									{reference.commitSha ? reference.commitSha.slice(0, 7) : "—"}
								</td>
								<td className="px-5 py-3 text-right">
									<div className="flex justify-end gap-2">
										<Button
											variant="outline"
											size="sm"
											onClick={() => handleToggleVerified(reference.fullName)}
											disabled={loadingReference === reference.fullName}
											className="font-mono text-xs"
										>
											{reference.isVerified ? "Unverify" : "Verify"}
										</Button>
										<AlertDialog>
											<AlertDialogTrigger
												render={
													<Button
														variant="outline"
														size="sm"
														className="font-mono text-xs text-red-600 hover:bg-red-600/10 hover:text-red-600"
														disabled={loadingReference === reference.fullName}
													>
														<Trash2 className="h-3 w-3" />
													</Button>
												}
											/>
											<AlertDialogContent>
												<AlertDialogHeader>
													<AlertDialogTitle className="font-serif">
														Delete {reference.fullName}?
													</AlertDialogTitle>
													<AlertDialogDescription className="font-mono text-sm">
														This will permanently delete this reference. Users will need to
														re-generate it with the CLI.
													</AlertDialogDescription>
												</AlertDialogHeader>
												<AlertDialogFooter>
													<AlertDialogCancel className="font-mono">Cancel</AlertDialogCancel>
													<AlertDialogAction
														onClick={() => handleDelete(reference.fullName)}
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
