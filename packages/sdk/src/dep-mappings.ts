/**
 * Three-tier dependency name to GitHub repo resolution:
 * 1. KNOWN_MAPPINGS - hardcoded popular packages
 * 2. npm registry fallback
 * 3. User prompt (handled by caller)
 */

import { NpmPackageResponseSchema } from "@offworld/types";

export type ResolvedDep = {
	dep: string;
	repo: string | null;
	source: "known" | "npm" | "unknown";
};

/**
 * Hardcoded mappings for popular packages.
 * Covers top ecosystems: React, Vue, Svelte, backend, database, validation, styling.
 */
export const KNOWN_MAPPINGS: Record<string, string> = {
	react: "facebook/react",
	"react-dom": "facebook/react",
	next: "vercel/next.js",
	remix: "remix-run/remix",
	"@remix-run/react": "remix-run/remix",
	"@remix-run/node": "remix-run/remix",

	vue: "vuejs/core",
	nuxt: "nuxt/nuxt",
	"@nuxt/kit": "nuxt/nuxt",

	svelte: "sveltejs/svelte",
	sveltekit: "sveltejs/kit",
	"@sveltejs/kit": "sveltejs/kit",

	"@tanstack/query": "tanstack/query",
	"@tanstack/react-query": "tanstack/query",
	"@tanstack/vue-query": "tanstack/query",
	"@tanstack/router": "tanstack/router",
	"@tanstack/react-router": "tanstack/router",
	"@tanstack/start": "tanstack/router",
	zustand: "pmndrs/zustand",
	jotai: "pmndrs/jotai",
	valtio: "pmndrs/valtio",
	redux: "reduxjs/redux",
	"@reduxjs/toolkit": "reduxjs/redux-toolkit",

	express: "expressjs/express",
	hono: "honojs/hono",
	fastify: "fastify/fastify",
	koa: "koajs/koa",
	nestjs: "nestjs/nest",
	"@nestjs/core": "nestjs/nest",

	// API/RPC
	trpc: "trpc/trpc",
	"@trpc/server": "trpc/trpc",
	"@trpc/client": "trpc/trpc",
	"@trpc/react-query": "trpc/trpc",
	graphql: "graphql/graphql-js",
	"apollo-server": "apollographql/apollo-server",
	"@apollo/client": "apollographql/apollo-client",

	"drizzle-orm": "drizzle-team/drizzle-orm",
	prisma: "prisma/prisma",
	"@prisma/client": "prisma/prisma",
	typeorm: "typeorm/typeorm",
	sequelize: "sequelize/sequelize",
	mongoose: "Automattic/mongoose",
	knex: "knex/knex",

	zod: "colinhacks/zod",
	valibot: "fabian-hiller/valibot",
	yup: "jquense/yup",
	joi: "hapijs/joi",

	tailwindcss: "tailwindlabs/tailwindcss",
	"styled-components": "styled-components/styled-components",
	"@emotion/react": "emotion-js/emotion",
	sass: "sass/sass",

	vite: "vitejs/vite",
	webpack: "webpack/webpack",
	esbuild: "evanw/esbuild",
	rollup: "rollup/rollup",
	"@vitejs/plugin-react": "vitejs/vite-plugin-react",

	vitest: "vitest-dev/vitest",
	jest: "jestjs/jest",
	"@testing-library/react": "testing-library/react-testing-library",
	cypress: "cypress-io/cypress",
	playwright: "microsoft/playwright",

	convex: "get-convex/convex-backend",

	"better-auth": "better-auth/better-auth",

	lodash: "lodash/lodash",
	"date-fns": "date-fns/date-fns",
	axios: "axios/axios",
	ky: "sindresorhus/ky",

	turborepo: "vercel/turborepo",
	nx: "nrwl/nx",
};

/**
 * Parse GitHub repo from various git URL formats.
 * Handles:
 * - git+https://github.com/owner/repo.git
 * - https://github.com/owner/repo
 * - git://github.com/owner/repo.git
 * - github:owner/repo
 */
function parseGitHubUrl(url: string): string | null {
	const patterns = [
		/github\.com[/:]([\w-]+)\/([\w.-]+?)(?:\.git)?$/,
		/^github:([\w-]+)\/([\w.-]+)$/,
	];

	for (const pattern of patterns) {
		const match = url.match(pattern);
		if (match) {
			return `${match[1]}/${match[2]}`;
		}
	}

	return null;
}

/**
 * Fallback to npm registry to extract repository.url.
 * Returns null if package not found, no repo field, or not a GitHub repo.
 */
export async function resolveFromNpm(packageName: string): Promise<string | null> {
	try {
		const res = await fetch(`https://registry.npmjs.org/${packageName}`);
		if (!res.ok) return null;

		const json = await res.json();
		const result = NpmPackageResponseSchema.safeParse(json);
		if (!result.success) return null;

		const repoUrl = result.data.repository?.url;
		if (!repoUrl) return null;

		return parseGitHubUrl(repoUrl);
	} catch {
		return null;
	}
}

/**
 * Three-tier resolution:
 * 1. Check KNOWN_MAPPINGS
 * 2. Query npm registry
 * 3. Return unknown (caller prompts user)
 */
export async function resolveDependencyRepo(dep: string): Promise<ResolvedDep> {
	if (dep in KNOWN_MAPPINGS) {
		return { dep, repo: KNOWN_MAPPINGS[dep] ?? null, source: "known" };
	}

	const npmRepo = await resolveFromNpm(dep);
	if (npmRepo) {
		return { dep, repo: npmRepo, source: "npm" };
	}

	return { dep, repo: null, source: "unknown" };
}
