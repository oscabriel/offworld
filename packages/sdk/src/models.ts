const MODELS_DEV_URL = "https://models.dev/api.json";

/**
 * Raw model data from models.dev
 */
export interface ModelsDevModel {
	id: string;
	name: string;
	family?: string;
	release_date: string;
	attachment: boolean;
	reasoning: boolean;
	temperature: boolean;
	tool_call: boolean;
	cost?: {
		input: number;
		output: number;
		cache_read?: number;
		cache_write?: number;
	};
	limit: {
		context: number;
		input?: number;
		output: number;
	};
	experimental?: boolean;
	status?: "alpha" | "beta" | "deprecated";
}

/**
 * Raw provider data from models.dev
 */
export interface ModelsDevProvider {
	id: string;
	name: string;
	api?: string;
	env: string[];
	npm?: string;
	models: Record<string, ModelsDevModel>;
}

/**
 * Simplified provider info for CLI display
 */
export interface ProviderInfo {
	id: string;
	name: string;
	env: string[];
}

/**
 * Simplified model info for CLI display
 */
export interface ModelInfo {
	id: string;
	name: string;
	reasoning: boolean;
	experimental?: boolean;
	status?: "alpha" | "beta" | "deprecated";
}

/**
 * Full provider with models for CLI display
 */
export interface ProviderWithModels extends ProviderInfo {
	models: ModelInfo[];
}

let cachedData: Record<string, ModelsDevProvider> | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Fetch raw data from models.dev with caching
 */
async function fetchModelsDevData(): Promise<Record<string, ModelsDevProvider>> {
	const now = Date.now();
	if (cachedData && now - cacheTime < CACHE_TTL_MS) {
		return cachedData;
	}

	const res = await fetch(MODELS_DEV_URL, {
		signal: AbortSignal.timeout(10_000),
	});

	if (!res.ok) {
		throw new Error(`Failed to fetch models.dev: ${res.status} ${res.statusText}`);
	}

	cachedData = (await res.json()) as Record<string, ModelsDevProvider>;
	cacheTime = now;
	return cachedData;
}

/**
 * List all available providers from models.dev
 */
export async function listProviders(): Promise<ProviderInfo[]> {
	const data = await fetchModelsDevData();

	return Object.values(data)
		.map((p) => ({
			id: p.id,
			name: p.name,
			env: p.env,
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get a specific provider with all its models
 */
export async function getProvider(providerId: string): Promise<ProviderWithModels | null> {
	const data = await fetchModelsDevData();
	const provider = data[providerId];

	if (!provider) {
		return null;
	}

	return {
		id: provider.id,
		name: provider.name,
		env: provider.env,
		models: Object.values(provider.models)
			.filter((m) => m.status !== "deprecated")
			.map((m) => ({
				id: m.id,
				name: m.name,
				reasoning: m.reasoning,
				experimental: m.experimental,
				status: m.status,
			}))
			.sort((a, b) => a.name.localeCompare(b.name)),
	};
}

/**
 * Get all providers with their models
 */
export async function listProvidersWithModels(): Promise<ProviderWithModels[]> {
	const data = await fetchModelsDevData();

	return Object.values(data)
		.map((p) => ({
			id: p.id,
			name: p.name,
			env: p.env,
			models: Object.values(p.models)
				.filter((m) => m.status !== "deprecated")
				.map((m) => ({
					id: m.id,
					name: m.name,
					reasoning: m.reasoning,
					experimental: m.experimental,
					status: m.status,
				}))
				.sort((a, b) => a.name.localeCompare(b.name)),
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Validate that a provider/model combination exists
 */
export async function validateProviderModel(
	providerId: string,
	modelId: string,
): Promise<{ valid: boolean; error?: string }> {
	const provider = await getProvider(providerId);

	if (!provider) {
		const providers = await listProviders();
		return {
			valid: false,
			error: `Provider "${providerId}" not found. Available: ${providers
				.slice(0, 10)
				.map((p) => p.id)
				.join(", ")}${providers.length > 10 ? "..." : ""}`,
		};
	}

	const model = provider.models.find((m) => m.id === modelId);
	if (!model) {
		return {
			valid: false,
			error: `Model "${modelId}" not found for provider "${providerId}". Available: ${provider.models
				.slice(0, 10)
				.map((m) => m.id)
				.join(", ")}${provider.models.length > 10 ? "..." : ""}`,
		};
	}

	return { valid: true };
}
