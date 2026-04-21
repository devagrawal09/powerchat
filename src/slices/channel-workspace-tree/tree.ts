import type { WorkspaceNodeRow } from "./useChannelWorkspaceNodes";

export type WorkspaceTreeNode = WorkspaceNodeRow & {
  children: WorkspaceTreeNode[];
};

function compareWorkspaceTreeNodes(
  left: WorkspaceTreeNode,
  right: WorkspaceTreeNode,
) {
  if (left.kind !== right.kind) {
    return left.kind === "dir" ? -1 : 1;
  }

  return left.name.localeCompare(right.name);
}

function sortWorkspaceTree(nodes: WorkspaceTreeNode[]) {
  nodes.sort(compareWorkspaceTreeNodes);

  for (const node of nodes) {
    if (node.children.length > 0) {
      sortWorkspaceTree(node.children);
    }
  }

  return nodes;
}

export function buildWorkspaceTree(rows: WorkspaceNodeRow[]) {
  const treeByPath = new Map<string, WorkspaceTreeNode>();
  const rootNodes: WorkspaceTreeNode[] = [];

  for (const row of rows) {
    treeByPath.set(row.path, {
      ...row,
      children: [],
    });
  }

  for (const node of treeByPath.values()) {
    if (node.parentPath) {
      const parentNode = treeByPath.get(node.parentPath);
      if (parentNode) {
        parentNode.children.push(node);
        continue;
      }
    }

    rootNodes.push(node);
  }

  return sortWorkspaceTree(rootNodes);
}
