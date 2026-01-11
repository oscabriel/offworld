import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";

const getFirstName = (user: { name?: string | null; email?: string | null } | null | undefined) => {
	if (!user) {
		return null;
	}
	return user.name?.trim().split(/\s+/)[0] ?? null;
};

export default function UserMenu() {
	const { data: user } = useQuery(convexQuery(api.auth.getCurrentUserSafe, {}));

	const handleSignOut = async () => {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					location.reload();
				},
			},
		});
	};

	const displayFirstName = user ? (getFirstName(user) ?? "User") : null;

	if (!user) {
		return (
			<Button
				variant="outline"
				className="bg-background text-primary"
				onClick={() => {
					window.location.href = "/sign-in";
				}}
			>
				<span className="font-semibold font-serif text-base">Sign In</span>
			</Button>
		);
	}

	const firstName = displayFirstName ?? "User";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button variant="outline" size="sm" className="h-9 px-3" />}>
				<span className="font-semibold font-serif text-base">{firstName}</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56" align="end">
				<DropdownMenuLabel className="font-normal">
					<div className="flex flex-col space-y-1">
						<p className="font-medium font-serif text-base leading-none">{user.name || "User"}</p>
						<p className="font-mono text-muted-foreground text-xs leading-none">{user.email}</p>
					</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={handleSignOut}>
					<LogOutIcon className="size-4" />
					<span className="font-mono text-sm">Sign Out</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
