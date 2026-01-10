/**
 * Mock for file system operations
 * Used to test config.ts, util.ts, and index-manager.ts without real disk I/O
 */

import { vi, type Mock } from "vitest";
import { join } from "node:path";

export interface VirtualFile {
	content: string | Buffer;
	isDirectory?: boolean;
}

export interface VirtualFileSystem {
	[path: string]: VirtualFile;
}

let virtualFs: VirtualFileSystem = {};

/**
 * Initialize the virtual file system with files
 */
export function initVirtualFs(files: VirtualFileSystem): void {
	virtualFs = { ...files };
}

/**
 * Add a file to the virtual file system
 */
export function addVirtualFile(path: string, content: string | Buffer, isDirectory = false): void {
	virtualFs[path] = { content, isDirectory };
}

/**
 * Remove a file from the virtual file system
 */
export function removeVirtualFile(path: string): void {
	delete virtualFs[path];
}

/**
 * Clear the virtual file system
 */
export function clearVirtualFs(): void {
	virtualFs = {};
}

/**
 * Get the current state of the virtual file system
 */
export function getVirtualFs(): VirtualFileSystem {
	return { ...virtualFs };
}

/**
 * Normalize a path for lookup
 */
function normalizePath(p: string): string {
	// Handle ~ expansion for testing
	if (p.startsWith("~/")) {
		p = join("/home/testuser", p.slice(2));
	}
	// Normalize separators and remove trailing slashes
	return p.replace(/\\/g, "/").replace(/\/+$/, "");
}

/**
 * Create mock for node:fs module
 */
export function createFsMock() {
	const existsSync: Mock = vi.fn((path: string) => {
		const normalized = normalizePath(path);
		return normalized in virtualFs;
	});

	const readFileSync: Mock = vi.fn(
		(path: string, encoding?: BufferEncoding | { encoding?: BufferEncoding }) => {
			const normalized = normalizePath(path);
			const file = virtualFs[normalized];

			if (!file) {
				const error = new Error(
					`ENOENT: no such file or directory, open '${path}'`,
				) as NodeJS.ErrnoException;
				error.code = "ENOENT";
				throw error;
			}

			if (file.isDirectory) {
				const error = new Error(
					`EISDIR: illegal operation on a directory, read '${path}'`,
				) as NodeJS.ErrnoException;
				error.code = "EISDIR";
				throw error;
			}

			const enc = typeof encoding === "string" ? encoding : encoding?.encoding;
			if (enc === "utf-8" || enc === "utf8") {
				return typeof file.content === "string" ? file.content : file.content.toString("utf-8");
			}

			return typeof file.content === "string" ? Buffer.from(file.content) : file.content;
		},
	);

	const writeFileSync: Mock = vi.fn((path: string, data: string | Buffer) => {
		const normalized = normalizePath(path);
		virtualFs[normalized] = {
			content: data,
			isDirectory: false,
		};
	});

	const mkdirSync: Mock = vi.fn((path: string, options?: { recursive?: boolean }) => {
		const normalized = normalizePath(path);

		if (options?.recursive) {
			// Create all parent directories
			const parts = normalized.split("/").filter(Boolean);
			let current = "";
			for (const part of parts) {
				current += "/" + part;
				if (!(current in virtualFs)) {
					virtualFs[current] = { content: "", isDirectory: true };
				}
			}
		} else {
			virtualFs[normalized] = { content: "", isDirectory: true };
		}
	});

	const rmSync: Mock = vi.fn((path: string, options?: { recursive?: boolean; force?: boolean }) => {
		const normalized = normalizePath(path);

		if (!(normalized in virtualFs) && !options?.force) {
			const error = new Error(
				`ENOENT: no such file or directory, unlink '${path}'`,
			) as NodeJS.ErrnoException;
			error.code = "ENOENT";
			throw error;
		}

		if (options?.recursive) {
			// Remove all paths starting with this path
			for (const key of Object.keys(virtualFs)) {
				if (key === normalized || key.startsWith(normalized + "/")) {
					delete virtualFs[key];
				}
			}
		} else {
			delete virtualFs[normalized];
		}
	});

	const readdirSync: Mock = vi.fn((path: string) => {
		const normalized = normalizePath(path);
		const entries: string[] = [];

		for (const key of Object.keys(virtualFs)) {
			if (key.startsWith(normalized + "/")) {
				const relative = key.slice(normalized.length + 1);
				const firstPart = relative.split("/")[0];
				if (firstPart && !entries.includes(firstPart)) {
					entries.push(firstPart);
				}
			}
		}

		return entries;
	});

	const statSync: Mock = vi.fn((path: string) => {
		const normalized = normalizePath(path);
		const file = virtualFs[normalized];

		if (!file) {
			const error = new Error(
				`ENOENT: no such file or directory, stat '${path}'`,
			) as NodeJS.ErrnoException;
			error.code = "ENOENT";
			throw error;
		}

		return {
			isDirectory: () => file.isDirectory ?? false,
			isFile: () => !file.isDirectory,
			size: typeof file.content === "string" ? file.content.length : file.content.length,
		};
	});

	return {
		existsSync,
		readFileSync,
		writeFileSync,
		mkdirSync,
		rmSync,
		readdirSync,
		statSync,
	};
}

/**
 * Create mock for node:fs/promises module
 */
export function createFsPromisesMock() {
	const fsMock = createFsMock();

	return {
		readFile: vi.fn(
			async (path: string, encoding?: BufferEncoding | { encoding?: BufferEncoding }) => {
				return fsMock.readFileSync(path, encoding);
			},
		),

		writeFile: vi.fn(async (path: string, data: string | Buffer) => {
			fsMock.writeFileSync(path, data);
		}),

		mkdir: vi.fn(async (path: string, options?: { recursive?: boolean }) => {
			fsMock.mkdirSync(path, options);
		}),

		rm: vi.fn(async (path: string, options?: { recursive?: boolean; force?: boolean }) => {
			fsMock.rmSync(path, options);
		}),

		readdir: vi.fn(async (path: string) => {
			return fsMock.readdirSync(path);
		}),

		stat: vi.fn(async (path: string) => {
			return fsMock.statSync(path);
		}),

		access: vi.fn(async (path: string) => {
			const normalized = normalizePath(path);
			if (!(normalized in virtualFs)) {
				const error = new Error(
					`ENOENT: no such file or directory, access '${path}'`,
				) as NodeJS.ErrnoException;
				error.code = "ENOENT";
				throw error;
			}
		}),
	};
}

/**
 * Install fs mocks for testing
 */
export function installFsMocks() {
	const fsMock = createFsMock();
	const fsPromisesMock = createFsPromisesMock();

	vi.mock("node:fs", () => fsMock);
	vi.mock("node:fs/promises", () => fsPromisesMock);

	return { fs: fsMock, fsPromises: fsPromisesMock };
}
