import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Process the embedding queue every 30 seconds
crons.interval(
  "process embedding queue",
  { seconds: 30 },
  internal.actions.processQueue.processQueue
);

// Run embedding processor every 5 minutes
crons.interval(
  "run embedding processor",
  { minutes: 5 },
  internal.actions.embedding.runEmbeddingProcessor
);

// Disabled retry cron for now to unblock dev (function availability varies)
// crons.interval(
//   "process retry queue",
//   { minutes: 2 },
//   internal.processing.processRetryItems
// );

// Clean up old completed/failed items every hour
crons.interval(
  "cleanup old queue items",
  { hours: 1 },
  internal.processing.cleanUpQueueItems
);

export default crons;
