import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

const http = httpRouter();

// ============================================================================
// /api/analyses/pull endpoint
// ============================================================================

http.route({
	path: "/api/analyses/pull",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		try {
			const body = (await request.json()) as { fullName?: string };
			const { fullName } = body;

			// Validate required field
			if (!fullName || typeof fullName !== "string") {
				return new Response(JSON.stringify({ error: "fullName is required" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}

			// Get analysis
			const analysis = await ctx.runQuery(internal.analyses.getByRepo, {
				fullName,
			});

			if (!analysis) {
				return new Response(JSON.stringify({ error: "Analysis not found" }), {
					status: 404,
					headers: { "Content-Type": "application/json" },
				});
			}

			// Increment pull count
			await ctx.runMutation(internal.analyses.incrementPullCount, {
				fullName,
			});

			// Return analysis data
			return new Response(
				JSON.stringify({
					fullName: analysis.fullName,
					summary: analysis.summary,
					architecture: analysis.architecture,
					skill: analysis.skill,
					fileIndex: analysis.fileIndex,
					commitSha: analysis.commitSha,
					analyzedAt: analysis.analyzedAt,
					pullCount: analysis.pullCount + 1, // Return updated count
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		} catch (error) {
			console.error("Pull error:", error);
			return new Response(JSON.stringify({ error: "Internal server error" }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		}
	}),
});

// ============================================================================
// /api/analyses/push endpoint
// ============================================================================

http.route({
	path: "/api/analyses/push",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		try {
			// Check authorization header
			const authHeader = request.headers.get("Authorization");
			if (!authHeader || !authHeader.startsWith("Bearer ")) {
				return new Response(
					JSON.stringify({
						error: "Authentication required",
						message: "Please run 'ow auth login' first",
					}),
					{
						status: 401,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			// Token validated by Convex auth via JWKS
			const identity = await ctx.auth.getUserIdentity();
			if (!identity) {
				return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
					status: 401,
					headers: { "Content-Type": "application/json" },
				});
			}

			const workosId = identity.subject;
			await ctx.runMutation(api.auth.ensureUser, {});

			const body = (await request.json()) as {
				fullName?: string;
				summary?: string;
				architecture?: unknown;
				skill?: unknown;
				fileIndex?: unknown;
				commitSha?: string;
				analyzedAt?: string;
			};
			const { fullName, summary, architecture, skill, fileIndex, commitSha, analyzedAt } = body;

			// Validate required fields
			if (
				!fullName ||
				!summary ||
				!architecture ||
				!skill ||
				!fileIndex ||
				!commitSha ||
				!analyzedAt
			) {
				return new Response(
					JSON.stringify({
						error: "Missing required fields",
						message:
							"Required: fullName, summary, architecture, skill, fileIndex, commitSha, analyzedAt",
					}),
					{
						status: 400,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			// Parse provider from fullName (default to github)
			const provider = "github"; // V1: only GitHub supported

			// Upsert analysis
			const result = await ctx.runMutation(internal.analyses.upsert, {
				fullName,
				provider,
				summary,
				architecture,
				skill,
				fileIndex,
				commitSha,
				analyzedAt,
				version: "0.1.0",
				workosId,
			});

			if (!result.success) {
				const statusCode = result.error === "rate_limit" ? 429 : 409;
				return new Response(
					JSON.stringify({
						error: result.error,
						message: result.message,
						remoteCommitSha: result.remoteCommitSha,
					}),
					{
						status: statusCode,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			return new Response(
				JSON.stringify({ success: true, message: "Analysis pushed successfully" }),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		} catch (error) {
			console.error("Push error:", error);
			return new Response(JSON.stringify({ error: "Internal server error" }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		}
	}),
});

// ============================================================================
// /api/analyses/check endpoint
// ============================================================================

http.route({
	path: "/api/analyses/check",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		try {
			const body = (await request.json()) as { fullName?: string };
			const { fullName } = body;

			// Validate required field
			if (!fullName || typeof fullName !== "string") {
				return new Response(JSON.stringify({ error: "fullName is required" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}

			// Get analysis metadata only (lightweight check, no pullCount increment)
			const meta = await ctx.runQuery(internal.analyses.getMeta, {
				fullName,
			});

			if (!meta) {
				return new Response(JSON.stringify({ exists: false }), {
					status: 200, // 200 even for "not found" - this is a check endpoint
					headers: { "Content-Type": "application/json" },
				});
			}

			return new Response(
				JSON.stringify({
					exists: true,
					commitSha: meta.commitSha,
					analyzedAt: meta.analyzedAt,
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		} catch (error) {
			console.error("Check error:", error);
			return new Response(JSON.stringify({ error: "Internal server error" }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		}
	}),
});

export default http;
