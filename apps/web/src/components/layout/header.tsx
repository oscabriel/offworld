import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { MenuIcon, XIcon } from "lucide-react";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@offworld/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import UserMenu from "@/components/layout/user-menu";
import { Sheet, SheetTrigger, SheetContent, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
	{ to: "/cli", label: "CLI" },
	{ to: "/explore", label: "Explore" },
] as const;

function MobileUserMenu({ onNavigate }: { onNavigate: () => void }) {
	const { data: user } = useQuery(convexQuery(api.auth.getCurrentUserSafe, {}));

	if (!user) {
		return (
			<Link
				to="/sign-in"
				onClick={onNavigate}
				className="text-primary hover:text-primary/40 font-mono text-3xl transition-colors"
			>
				Login
			</Link>
		);
	}

	return (
		<Link
			to="/profile"
			onClick={onNavigate}
			className="text-primary hover:text-primary/40 font-mono text-3xl transition-colors"
		>
			Profile
		</Link>
	);
}

export default function Header() {
	const [open, setOpen] = useState(false);
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const handleScroll = () => {
			setScrolled(window.scrollY > 10);
		};

		window.addEventListener("scroll", handleScroll, { passive: true });
		handleScroll();

		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	return (
		<div
			className={cn(
				"pointer-events-none sticky top-0 right-0 left-0 z-50 transition-all duration-300",
				scrolled
					? "border-primary/10 bg-background border-b"
					: "border-b border-transparent bg-transparent",
			)}
		>
			<div className="container mx-auto flex max-w-7xl flex-row items-center justify-between px-5 py-5 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<Link to="/" className="pointer-events-auto flex items-center gap-2">
					<img
						src="/logotype.svg"
						alt="Offworld"
						className="h-8 transition-transform hover:scale-105"
					/>
				</Link>

				{/* Desktop navigation */}
				<nav className="pointer-events-auto hidden items-center gap-8 md:flex">
					{navLinks.map((link) => (
						<Link
							key={link.to}
							to={link.to}
							className="text-primary hover:text-primary/40 font-mono text-base transition-colors"
						>
							{link.label}
						</Link>
					))}
					<UserMenu />
				</nav>

				{/* Mobile hamburger menu */}
				<Sheet open={open} onOpenChange={setOpen}>
					<SheetTrigger
						render={
							<Button
								variant="ghost"
								size="icon"
								className="pointer-events-auto md:hidden"
								aria-label="Open menu"
							/>
						}
					>
						<MenuIcon className="size-6" />
					</SheetTrigger>
					<SheetContent
						side="right"
						showCloseButton={false}
						className="w-full max-w-full sm:max-w-full"
					>
						{/* Close button */}
						<SheetClose
							render={
								<Button
									variant="ghost"
									size="icon"
									className="absolute top-5 right-5"
									aria-label="Close menu"
								/>
							}
						>
							<XIcon className="size-6" />
						</SheetClose>

						{/* Fullscreen nav content */}
						<nav className="flex h-full flex-col items-center justify-center gap-10">
							{navLinks.map((link) => (
								<Link
									key={link.to}
									to={link.to}
									onClick={() => setOpen(false)}
									className="text-primary hover:text-primary/40 font-mono text-3xl transition-colors"
								>
									{link.label}
								</Link>
							))}
							<MobileUserMenu onNavigate={() => setOpen(false)} />
						</nav>
					</SheetContent>
				</Sheet>
			</div>
		</div>
	);
}
