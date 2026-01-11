import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AnalysisMeta } from "../analysis/pipeline.js";

export interface StalenessCheckResult {
	isStale: boolean;
	reason?: "missing_meta" | "sha_mismatch" | "parse_error";
	cachedSha?: string;
	currentSha?: string;
}

export function isAnalysisStale(analysisPath: string, currentSha: string): StalenessCheckResult {
	const metaPath = join(analysisPath, "meta.json");

	if (!existsSync(metaPath)) {
		return {
			isStale: true,
			reason: "missing_meta",
			currentSha,
		};
	}

	try {
		const metaContent = readFileSync(metaPath, "utf-8");
		const meta = JSON.parse(metaContent) as Partial<AnalysisMeta>;

		if (!meta.commitSha) {
			return {
				isStale: true,
				reason: "missing_meta",
				currentSha,
			};
		}

		const cachedSha = meta.commitSha;
		const normalizedCachedSha = cachedSha.slice(0, 7);
		const normalizedCurrentSha = currentSha.slice(0, 7);

		if (normalizedCachedSha !== normalizedCurrentSha) {
			return {
				isStale: true,
				reason: "sha_mismatch",
				cachedSha,
				currentSha,
			};
		}

		return {
			isStale: false,
			cachedSha,
			currentSha,
		};
	} catch {
		return {
			isStale: true,
			reason: "parse_error",
			currentSha,
		};
	}
}

export function getCachedCommitSha(analysisPath: string): string | null {
	const metaPath = join(analysisPath, "meta.json");

	if (!existsSync(metaPath)) {
		return null;
	}

	try {
		const metaContent = readFileSync(metaPath, "utf-8");
		const meta = JSON.parse(metaContent) as Partial<AnalysisMeta>;
		return meta.commitSha ?? null;
	} catch {
		return null;
	}
}
