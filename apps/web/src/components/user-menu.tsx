import { api } from "@offworld/backend/convex/_generated/api";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";

export default function UserMenu() {
	const navigate = useNavigate();
	const user = useQuery(api.auth.getCurrentUserSafe);

	if (!user) {
		return (
			<Link
				to="/sign-in"
				className="cursor-pointer font-serif text-lg transition-opacity hover:opacity-70"
			>
				Sign In
			</Link>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger className="cursor-pointer font-serif text-lg transition-opacity hover:opacity-70 focus:outline-none">
				{user.name || user.email}
			</DropdownMenuTrigger>
			<DropdownMenuContent className="border-primary/10 bg-card/95 backdrop-blur-sm">
				<DropdownMenuItem className="text-muted-foreground text-sm">
					{user.email}
				</DropdownMenuItem>
				<DropdownMenuSeparator className="bg-primary/10" />
				<DropdownMenuItem
					className="cursor-pointer text-destructive focus:text-destructive"
					onClick={() => {
						authClient.signOut({
							fetchOptions: {
								onSuccess: () => {
									navigate({
										to: "/",
									});
								},
							},
						});
					}}
				>
					Sign Out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
