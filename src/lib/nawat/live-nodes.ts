import { useEffect, useState } from "react";

export type LiveNode = {
  id: string;
  label: string;
  host: string;
  online: boolean;
  models: string[];
  bytes: number;
  checkedAt: number;
};

const NODES = [
  { id: "local", label: "Appareil local", host: "http://127.0.0.1:11434" },
  { id: "vps66", label: "VPS (66)", host: "http://192.168.100.66:11434" },
  { id: "lan67", label: "Réseau local .67", host: "http://192.168.100.67:11434" },
];

async function probe(n: (typeof NODES)[number]): Promise<LiveNode> {
  const base = { ...n, online: false, models: [] as string[], bytes: 0, checkedAt: Date.now() };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch(n.host + "/api/tags", { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return base;
    const d = (await r.json()) as { models?: { name: string; size?: number }[] };
    const ms = d.models ?? [];
    return { ...base, online: true, models: ms.map((m) => m.name), bytes: ms.reduce((s, m) => s + (m.size ?? 0), 0) };
  } catch {
    return base;
  }
}

/** Real reachability + installed models of each engine, refreshed every 15s. */
export function useLiveNodes() {
  const [nodes, setNodes] = useState<LiveNode[] | null>(null);
  const [ghnCount, setGhnCount] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const run = async () => {
      const res = await Promise.all(NODES.map(probe));
      if (alive) setNodes(res);
      try {
        const { ghnListModels } = await import("./groupe-hn-platform");
        const list = await ghnListModels();
        if (alive) setGhnCount(list.length);
      } catch { /* platform unreachable */ }
    };
    run();
    const id = setInterval(run, 15000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return { nodes, ghnCount };
}
