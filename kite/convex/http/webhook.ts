import { v } from "convex/values";
import { api } from "../_generated/api";
import { internal } from "../_generated/api";
import { httpAction } from "../_generated/server";

/**
 * Verify GitHub webhook signature using HMAC-SHA256
 */
async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  if (!secret) return false;
  
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", 
    enc.encode(secret), 
    { name: "HMAC", hash: "SHA-256" }, 
    false, 
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const expected = "sha256=" + Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  
  return signature === expected;
}

/**
 * GitHub Webhook Handler
 * Receives push and pull request events from GitHub
 * Queues them for embedding processing
 */
export const githubWebhook = httpAction(async (ctx, request) => {
  try {
    // Get the raw body for signature verification
    const rawBody = await request.text();
    
    // Verify GitHub webhook signature
    const signature = request.headers.get("x-hub-signature-256");
    const eventType = request.headers.get("x-github-event");
    const deliveryId = request.headers.get("x-github-delivery");

    if (!signature || !eventType || !deliveryId) {
      return new Response("Missing required headers", { status: 400 });
    }

    // Verify signature
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!await verifySignature(rawBody, signature, secret || "")) {
      return new Response("Invalid signature", { status: 401 });
    }

    // Parse the webhook payload
    const payload = JSON.parse(rawBody);
    
    console.log(`📥 Received ${eventType} event:`, {
      deliveryId,
      repo: payload.repository?.full_name,
      eventType
    });

    // Extract repository information
    const repoFullName = payload.repository?.full_name;
    const repoId = payload.repository?.id;

    if (!repoFullName || !repoId) {
      return new Response("Invalid repository information", { status: 400 });
    }

    // Store the webhook event with empty payload (as required by schema)
    const webhookEventId = await ctx.runMutation(api.webhooks.storeWebhookEvent, {
      repoId,
      eventType: eventType === "push" ? "push" : 
                 eventType === "pull_request" ? "pull_request" : 
                 eventType === "pull_request_review" ? "pull_request_review" : 
                 eventType === "issue_comment" ? "issue_comment" : "push", // default to push for unknown types
      eventId: payload.after || payload.pull_request?.id || Date.now().toString(),
      deliveryId,
      payload: {} // Empty object as required by schema
    });

    // Process based on event type
    if (eventType === "push") {
      await handlePushEvent(ctx, payload, repoId, webhookEventId);
    } else if (eventType === "pull_request") {
      await handlePullRequestEvent(ctx, payload, repoId, webhookEventId);
    }

    return new Response("OK", { status: 200 });

  } catch (error) {
    console.error("❌ Webhook handler error:", error);
    return new Response("Internal server error", { status: 500 });
  }
});

/**
 * Handle push events (new commits)
 */
async function handlePushEvent(
  ctx: any,
  payload: any,
  repoId: number,
  webhookEventId: string
) {
  const commits = payload.commits || [];
  
  console.log(`🔄 Processing ${commits.length} commits from push event`);

  for (const commit of commits) {
    const sha = commit.id;
    
    // Queue the commit for processing with empty metadata (as required by schema)
    await ctx.runMutation(api.processing.queueCommitProcessing, {
      repoId,
      sha,
      priority: 2, // normal priority
      metadata: {} // Empty object as required by schema
    });

    console.log(`📋 Queued commit ${sha.substring(0, 8)} for processing`);
  }
}

/**
 * Handle pull request events
 */
async function handlePullRequestEvent(
  ctx: any,
  payload: any,
  repoId: number,
  webhookEventId: string
) {
  const pr = payload.pull_request;
  const action = payload.action;

  // Only process on certain actions
  if (!["opened", "synchronize", "reopened"].includes(action)) {
    console.log(`⏭️ Skipping PR ${pr.number} - action: ${action}`);
    return;
  }

  console.log(`🔄 Processing PR #${pr.number} (${action})`);

  // Queue the PR for processing with empty metadata (as required by schema)
  await ctx.runMutation(api.processing.queuePRProcessing, {
    repoId,
    prNumber: pr.number,
    priority: 1, // high priority for PRs
    metadata: {} // Empty object as required by schema
  });

  console.log(`📋 Queued PR #${pr.number} for processing`);
}
