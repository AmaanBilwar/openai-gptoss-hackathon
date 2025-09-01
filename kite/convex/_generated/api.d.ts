/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as actions_embedding from "../actions/embedding.js";
import type * as actions_embeddings from "../actions/embeddings.js";
import type * as actions_github from "../actions/github.js";
import type * as actions_processQueue from "../actions/processQueue.js";
import type * as actions_summarize from "../actions/summarize.js";
import type * as chats from "../chats.js";
import type * as cleanup from "../cleanup.js";
import type * as commitProcessing from "../commitProcessing.js";
import type * as commits from "../commits.js";
import type * as crons from "../crons.js";
import type * as embeddings from "../embeddings.js";
import type * as http_embed from "../http/embed.js";
import type * as http_webhook from "../http/webhook.js";
import type * as http from "../http.js";
import type * as hunks from "../hunks.js";
import type * as prProcessing from "../prProcessing.js";
import type * as processing from "../processing.js";
import type * as prs from "../prs.js";
import type * as repositories from "../repositories.js";
import type * as users from "../users.js";
import type * as webhooks from "../webhooks.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "actions/embedding": typeof actions_embedding;
  "actions/embeddings": typeof actions_embeddings;
  "actions/github": typeof actions_github;
  "actions/processQueue": typeof actions_processQueue;
  "actions/summarize": typeof actions_summarize;
  chats: typeof chats;
  cleanup: typeof cleanup;
  commitProcessing: typeof commitProcessing;
  commits: typeof commits;
  crons: typeof crons;
  embeddings: typeof embeddings;
  "http/embed": typeof http_embed;
  "http/webhook": typeof http_webhook;
  http: typeof http;
  hunks: typeof hunks;
  prProcessing: typeof prProcessing;
  processing: typeof processing;
  prs: typeof prs;
  repositories: typeof repositories;
  users: typeof users;
  webhooks: typeof webhooks;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
