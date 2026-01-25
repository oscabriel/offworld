import { Fragment } from "react";
import { Link, useMatches } from "@tanstack/react-router";
import type { Crumb } from "@/types/router";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export function Breadcrumbs() {
	const matches = useMatches();
	const crumbs = matches
		.filter((m) => m.staticData?.crumbs)
		.flatMap((m) => m.staticData.crumbs!(m.params as Record<string, string>));

	if (crumbs.length === 0) return null;

	return (
		<nav className="pointer-events-auto absolute top-25 right-0 left-0 z-40">
			<div className="container mx-auto max-w-7xl px-5 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
				<Breadcrumb>
					<BreadcrumbList className="font-mono">
					<BreadcrumbItem>
						<BreadcrumbLink render={<Link to="/explore" />}>skills</BreadcrumbLink>
					</BreadcrumbItem>
					{crumbs.map((crumb: Crumb, i: number) => (
						<Fragment key={crumb.to}>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								{i === crumbs.length - 1 ? (
									<BreadcrumbPage>{crumb.label}</BreadcrumbPage>
								) : (
									<BreadcrumbLink render={<Link to={crumb.to} params={crumb.params} />}>
										{crumb.label}
									</BreadcrumbLink>
								)}
							</BreadcrumbItem>
						</Fragment>
					))}
					</BreadcrumbList>
				</Breadcrumb>
			</div>
		</nav>
	);
}
