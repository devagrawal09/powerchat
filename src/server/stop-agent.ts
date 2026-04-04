"use server";
import { and, eq } from "drizzle-orm";
import { agentRuns } from "~/db/schema/server";
import { stopAgentRun } from "./agent";
import { db } from "./db";

export async function stopAgent(runId: string): Promise<{ success: boolean }> {
  console.log("[stop-agent] stopping run", runId);

  // Try to abort the in-memory stream
  const aborted = stopAgentRun(runId);

  // Also mark the run as stopped in the database (in case the abort didn't work
  // or the process already finished)
  try {
    await db
      .update(agentRuns)
      .set({ status: "stopped", completedAt: new Date().toISOString() })
      .where(and(eq(agentRuns.id, runId), eq(agentRuns.status, "running")));
  } catch (err) {
    console.error("[stop-agent] failed to update DB", err);
  }

  return { success: aborted };
}
