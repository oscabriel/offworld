import "@tanstack/react-router";

export type Crumb = {
	label: string;
	to: string;
	params?: Record<string, string>;
};

declare module "@tanstack/react-router" {
	interface StaticDataRouteOption {
		crumbs?: (params: Record<string, string>) => Crumb[];
	}
}
