// convex/http.js
import { httpRouter } from "convex/server";
import { githubWebhook } from "./http/webhook";

const http = httpRouter();

// Route all webhook requests to the comprehensive webhook handler
http.route({
  path: "/webhook",
  method: "POST",
  handler: githubWebhook,
});

export default http;
