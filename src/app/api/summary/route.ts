import type { NextRequest } from "next/server";
import { ApiError, parseWith, respond } from "@/lib/api";
import { summarize } from "@/lib/llm";
import { factsSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(req: NextRequest) {
  return respond(async () => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ApiError("invalid_input", "Request body must be valid JSON.", 400);
    }
    const facts = parseWith(factsSchema, (body as { facts?: unknown } | null)?.facts);
    return { data: await summarize(facts) };
  });
}
