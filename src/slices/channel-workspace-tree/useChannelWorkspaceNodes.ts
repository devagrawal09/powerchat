import { asc, eq } from "drizzle-orm";
import { clientDb, liveQuery, workspaceNodes } from "~/db/client";
import { useQuery } from "~/lib/powersync-solid/hooks/useQuery";

export type WorkspaceNodeRow = {
  id: string;
  channelId: string;
  path: string;
  parentPath: string | null;
  name: string;
  kind: "file" | "dir";
  sizeBytes: number | null;
  modifiedAt: string;
};

export function useChannelWorkspaceNodes(channelId: () => string) {
  return useQuery<WorkspaceNodeRow>(() =>
    liveQuery(
      clientDb
        .select({
          id: workspaceNodes.id,
          channelId: workspaceNodes.channelId,
          path: workspaceNodes.path,
          parentPath: workspaceNodes.parentPath,
          name: workspaceNodes.name,
          kind: workspaceNodes.kind,
          sizeBytes: workspaceNodes.sizeBytes,
          modifiedAt: workspaceNodes.modifiedAt,
        })
        .from(workspaceNodes)
        .where(eq(workspaceNodes.channelId, channelId()))
        .orderBy(asc(workspaceNodes.path)),
    ),
  );
}
