import { useMemo, useState } from "react";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Cpu,
  File,
  FilePlus,
  FolderPlus,
  Image,
  Library,
  Pencil,
  ScrollText,
  Trash2,
  Code2,
} from "lucide-react";
import { WORKSPACE_ROOTS, useWorkspace } from "@/lib/nawat/workspace";
import { WorkspaceOpener } from "./WorkspaceOpener";

type Node = { name: string; path: string; children?: Map<string, Node> };

const ROOT_ICON: Record<string, typeof File> = {
  "my-app": Code2,
  bibliotheque: Library,
  vision_output: Image,
  agents: Bot,
  models: Cpu,
  logs: ScrollText,
};

function buildTree(paths: string[]): Map<string, Node> {
  const root = new Map<string, Node>();
  for (const p of paths.sort()) {
    const parts = p.split("/");
    let level = root;
    let acc = "";
    parts.forEach((part, i) => {
      acc = acc ? `${acc}/${part}` : part;
      const isFile = i === parts.length - 1;
      let node = level.get(part);
      if (!node) {
        node = { name: part, path: acc, ...(isFile ? {} : { children: new Map() }) };
        level.set(part, node);
      }
      if (!isFile) {
        node.children ??= new Map();
        level = node.children;
      }
    });
  }
  return root;
}

function TreeNode({ node, depth }: { node: Node; depth: number }) {
  const { openFile, active, renameFile, deleteFile } = useWorkspace();
  const [open, setOpen] = useState(true);
  const isDir = !!node.children;
  const pad = { paddingInlineStart: `${depth * 12 + 8}px` };

  if (isDir) {
    return (
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          style={pad}
          className="flex w-full items-center gap-1 py-1 text-sm text-muted-foreground hover:text-foreground"
        >
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          <span className="truncate font-medium">{node.name}</span>
        </button>
        {open &&
          [...node.children!.values()].map((c) => (
            <TreeNode key={c.path} node={c} depth={depth + 1} />
          ))}
      </div>
    );
  }

  return (
    <div
      className={`group flex items-center gap-1 pe-1 text-sm ${
        active === node.path ? "bg-accent text-foreground" : "hover:bg-accent/50"
      }`}
    >
      <button
        onClick={() => openFile(node.path)}
        style={pad}
        className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-start"
      >
        <File className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{node.name}</span>
      </button>
      <button
        title="Rename" aria-label="إعادة تسمية"
        className="opacity-0 transition group-hover:opacity-100"
        onClick={() => {
          const to = prompt("New path", node.path);
          if (to && to !== node.path) renameFile(node.path, to);
        }}
      >
        <Pencil className="size-3.5 text-muted-foreground hover:text-foreground" />
      </button>
      <button
        title="Delete" aria-label="حذف"
        className="opacity-0 transition group-hover:opacity-100"
        onClick={() => {
          if (confirm(`Delete ${node.path}?`)) deleteFile(node.path);
        }}
      >
        <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
      </button>
    </div>
  );
}

function RootSection({ root, hint, paths }: { root: string; hint: string; paths: string[] }) {
  const { createFile } = useWorkspace();
  const [open, setOpen] = useState(true);
  const Icon = ROOT_ICON[root] ?? File;
  const tree = useMemo(
    () => buildTree(paths.map((p) => p.slice(root.length + 1)).filter(Boolean)),
    [paths, root],
  );

  return (
    <div className="border-b border-border/60 pb-1">
      <div className="group flex items-center gap-1 px-2 py-1.5">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-start"
          title={hint}
        >
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          <Icon className="size-3.5 shrink-0 text-nawat" />
          <span className="truncate text-xs font-semibold">{root}/</span>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            {paths.length}
          </span>
        </button>
        <button
          title={`ملف جديد في ${root}/`} aria-label={`ملف جديد في ${root}`}
          className="opacity-0 transition group-hover:opacity-100"
          onClick={() => {
            const name = prompt(`اسم الملف داخل ${root}/`, "nouveau-fichier.md");
            if (name) createFile(`${root}/${name.replace(/^\/+/, "")}`);
          }}
        >
          <FilePlus className="size-3.5 text-muted-foreground hover:text-foreground" />
        </button>
        <button
          title={`مجلد جديد في ${root}/`} aria-label={`مجلد جديد في ${root}`}
          className="opacity-0 transition group-hover:opacity-100"
          onClick={() => {
            const name = prompt(`اسم المجلد داخل ${root}/`, "dossier");
            if (name) createFile(`${root}/${name.replace(/^\/+|\/$/g, "")}/.keep`);
          }}
        >
          <FolderPlus className="size-3.5 text-muted-foreground hover:text-foreground" />
        </button>
      </div>
      {open &&
        (paths.length === 0 ? (
          <p className="px-8 pb-1 text-[11px] text-muted-foreground">فارغ</p>
        ) : (
          [...tree.values()].map((n) => (
            <TreeNode key={`${root}/${n.path}`} node={prefixNode(n, root)} depth={1} />
          ))
        ))}
    </div>
  );
}

function prefixNode(node: Node, root: string): Node {
  const path = `${root}/${node.path}`;
  if (!node.children) return { ...node, path };
  const children = new Map<string, Node>();
  node.children.forEach((child, key) => children.set(key, prefixNode(child, root)));
  return { ...node, path, children };
}

export function FileExplorer({ width = 256 }: { width?: number }) {
  const { vfs, createFile } = useWorkspace();
  const allPaths = useMemo(() => Object.keys(vfs).sort(), [vfs]);

  const knownRoots = WORKSPACE_ROOTS.map((r) => r.path);
  const others = allPaths.filter((p) => !knownRoots.some((r) => p.startsWith(`${r}/`)));

  return (
    <aside
      style={{ width }}
      className="flex min-w-0 shrink-0 flex-col border-e border-border bg-panel"
    >
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Explorer
        </span>
        <button
          title="ملف جديد بمسار كامل" aria-label="ملف جديد بمسار كامل"
          onClick={() => {
            const p = prompt("مسار الملف", "bibliotheque/note.md");
            if (p) createFile(p);
          }}
        >
          <FilePlus className="size-4 text-muted-foreground hover:text-foreground" />
        </button>
      </header>
      <WorkspaceOpener />
      <div className="flex-1 overflow-auto py-1">
        {WORKSPACE_ROOTS.map((root) => (
          <RootSection
            key={root.path}
            root={root.path}
            hint={root.hint}
            paths={allPaths.filter((p) => p.startsWith(`${root.path}/`))}
          />
        ))}
        {others.length > 0 && (
          <div className="pt-1">
            <p className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
              autres
            </p>
            {[...buildTree(others).values()].map((n) => (
              <TreeNode key={n.path} node={n} depth={0} />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
