/// <reference types="vite/client" />

// Type declarations for import.meta.glob (Vite feature used by convex-test)
interface ImportMetaEnv {
	readonly [key: string]: string | undefined;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
	glob<T = unknown>(
		pattern: string,
		options?: { eager?: boolean },
	): Record<string, () => Promise<T>>;
}
