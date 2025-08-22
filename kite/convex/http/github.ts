import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

// Verify GitHub webhook signature using Web Crypto
async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    // Convert secret to ArrayBuffer
    const secretBuffer = new TextEncoder().encode(secret);
    
    // Import the key
    const key = await crypto.subtle.importKey(
      'raw',
      secretBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    // Sign the payload
    const payloadBuffer = new TextEncoder().encode(payload);
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, payloadBuffer);
    
    // Convert to hex
    const expectedSignature = 'sha256=' + Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Constant time comparison
    if (signature.length !== expectedSignature.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }
    
    return result === 0;
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

// GitHub webhook handler
export const webhook = httpAction(async (ctx, request) => {
  // Get the raw payload
  const payload = await request.text();
  const signature = request.headers.get('x-hub-signature-256') || '';
  
  // Verify signature
  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET;
  if (!secret) {
    return new Response('Webhook secret not configured', { status: 500 });
  }
  
  const isValidSignature = await verifySignature(payload, signature, secret);
  if (!isValidSignature) {
    return new Response('Invalid signature', { status: 401 });
  }
  
  // Parse the payload
  const event = JSON.parse(payload);
  const eventType = request.headers.get('x-github-event') || 'unknown';
  
  // Store the raw event for debugging
  await ctx.runMutation(internal.events.storeWebhookEvent, {
    eventType,
    payload: event,
    processed: false,
    createdAt: Date.now()
  });
  
  // Route events to appropriate ingestion handlers
  try {
    switch (eventType) {
      case 'push':
        await ctx.runAction(internal.ingest.ingestOnPush, { pushEvent: event });
        break;
      case 'pull_request':
        await ctx.runAction(internal.ingest.ingestOnPR, { prEvent: event });
        break;
      case 'pull_request_review':
        await ctx.runAction(internal.ingest.ingestOnPRReview, { reviewEvent: event });
        break;
      case 'issue_comment':
        await ctx.runAction(internal.ingest.ingestOnComment, { commentEvent: event });
        break;
      default:
        console.log(`Unhandled event type: ${eventType}`);
    }
  } catch (error) {
    console.error(`Error processing ${eventType} event:`, error);
    return new Response('Error processing event', { status: 500 });
  }
  
  return new Response('OK', { status: 200 });
});