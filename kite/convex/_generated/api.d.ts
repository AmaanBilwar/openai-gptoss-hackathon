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
import type * as actions_ask from "../actions/ask.js";
import type * as actions_embed from "../actions/embed.js";
import type * as actions_ingest from "../actions/ingest.js";
import type * as actions_summarize from "../actions/summarize.js";
import type * as answers from "../answers.js";
import type * as chats from "../chats.js";
import type * as commits from "../commits.js";
import type * as embeddings_hunk from "../embeddings_hunk.js";
import type * as events from "../events.js";
import type * as files from "../files.js";
import type * as http_github from "../http/github.js";
import type * as http from "../http.js";
import type * as hunks from "../hunks.js";
import type * as lib_hash from "../lib/hash.js";
import type * as lib_hash_node from "../lib/hash_node.js";
import type * as pr_comments from "../pr_comments.js";
import type * as pr_files from "../pr_files.js";
import type * as prs from "../prs.js";
import type * as repos from "../repos.js";
import type * as repositories from "../repositories.js";
import type * as summaries_commit from "../summaries_commit.js";
import type * as summaries_hunk from "../summaries_hunk.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "actions/ask": typeof actions_ask;
  "actions/embed": typeof actions_embed;
  "actions/ingest": typeof actions_ingest;
  "actions/summarize": typeof actions_summarize;
  answers: typeof answers;
  chats: typeof chats;
  commits: typeof commits;
  embeddings_hunk: typeof embeddings_hunk;
  events: typeof events;
  files: typeof files;
  "http/github": typeof http_github;
  http: typeof http;
  hunks: typeof hunks;
  "lib/hash": typeof lib_hash;
  "lib/hash_node": typeof lib_hash_node;
  pr_comments: typeof pr_comments;
  pr_files: typeof pr_files;
  prs: typeof prs;
  repos: typeof repos;
  repositories: typeof repositories;
  summaries_commit: typeof summaries_commit;
  summaries_hunk: typeof summaries_hunk;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
