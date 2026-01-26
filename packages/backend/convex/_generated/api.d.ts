/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as github from "../github.js";
import type * as healthCheck from "../healthCheck.js";
import type * as http from "../http.js";
import type * as references from "../references.js";
import type * as repository from "../repository.js";
import type * as validation_github from "../validation/github.js";
import type * as validation_push from "../validation/push.js";
import type * as validation_referenceContent from "../validation/referenceContent.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  github: typeof github;
  healthCheck: typeof healthCheck;
  http: typeof http;
  references: typeof references;
  repository: typeof repository;
  "validation/github": typeof validation_github;
  "validation/push": typeof validation_push;
  "validation/referenceContent": typeof validation_referenceContent;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
