import { createAuth } from "@/lib/auth";
import { nextJsHandler } from "@convex-dev/better-auth/nextjs";

export const { GET, POST } = nextJsHandler(createAuth);


