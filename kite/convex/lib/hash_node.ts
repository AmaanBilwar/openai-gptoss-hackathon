"use node";
import { createHash } from "node:crypto";

export function hashQuestionNode(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
