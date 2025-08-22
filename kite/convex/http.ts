import { httpRouter } from "convex/server";
import { webhook } from "./http/github";

const http = httpRouter();

http.route({
  path: "/webhooks/github",
  method: "POST",
  handler: webhook,
});

export default http;
