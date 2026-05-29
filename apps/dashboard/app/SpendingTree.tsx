"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { trustTierBadge } from "@/lib/status";

type TreeNodeData = {
  id: string;
  name: string;
  expired: boolean;
  dailyCap: number;
  trustTier: string;
  trustScore: number;
  totalApprovedSpend: number;
  counts: { approved: number; blocked: number; escalated: number };
  children: TreeNodeData[];
};

interface TreeResponse {
  roots: TreeNodeData[];
}

const NODE_W = 240;
const NODE_H = 156;
const X_GAP = 32;
const Y_GAP = 56;

function subtreeWidth(node: TreeNodeData): number {
  if (node.children.length === 0) return NODE_W;
  const childrenTotal = node.children.reduce(
    (sum, c) => sum + subtreeWidth(c),
    0,
  );
  const gaps = X_GAP * (node.children.length - 1);
  return Math.max(NODE_W, childrenTotal + gaps);
}

function layoutTree(roots: TreeNodeData[]): {
  nodes: Node<TreeNodeData>[];
  edges: Edge[];
} {
  const nodes: Node<TreeNodeData>[] = [];
  const edges: Edge[] = [];

  function place(node: TreeNodeData, xStart: number, depth: number) {
    const w = subtreeWidth(node);
    const x = xStart + (w - NODE_W) / 2;
    const y = depth * (NODE_H + Y_GAP);
    nodes.push({
      id: node.id,
      type: "agent",
      position: { x, y },
      data: node,
    });

    let childX = xStart;
    for (const child of node.children) {
      const cw = subtreeWidth(child);
      edges.push({
        id: `${node.id}->${child.id}`,
        source: node.id,
        target: child.id,
        type: "smoothstep",
        style: { stroke: "#94a3b8", strokeWidth: 1.5 },
      });
      place(child, childX, depth + 1);
      childX += cw + X_GAP;
    }
  }

  let rootX = 0;
  for (const root of roots) {
    place(root, rootX, 0);
    rootX += subtreeWidth(root) + X_GAP * 2;
  }
  return { nodes, edges };
}

function AgentNode({ data }: NodeProps<Node<TreeNodeData>>) {
  const pct = Math.min(
    1,
    data.dailyCap > 0 ? data.totalApprovedSpend / data.dailyCap : 0,
  );
  const barColor =
    pct >= 0.9 ? "bg-amber-500" : pct >= 0.5 ? "bg-emerald-500" : "bg-emerald-400";

  return (
    <Link
      href={`/agents/${data.id}`}
      className="block rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 shadow-sm transition hover:shadow-md"
      style={{ width: NODE_W }}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold">{data.name}</span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            data.expired
              ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          }`}
        >
          {data.expired ? "Expired" : "Active"}
        </span>
      </div>
      <div className="mt-1.5">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${trustTierBadge(data.trustTier)}`}
        >
          {data.trustTier} · {Math.round(data.trustScore)}
        </span>
      </div>
      <div className="mt-2 text-xs text-[var(--muted)]">
        ${data.totalApprovedSpend.toFixed(2)} of ${data.dailyCap.toFixed(2)}
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/[.06] dark:bg-white/[.08]">
        <div
          className={`h-full ${barColor} transition-all`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <div className="mt-2 flex items-center gap-3 text-[11px]">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {data.counts.approved}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          {data.counts.escalated}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          {data.counts.blocked}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </Link>
  );
}

const nodeTypes = { agent: AgentNode };

export function SpendingTree() {
  const [data, setData] = useState<TreeResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch("/api/tree", { cache: "no-store" });
        const json = (await res.json()) as TreeResponse;
        if (!cancelled) setData(json);
      } catch {
        // swallow — next tick will retry
      }
    }
    tick();
    const id = setInterval(tick, 2500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [], edges: [] };
    return layoutTree(data.roots);
  }, [data]);

  if (!data) {
    return (
      <div className="flex h-[360px] items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-sm text-[var(--muted)]">
        Loading spending tree…
      </div>
    );
  }

  if (data.roots.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-sm text-[var(--muted)]">
        Register agents to see the tree.
      </div>
    );
  }

  return (
    <div className="h-[360px] overflow-hidden rounded-lg border border-[var(--border)]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        panOnDrag
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
