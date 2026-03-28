"use server";
import { stopAgentRun } from "./agent";
import { queryInternal } from "./db";

export async function stopAgent(runId: string): Promise<{ success: boolean }> {
  console.log("[stop-agent] stopping run", runId);

  // Try to abort the in-memory stream
  const aborted = stopAgentRun(runId);

  // Also mark the run as stopped in the database (in case the abort didn't work
  // or the process already finished)
  try {
    await queryInternal(
      `UPDATE agent_runs SET status = 'stopped', completed_at = $1 WHERE id = $2 AND status = 'running'`,
      [new Date().toISOString(), runId],
    );
  } catch (err) {
    console.error("[stop-agent] failed to update DB", err);
  }

  return { success: aborted };
}
