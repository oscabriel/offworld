import { setupFetchClient } from "@convex-dev/better-auth/react-start";
import { createAuth } from "convex/auth";

export const { fetchQuery, fetchMutation, fetchAction } =
	setupFetchClient(createAuth);
